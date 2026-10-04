import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

// Fonction d'aide pour initialiser le client Supabase admin
const getAdminSupabase = () => {
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY) as string
  );
};

export const getAdminSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const adminSupabase = getAdminSupabase();
      const { data, error } = await adminSupabase.from("app_settings").select("key, value");
      
      if (!error && data && data.length > 0) {
        const settings: Record<string, string> = {};
        data.forEach(item => { settings[item.key] = item.value; });
        return {
          whatsapp_number: settings.whatsapp_number || "+22900000000",
          emergency_number: settings.emergency_number || "+22900000000",
          app_url: settings.app_url || "https://3asrecharge.com"
        };
      }
    } catch (e) {
      console.warn("Impossible de lire app_settings depuis Supabase", e);
    }
    
    // Valeurs par défaut en cas d'échec
    return { 
      whatsapp_number: "+22900000000",
      emergency_number: "+22900000000",
      app_url: "https://3asrecharge.com"
    };
  });

export const updateAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ 
    whatsapp_number: z.string(),
    emergency_number: z.string().optional(),
    app_url: z.string().url().optional()
  }))
  .handler(async ({ data, context }) => {
    // Check if admin
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    try {
      const adminSupabase = getAdminSupabase();
      
      const updates = [
        { key: "whatsapp_number", value: data.whatsapp_number }
      ];
      if (data.emergency_number) updates.push({ key: "emergency_number", value: data.emergency_number });
      if (data.app_url) updates.push({ key: "app_url", value: data.app_url.replace(/\/$/, "") });

      const { error } = await adminSupabase.from("app_settings").upsert(updates, { onConflict: "key" });
      
      if (error) throw new Error(error.message);
      
      return { success: true };
    } catch (e: any) {
      throw new Error("Erreur sauvegarde Supabase: " + e.message);
    }
  });
