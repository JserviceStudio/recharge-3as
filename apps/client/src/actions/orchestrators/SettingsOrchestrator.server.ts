import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

const SETTINGS_FILE = path.resolve(process.cwd(), "admin_settings.json");

export const getAdminSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const content = fs.readFileSync(SETTINGS_FILE, "utf-8");
        return JSON.parse(content);
      }
    } catch (e) {
      console.warn("Impossible de lire admin_settings.json");
    }
    return { 
      whatsapp_number: "+22900000000",
      emergency_number: "+22900000000",
      app_url: "https://3as.vercel.app"
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
      let current = { 
        whatsapp_number: "+22900000000",
        emergency_number: "+22900000000",
        app_url: "https://3as.vercel.app"
      };
      if (fs.existsSync(SETTINGS_FILE)) {
        current = { ...current, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")) };
      }
      current.whatsapp_number = data.whatsapp_number;
      if (data.emergency_number) current.emergency_number = data.emergency_number;
      if (data.app_url) current.app_url = data.app_url.replace(/\/$/, ""); // Enlever le slash final

      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(current, null, 2));
      return { success: true };
    } catch (e: any) {
      throw new Error("Erreur sauvegarde: " + e.message);
    }
  });
