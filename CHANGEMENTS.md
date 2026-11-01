# Journal des modifications (depuis le 29/10/2026)

## Pages et composants modifiés ou ajoutés

- **`src/routes/_authenticated/retrait.tsx`** : Mise à jour de la page de retrait avec l'application fixée sur `1xbet`, l'encadré obligatoire en majuscules `*VEUILLEZ CONFIRMER L'ADRESSE DU RETRAIT` (`Ville : Porto-Novo`, `Rue : 3as Recharge`), le minimum à 900 FCFA, l'affichage direct des 3 réseaux Mobile Money (MTN, Moov, Celtiis) et le bouton « Valider la demande ».
- **`src/components/MobileLayout.tsx`** : Intégration du nouveau logo officiel `3AS Recharge` (`/3as-logo-official.png`) dans l'avatar circulaire de l'en-tête (à côté du bouton de déconnexion) ainsi que dans la bannière de bas de page, et retrait de l'accès admin de la barre client.
- **`src/routes/auth.tsx`** : Maintien du visuel original de connexion (`ucl-ball.png`), ajout du badge code promo `FENOU229` copiable en un clic et de l'encadré d'accès rapide au compte client local.
- **`src/routes/_authenticated/admin.tsx`** : Refonte de la mise en page d'administration en un **Espace Agent Contrôle** autonome avec thème sombre dédié, séparé de la navigation client et doté d'un bouton de bascule vers l'espace client.
- **`src/routes/_authenticated/admin.index.tsx`** : Enrichissement du tableau de bord de l'agent avec des cartes d'accès direct aux demandes clients, aux comptes clients (KYC), aux numéros de réception Mobile Money, aux statistiques et à l'aperçu de l'espace client.
- **`src/routes/_authenticated/route.tsx`** : Séparation du rendu de l'interface `/admin` pour afficher l'espace agent de manière indépendante sans la barre de navigation mobile du client.
- **`src/routes/_authenticated/dashboard.tsx`** : Ajout du carrousel promotionnel, de l'encadré de statut de vérification du compte et de l'affichage sécurisé des statistiques de demandes du client.
- **`src/routes/_authenticated/recharge.tsx`** : Pré-remplissage intelligent des informations du joueur (ID 1XBET, numéro Mobile Money et montant) et intégration du flux de paiement automatisé.
- **`src/routes/_authenticated/historique.tsx`** : Actualisation automatique de l'historique des transactions avec gestion résiliente du chargement des demandes.
- **`src/routes/_authenticated/verification.tsx`** : Ajout de la page dédiée à la vérification du numéro de téléphone client via l'identifiant de transaction SMS.
- **`src/routes/_authenticated/admin.clients.tsx`** : Ajout de la page de gestion et de recherche des profils clients inscrits pour les agents.
- **`src/routes/_authenticated/admin.settings.tsx`** : Ajout de la page de configuration des numéros WhatsApp, d'urgence et de l'URL de l'application pour l'administration.
- **`src/routes/_authenticated/admin.demandes.$id.tsx`** : Ajout des contrôles de validation, de rejet motivé, de relance du crédit 1XBET et de forçage manuel sur le détail d'une demande.
- **`src/routes/_authenticated/admin.logs.tsx`** : Mise à jour du journal d'audit pour suivre les événements système et les actions des agents.
- **`public/3as-logo-official.png` & `public/images/3as-logo-official.png`** : Ajout du fichier image officiel du logo `3AS Recharge`.

## Fonctions serveur et adaptateurs modifiés ou ajoutés

- **`src/actions/orchestrators/RetraitOrchestrator.server.ts` (`getWithdrawalContext`, `submitWithdrawal`)** : Pré-configuration de l'adresse de retrait par défaut (`Porto-Novo` / `3as Recharge`) et ajout des 3 réseaux Mobile Money par défaut (MTN Mobile Money, Moov Money, Celtiis Cash) pour garantir leur disponibilité.
- **`src/lib/auth.tsx` (`AuthProvider`, `loginAsDemo`)** : Ajout de la gestion de session locale de démonstration et sécurisation de la récupération du profil et du rôle utilisateur.
- **`src/actions/orchestrators/DepositOrchestrator.server.ts` (`initiateDeposit`, `handleAggregatorWebhook`, `retry1xbetCredit`, `markManuallyCredited`)** : Orchestration complète du cycle de vie des dépôts entre FedaPay, Supabase et 1XBET.
- **`src/actions/orchestrators/SettingsOrchestrator.server.ts` (`getPublicSettings`, `getAdminSettings`, `updateAdminSettings`)** : Fonctions serveur permettant de lire et de mettre à jour les paramètres globaux de l'application.
- **`src/actions/orchestrators/VerificationOrchestrator.server.ts` (`verifyPhoneWithTransaction`)** : Fonction serveur validant le compte d'un client à partir d'une référence de transaction Mobile Money.
- **`src/actions/adapters/FedaPayAdapter.ts`** : Adaptateur d'intégration FedaPay pour la création de transactions de paiement et la vérification des webhooks.
- **`src/actions/adapters/XbetAdapter.ts`** : Adaptateur d'intégration de l'API Cashdesk 1XBET pour le crédit joueur et la vérification des codes de retrait.
- **`src/lib/admin.functions.ts` (`validateTransaction`, `rejectTransaction`, `retryCredit`, `forceManualCredit`)** : Fonctions serveur sécurisées réservées aux agents pour traiter les transactions clients.
- **`src/lib/deposit.functions.ts` (`initiateDepositFn`)** : Fonction serveur authentifiée permettant au client d'initier une demande de recharge.
