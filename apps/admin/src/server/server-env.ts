import fs from "node:fs";
import path from "node:path";

let loaded = false;

/**
 * Charge manuellement les variables du fichier .env dans process.env
 * pour s'assurer que les clés secrètes sont disponibles côté serveur
 * (Vite ne charge par défaut que les variables VITE_).
 */
export function loadServerEnv() {
  if (loaded) return;
  
  const possiblePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env") // Si lancé depuis apps/client
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach(line => {
        // Ignore les commentaires et lignes vides
        if (line.trim().startsWith("#") || !line.trim()) return;
        
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || "";
          
          // Nettoyage des guillemets éventuels
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
          
          if (!process.env[key]) {
            process.env[key] = value.trim();
          }
        }
      });
      console.log(`[ServerEnv] Variables d'environnement chargées depuis ${envPath}`);
      loaded = true;
      break;
    }
  }
  
  if (!loaded) {
    console.warn("[ServerEnv] Attention: Aucun fichier .env trouvé !");
  }
}
