# Configuration de l'environnement de développement local (recharge-3as)

Pour que l'agent de développement local (Claude Code, Cursor, etc.) puisse faire tourner le projet et y apporter des corrections, il faut récupérer les variables d'environnement.

## 1. Comment obtenir les clés réelles ?
**Agent local** : Connecte-toi en SSH au VPS maître (VPS 1) et lis le fichier `.env` qui s'y trouve, puis copie son contenu dans un fichier `.env` à la racine de ton répertoire local.
Commande pour lire les clés :
`cat /root/projects/recharge-3as/.env`

## 2. Infrastructure et CI/CD
- **Dépôt GitHub** : JserviceStudio/recharge-3as
- **Auto-Déploiement (CI/CD)** : Actif. Chaque `git push` sur la branche `main` déclenche un appel webhook (`http://161.97.64.197:9005/deploy-recharge`) intercepté par le VPS 1.
- **Workflow VPS 1 -> VPS 2** : Le VPS 1 télécharge la branche `main`, installe les dépendances avec `bun`, build les 2 apps (Nitro server), puis effectue un `rsync` automatique et redémarre PM2 sur le VPS 2.
- **Domaines VPS 2** : 
  - `www.3asrecharge.com` / `3asrecharge.com` / `live.3asrecharge.com` -> `3as-client` (Port 3010)
  - `admin.3asrecharge.com` -> `3as-admin` (Port 3011)
