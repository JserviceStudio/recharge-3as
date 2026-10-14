import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
// server-env et XbetAdapter sont importés DANS les handlers : en tête de fichier, ils partaient
// dans le bundle navigateur (« Missing Supabase environment variable(s) », 14/10).
import { CodePays, PAYS, normaliserNumero } from "@/lib/mobile-money";

/**
 * Récupère les paramètres de l'application (WhatsApp, URL du site) depuis app_settings
 * avec repli sur admin_settings.json ou valeurs par défaut.
 */
async function getAppSettings(supabaseAdmin: any) {
  let whatsapp = "+22900000000";
  let appUrl = "https://3asrecharge.com";

  try {
    const { data: rows } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["whatsapp_number", "app_url"]);

    if (rows) {
      for (const r of rows) {
        if (r.key === "whatsapp_number" && r.value) whatsapp = r.value;
        if (r.key === "app_url" && r.value) appUrl = r.value;
      }
    }
  } catch (e) {
    // Repli sur le fichier admin_settings.json
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const p = path.resolve(process.cwd(), "admin_settings.json");
      if (fs.existsSync(p)) {
        const settings = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (settings.whatsapp_number) whatsapp = settings.whatsapp_number;
        if (settings.app_url) appUrl = settings.app_url;
      }
    } catch (err) {}
  }

  return { whatsapp, appUrl };
}

/**
 * Calcule le début de journée minuit en heure du Bénin (UTC+1, Africa/Porto-Novo).
 * Permet de réinitialiser le plafond journalier à minuit heure locale béninoise.
 */
function getBeninDayStartIso(): string {
  const beninNow = new Date(Date.now() + 1 * 60 * 60 * 1000);
  const startOfDayUtc = Date.UTC(
    beninNow.getUTCFullYear(),
    beninNow.getUTCMonth(),
    beninNow.getUTCDate(),
    0, 0, 0
  ) - 1 * 60 * 60 * 1000;
  return new Date(startOfDayUtc).toISOString();
}

/**
 * Server function : Contexte de retrait pour initialiser le formulaire client.
 * Retourne le profil (city, district), nom, dernier id_1xbet, applications disponibles,
 * montant minimum, plafond restant du jour en heure du Bénin, et moyens actifs par pays.
 */
