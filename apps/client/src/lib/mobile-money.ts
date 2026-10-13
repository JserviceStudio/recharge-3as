// Pays et réseaux Mobile Money pris en charge, avec les codes FedaPay RÉELS
// (docs.fedapay.com/fr/payment-methods : « Modes de paiement sans redirection »).
// Partagé par l'écran (listes, validation) et le serveur (envoi FedaPay) : une seule vérité.

export type CodePays = "BJ" | "TG";

export const PAYS: Record<CodePays, { nom: string; indicatif: string; exemple: string }> = {
  BJ: { nom: "Bénin", indicatif: "229", exemple: "01 96 00 00 00" },
  TG: { nom: "Togo", indicatif: "228", exemple: "90 00 00 00" },
};

export type ReseauRecharge = { code: string; pays: CodePays; nom: string; modeFedapay: string };

// Paiement d'une recharge (encaissement) : Bénin MTN / Moov / Celtiis, Togo YAS / Moov.
export const RESEAUX_RECHARGE: ReseauRecharge[] = [
  { code: "mtn_bj", pays: "BJ", nom: "MTN", modeFedapay: "mtn_open" },
  { code: "moov_bj", pays: "BJ", nom: "Moov", modeFedapay: "moov" },
  { code: "celtiis_bj", pays: "BJ", nom: "Celtiis", modeFedapay: "sbin" },
  { code: "yas_tg", pays: "TG", nom: "YAS (Mixx by Yas)", modeFedapay: "togocel" },
  { code: "moov_tg", pays: "TG", nom: "Moov", modeFedapay: "moov_tg" },
];

// Anciens codes envoyés par les versions précédentes de l'écran (onglet resté ouvert).
const ALIAS: Record<string, string> = { mtn: "mtn_bj", moov: "moov_bj", celtiis: "celtiis_bj" };

export function reseauRecharge(code: string | null | undefined): ReseauRecharge | null {
  const c = String(code ?? "").toLowerCase();
  return RESEAUX_RECHARGE.find((r) => r.code === (ALIAS[c] ?? c)) ?? null;
}

export function reseauxDuPays(pays: CodePays): ReseauRecharge[] {
  return RESEAUX_RECHARGE.filter((r) => r.pays === pays);
}

/**
 * Normalise un numéro saisi librement (« +229 01 96… », « 0196… », « 96… ») vers sa forme
 * nationale (celle qu'attend FedaPay avec le code pays) et E.164. `null` si invalide.
 * Bénin : 10 chiffres commençant par 01 depuis la migration de 2024 ; un ancien numéro à
 * 8 chiffres reçoit le préfixe 01. Togo : 8 chiffres, mobiles en 7x ou 9x.
 */
export function normaliserNumero(pays: CodePays, saisie: string): { national: string; e164: string } | null {
  let n = String(saisie ?? "").replace(/\D/g, "");
  const indicatif = PAYS[pays].indicatif;
  if (n.startsWith("00" + indicatif)) n = n.slice(2 + indicatif.length);
  else if (n.startsWith(indicatif) && n.length > (pays === "BJ" ? 10 : 8)) n = n.slice(indicatif.length);

  if (pays === "BJ") {
    if (n.length === 8) n = "01" + n;
    if (!/^01\d{8}$/.test(n)) return null;
  } else {
    if (!/^[79]\d{7}$/.test(n)) return null;
  }
  return { national: n, e164: `+${indicatif}${n}` };
}