export const getWithdrawalContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadServerEnv } = await import("../../server-env");
    loadServerEnv();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Profil utilisateur (nom, adresse, téléphone)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone, city, district")
      .eq("id", context.userId)
      .maybeSingle();

    // 2. Dernier ID joueur utilisé pour préremplir le champ
    const { data: lastTx } = await supabaseAdmin
      .from("transactions")
      .select("id_1xbet")
      .eq("user_id", context.userId)
      .not("id_1xbet", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Paramètres app_settings
    let minAmount = 900;
    let dailyLimit = 2_000_000;
    let apps: Array<{ code: string; name: string }> = [{ code: "1xbet", name: "1XBET" }];

    try {
      const { data: settings } = await supabaseAdmin
        .from("app_settings")
        .select("key, value")
        .in("key", ["withdrawal_min_amount", "withdrawal_daily_limit", "withdrawal_apps"]);

      if (settings) {
        for (const s of settings) {
          if (s.key === "withdrawal_min_amount" && s.value) {
            const val = parseInt(s.value, 10);
            if (!isNaN(val)) minAmount = val;
          } else if (s.key === "withdrawal_daily_limit" && s.value) {
            const val = parseInt(s.value, 10);
            if (!isNaN(val)) dailyLimit = val;
          } else if (s.key === "withdrawal_apps" && s.value) {
            try {
              const parsed = JSON.parse(s.value);
              if (Array.isArray(parsed) && parsed.length > 0) {
                apps = parsed;
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {}

    // 4. Plafond restant du jour en heure du Bénin (UTC+1)
    // N'additionne pas les retraits rejetés ni échoués (rejected, failed_credit)
    const dayStartIso = getBeninDayStartIso();
    const { data: todayTx } = await supabaseAdmin
      .from("transactions")
      .select("amount, status")
      .eq("user_id", context.userId)
      .eq("type", "withdrawal")
      .gte("created_at", dayStartIso)
      .not("status", "in", "(rejected,failed_credit)");

    const totalToday = (todayTx || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const remainingDailyLimit = Math.max(0, dailyLimit - totalToday);

    // 5. Moyens de paiement actifs
    const { data: paymentMethods } = await supabaseAdmin
      .from("payment_methods")
      .select("id, name, provider, country, payout_mode, active")
      .eq("active", true)
      .order("name");

    return {
      profile: {
        full_name: profile?.full_name || "",
        phone: profile?.phone || "",
        city: profile?.city || "",
        district: profile?.district || "",
      },
      lastId1xbet: lastTx?.id_1xbet || "",
      apps,
      minAmount,
      dailyLimit,
      remainingDailyLimit,
      paymentMethods: paymentMethods || [],
    };
  });

export const submitWithdrawalSchema = z.object({
  idempotency_key: z.string().uuid("Clé d'idempotence invalide"),
  city: z.string().trim().min(1, "La ville est obligatoire").max(100),
  district: z.string().trim().min(1, "Le quartier ou la rue est obligatoire").max(150),
  app_code: z.string().trim().min(1, "L'application est requise"),
  id_1xbet: z.string().trim().regex(/^\d+$/, "L'ID joueur doit contenir uniquement des chiffres"),
  tx_id: z.string().trim().regex(/^[a-zA-Z0-9]{4,80}$/, "Le code de retrait doit contenir entre 4 et 80 caractères alphanumériques"),
  amount: z.coerce.number().int("Le montant doit être un entier").positive("Montant invalide"),
  recipient_name: z.string().trim().min(2, "Nom et prénom Mobile Money requis").max(120),
  recipient_country: z.enum(["BJ", "TG"]),
  payment_method_id: z.string().uuid("Moyen de paiement requis"),
  recipient_number: z.string().trim().min(6, "Numéro invalide"),
});

export const submitWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    try {
      return submitWithdrawalSchema.parse(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new Error(err.issues[0]?.message || "Données invalides");
      }
      throw err;
    }
  })
  .handler(async ({ data, context }) => {
    const { loadServerEnv } = await import("../../server-env");
    loadServerEnv();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { whatsapp, appUrl } = await getAppSettings(supabaseAdmin);

    // 1. Idempotence : si la clé a déjà été soumise par ce client, renvoyer sa demande existante
    const { data: existingTx } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("idempotency_key", data.idempotency_key)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existingTx) {
      return { success: true, transaction: existingTx, adminWhatsapp: whatsapp, appUrl };
    }

    // 2. Vérification de l'application supportée
    let minAmount = 900;
    let dailyLimit = 2_000_000;
    let allowedApps: Array<{ code: string; name: string }> = [{ code: "1xbet", name: "1XBET" }];

    try {
      const { data: settings } = await supabaseAdmin
        .from("app_settings")
        .select("key, value")
        .in("key", ["withdrawal_min_amount", "withdrawal_daily_limit", "withdrawal_apps"]);

      if (settings) {
        for (const s of settings) {
          if (s.key === "withdrawal_min_amount" && s.value) {
            const val = parseInt(s.value, 10);
            if (!isNaN(val)) minAmount = val;
          } else if (s.key === "withdrawal_daily_limit" && s.value) {
            const val = parseInt(s.value, 10);
            if (!isNaN(val)) dailyLimit = val;
          } else if (s.key === "withdrawal_apps" && s.value) {
            try {
              const parsed = JSON.parse(s.value);
              if (Array.isArray(parsed) && parsed.length > 0) allowedApps = parsed;
            } catch (e) {}
          }
        }
      }
    } catch (e) {}

    const selectedApp = allowedApps.find((a) => a.code.toLowerCase() === data.app_code.toLowerCase());
    if (!selectedApp) {
      throw new Error("Application de paris non supportée.");
    }

    // 3. Montant minimum
    if (data.amount < minAmount) {
      throw new Error(`Le montant minimum de retrait est de ${minAmount.toLocaleString("fr-FR")} FCFA.`);
    }

    // 4. Plafond du jour en heure du Bénin (UTC+1), sans additionner les rejetés / échoués
    const dayStartIso = getBeninDayStartIso();
    const { data: todayTx, error: errToday } = await supabaseAdmin
      .from("transactions")
      .select("amount")
      .eq("user_id", context.userId)
      .eq("type", "withdrawal")
      .gte("created_at", dayStartIso)
      .not("status", "in", "(rejected,failed_credit)");

    if (errToday) {
      console.error("[RetraitOrchestrator] Erreur calcul plafond du jour:", errToday);
      throw new Error("Erreur de calcul du plafond journalier. Veuillez réessayer.");
    }

    const totalToday = (todayTx || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    if (totalToday + data.amount > dailyLimit) {
      const restant = Math.max(0, dailyLimit - totalToday);
      throw new Error(`Limite journalière de retrait atteinte. Plafond restant disponible aujourd'hui : ${restant.toLocaleString("fr-FR")} FCFA.`);
    }

    // 5. Un seul retrait actif par client simultanément
    const { data: activeTx } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("user_id", context.userId)
      .eq("type", "withdrawal")
      .in("status", ["pending", "paid", "crediting"])
      .maybeSingle();

    if (activeTx) {
      throw new Error("Vous avez déjà une demande de retrait en cours de traitement. Veuillez patienter.");
    }

    // 6. Code de retrait 1XBET non encore utilisé
    const { data: usedCodeTx } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("type", "withdrawal")
      .eq("tx_id", data.tx_id)
      .neq("status", "rejected")
      .maybeSingle();

    if (usedCodeTx) {
      throw new Error("Ce code de retrait a déjà été utilisé.");
    }

    // 7. Vérification du compte 1XBET via XbetAdapter
    if (selectedApp.code.toLowerCase() === "1xbet") {
      const { XbetAdapter } = await import("../adapters/XbetAdapter");
      const isValidAccount = await XbetAdapter.verifyAccount(data.id_1xbet);
      if (!isValidAccount) {
        if (XbetAdapter.derniereRaison === "CURRENCY_MISMATCH") {
          throw new Error("La devise de votre compte 1XBET ne correspond pas à celle de notre caisse (XOF). Retrait impossible.");
        }
        throw new Error("Compte 1XBET introuvable ou invalide. Vérifiez l'ID de votre compte joueur.");
      }
    }

    // 8. Vérification du moyen de paiement et normalisation du numéro
    const { data: method, error: methodErr } = await supabaseAdmin
      .from("payment_methods")
      .select("*")
      .eq("id", data.payment_method_id)
      .eq("active", true)
      .maybeSingle();

    if (methodErr || !method) {
      throw new Error("Moyen de paiement introuvable ou inactif.");
    }

    const pays = method.country as CodePays;
    if (pays !== data.recipient_country) {
      throw new Error("Le moyen de paiement choisi ne correspond pas au pays sélectionné.");
    }

    const norm = normaliserNumero(pays, data.recipient_number);
    if (!norm) {
      throw new Error(`Numéro invalide pour le pays sélectionné (${PAYS[pays]?.nom || pays}).`);
    }

    // 9. Mise à jour de l'adresse dans le profil utilisateur
    await supabaseAdmin
      .from("profiles")
      .update({
        city: data.city.trim(),
        district: data.district.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.userId);

    // 10. Insertion sécurisée de la transaction
    const { data: newTx, error: insertError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: context.userId,
        type: "withdrawal",
        app_code: selectedApp.code,
        id_1xbet: data.id_1xbet,
        amount: data.amount,
        payment_method_id: method.id,
        payment_method_label: method.name,
        recipient_name: data.recipient_name.trim(),
        recipient_country: pays,
        recipient_number: norm.e164,
        tx_id: data.tx_id.trim(),
        idempotency_key: data.idempotency_key,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      // Gestion des contraintes d'unicité avec messages clairs sans détail Postgres brut
      if (insertError.code === "23505") {
        if (insertError.message.includes("idempotency_key")) {
          const { data: existing } = await supabaseAdmin
            .from("transactions")
            .select("*")
            .eq("idempotency_key", data.idempotency_key)
            .eq("user_id", context.userId)
            .maybeSingle();
          if (existing) {
            return { success: true, transaction: existing, adminWhatsapp: whatsapp, appUrl };
          }
        }
        if (insertError.message.includes("tx_id")) {
          throw new Error("Ce code de retrait a déjà été utilisé.");
        }
        if (insertError.message.includes("active_per_user") || insertError.message.includes("user_id")) {
          throw new Error("Vous avez déjà une demande de retrait en cours de traitement.");
        }
      }
      console.error("[RetraitOrchestrator] Erreur insertion transaction:", insertError);
      throw new Error("Impossible d'enregistrer la demande de retrait. Veuillez réessayer.");
    }

    return {
      success: true,
      transaction: newTx,
      adminWhatsapp: whatsapp,
      appUrl,
    };
  });
