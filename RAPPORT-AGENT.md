# Rapport d'Exécution — Retrait 3AS (Formulaire Complet + Traitement Fiable)

Date : 14 octobre 2026  
Branche : `feat/retrait-complet`  
Environnement : Worktree local git (`/root/.claude/jobs/ba4fa29b/tmp/wt-retrait`), isolation totale (aucun accès hors worktree, aucun `.env` lu, aucun push, aucun réseau).

---

## 1. Commits Réalisés

Les commits ont été réalisés de façon atomique en français, commentés en français et signés selon la consigne :

1. **`778f1bb`** : `feat(retrait): migration sql idempotente et types supabase`
   - Ajout des colonnes pour l'adresse (`city`, `district`), paramétrage des virements FedaPay (`country`, `payout_mode`, insertion de « Mixx by Yas » avec `active=false`), métadonnées de retrait (`app_code`, `recipient_name`, `recipient_country`, `xbet_payout_ref`, `idempotency_key`).
   - Index uniques partiels : idempotence, un code 1XBET une seule fois hors rejetés, un seul retrait actif simultanément par client.
   - Paramètres globaux `app_settings` (minimum 900, plafond 2 000 000, apps supportées).
   - Mise à jour des types TypeScript Supabase dans les deux apps (`apps/client` et `apps/admin`).

2. **`2c7d2d5`** : `feat(admin): validation fiable des retraits, encaissement 1xbet et virement fedapay`
   - Réservation atomique (`UPDATE status='paid' WHERE id=... AND status='pending' RETURNING *`) : élimine tout risque de double virement en cas de double-clic ou concurrence.
   - Encaissement du code 1XBET avant tout virement (`XbetAdapter.payout`) avec signature `SHA256(SHA256+MD5)` et confirm `MD5(userid:hash)`. Timeout 30 s, masquage strict du code dans les logs.
   - Gestion des refus explicites 1XBET (`status='rejected'`) et délais/erreurs réseau (`status='failed_credit'` avec mention « RÉSULTAT INCERTAIN : vérifier la caisse 1XBET avant tout virement » sans aucun virement).
   - Virement FedaPay avec mode et pays extraits de `payment_methods` (`payout_mode` et `country`), montant viré = `Math.abs(Summa)` réel avec enregistrement de toute discordance.
   - Synchronisation cron (`sync-fedapay.ts`) pour relire les retraits `crediting` via `Payout.retrieve` vers `validated` (si `sent`) ou `failed_credit` (si `failed`).
   - Isolation stricte des webhooks FedaPay : rejet des événements non-`transaction.*` pour les recharges et filtrage strict `tx.type === 'recharge'`.
   - Affichage des informations KYC (bénéficiaire, pays, application, ville/quartier) sur la fiche de détail admin (`admin.demandes.$id.tsx`).

3. **`2326b76`** : `feat(client): formulaire complet de retrait et orchestrateur securise`
   - Route `getWithdrawalContext` : préremplissage de l'adresse KYC (`city`, `district`), nom, dernier `id_1xbet`, applications configurées, minimum serveur, plafond restant calculé en heure du Bénin (UTC+1) hors rejetés/échoués, et moyens de paiement actifs avec filtrage par pays.
   - Formulaire ordonné : adresse KYC (ville, quartier/rue obligatoires et enregistrées dans le profil) → application → User ID (chiffres uniquement) → code de retrait (4 à 80 caractères alphanumériques, non journalisé) → montant (≥ minimum et ≤ plafond restant) → nom et prénoms Mobile Money → pays (Bénin/Togo, seuls les pays ayant un moyen actif) → numéro (indicatif affiché, normalisé) → moyen de paiement filtré.
   - Étape de confirmation récapitulative explicite : affichage du récapitulatif avec mention claire « Frais : aucun » et montant net égal au montant brut demandé.
   - Idempotence garantie : clé UUID générée à l'ouverture du formulaire et réutilisée sur les réessais.
   - Vérifications serveur exhaustives (`submitWithdrawal`) : compte 1XBET vérifié sans mismatch devise (`CURRENCY_MISMATCH`), unicité du code, plafond journalier, et message WhatsApp généré **sans le code de retrait en clair** (lien admin suffisant).

4. **`0638c79`** : `test(retrait): suite de tests unitaires et integration du retrait`
   - Création de la suite complète de 15 tests dans `tests/retrait.test.ts`.

---

## 2. Fichiers Créés et Modifiés

### Fichiers créés :
- `supabase/migrations/20261013000000_retrait_complet.sql` : migration SQL idempotente (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
- `apps/admin/src/lib/mobile-money.ts` : catalogue des pays, indicatifs, modes FedaPay et fonction `normaliserNumero` pour l'app admin.
- `tests/retrait.test.ts` : suite de tests unitaires et d'intégration validant les 9 exigences du brief.
- `RAPPORT-AGENT.md` : le présent rapport de synthèse.

### Fichiers modifiés :
- `apps/client/src/integrations/supabase/types.ts` & `apps/admin/src/integrations/supabase/types.ts` : types Supabase complétés (`app_settings`, colonnes `city`, `district`, `payout_mode`, `country`, `app_code`, `recipient_name`, `recipient_country`, `xbet_payout_ref`, `idempotency_key`).
- `apps/admin/src/server/adapters/XbetAdapter.ts` & `apps/client/src/actions/adapters/XbetAdapter.ts` : ajout des méthodes `computePayoutSignature` et `payout` avec timeout 30 s et masquage du code de retrait.
- `apps/admin/src/server/adapters/FedaPayAdapter.ts` : mise à jour de `createPayout` pour accepter `mode` et `country` tirés de `payment_methods`.
- `apps/admin/src/lib/admin.functions.ts` : réécriture de `validateTransaction` en 4 étapes robustes et atomiques.
- `apps/admin/src/routes/api/public/cron/sync-fedapay.ts` : synchronisation des retraits `crediting` via `Payout.retrieve(provider_ref)`.
- `apps/admin/src/server/orchestrators/DepositOrchestrator.server.ts` & `apps/client/src/actions/orchestrators/DepositOrchestrator.server.ts` : protection des recharges contre les collisions avec des événements webhooks payout.
- `apps/admin/src/routes/_authenticated/admin.demandes.$id.tsx` & `apps/client/src/routes/_authenticated/admin.demandes.$id.tsx` : affichage du nom bénéficiaire, pays, application, ville et quartier sur la demande.
- `apps/client/src/actions/orchestrators/RetraitOrchestrator.server.ts` : implémentation de `getWithdrawalContext` et `submitWithdrawal` avec vérifications KYC, AML et sécurité.
- `apps/client/src/routes/_authenticated/retrait.tsx` : formulaire complet avec validation Zod, étape de confirmation modale et redirection WhatsApp sécurisée.

---

## 3. Commandes de Test Réellement Lancées et Résultats

### A. Tests unitaires et intégration (`bun test tests/retrait.test.ts`)
```bash
export PATH="/root/.bun/bin:$PATH" && bun test tests/retrait.test.ts
```
**Résultat :**
```text
bun test v1.4.2 (744846f84)

 15 pass
 0 fail
 41 expect() calls
Ran 15 tests across 1 file. [513.00ms]
```
Détail des 15 tests exécutés :
1. Normalisation numéro/pays Bénin : conversion 8 chiffres vers 10 chiffres préfixés `01` (`96000000` → `0196000000` / `+2290196000000`).
2. Normalisation numéro/pays Bénin : gestion du format international `+229 01 96 00 00 00`.
3. Rejet des numéros béninois invalides (`12345`, préfixes hors `01`).
4. Normalisation numéro/pays Togo : gestion des mobiles 8 chiffres en `9x` et `7x` (`+22890000000` et `+22870123456`).
5. Rejet des numéros togolais invalides (fixes en `22`, numéros tronqués).
6. Signature Payout 1XBET : calcul et correspondance stricte du vecteur vectoriel `SHA256(SHA256+MD5)` et confirm `MD5("userid:hash")`.
7. Mapping mode FedaPay Celtiis = `sbin`.
8. Mapping mode FedaPay Mixx by Yas = `togocel`.
9. Idempotence : restitution de la transaction existante sans réinsertion sur clé identique.
10. Réservation atomique : succès de la réservation pour le premier appel, refus immédiat pour le second appel concurrent (`0 ligne mise à jour`).
11. Timeout 1XBET : bascule en `failed_credit` avec mention incertaine et aucun appel à `FedaPayAdapter.createPayout`.
12. Refus 1XBET : bascule en `rejected` avec motif explicite et aucun appel à `FedaPayAdapter.createPayout`.
13. Discordance de montant : virement effectif du montant réel reçu `Math.abs(Summa)` (4500 au lieu de 5000) et note d'écart.
14. Isolation webhook FedaPay : rejet des événements dont le nom ne commence pas par `transaction.*`.
15. Isolation webhook FedaPay : rejet des transactions dont le type en base n'est pas `recharge`.

### B. Builds de production
1. **Build `apps/client`** :
   ```bash
   cd apps/client && bun run build
   ```
   **Résultat :** `✓ built in 1m 46s` (code de sortie 0, 0 erreur TypeScript/Vite/Nitro).
2. **Build `apps/admin`** :
   ```bash
   cd apps/admin && bun run build
   ```
   **Résultat :** `✓ built in 2m 23s` (code de sortie 0, 0 erreur TypeScript/Vite/Nitro).

---

## 4. SQL à Faire Jouer par le Propriétaire

Le script SQL suivant se trouve dans [supabase/migrations/20261013000000_retrait_complet.sql](file:///root/.claude/jobs/ba4fa29b/tmp/wt-retrait/supabase/migrations/20261013000000_retrait_complet.sql). Il est totalement idempotent et prêt à être appliqué sur la base de données de production :

```sql
-- Migration Retrait Complet : adresses profils, modes payout, contraintes retraits et paramètres

-- 1. Profiles : ajout ville et quartier/rue pour KYC et conformité retrait
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district text;

-- 2. Payment methods : pays et mode FedaPay réel pour les virements (payouts)
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'BJ';
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS payout_mode text;

-- Mise à jour des modes FedaPay des réseaux béninois existants (mtn_open, moov, sbin)
UPDATE public.payment_methods SET payout_mode = 'mtn_open' WHERE provider = 'mtn_momo' AND (payout_mode IS NULL OR payout_mode <> 'mtn_open');
UPDATE public.payment_methods SET payout_mode = 'moov' WHERE provider = 'moov_money' AND (payout_mode IS NULL OR payout_mode <> 'moov');
UPDATE public.payment_methods SET payout_mode = 'sbin' WHERE provider = 'celtiis_cash' AND (payout_mode IS NULL OR payout_mode <> 'sbin');

-- Insertion de Mixx by Yas (Togo, inactif par défaut jusqu'à activation du compte FedaPay Togo)
INSERT INTO public.payment_methods (name, provider, country, payout_mode, agent_number, active)
SELECT 'Mixx by Yas', 'other', 'TG', 'togocel', '+228 00 00 00 00', false
WHERE NOT EXISTS (
    SELECT 1 FROM public.payment_methods WHERE name = 'Mixx by Yas'
);

-- 3. Transactions : métadonnées de retrait et idempotence
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS app_code text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recipient_name text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recipient_country text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS xbet_payout_ref text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS idempotency_key uuid;

-- Index unique partiel pour l'idempotence des soumissions
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency_key 
ON public.transactions(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Index unique partiel : un code de retrait 1XBET ne peut être utilisé qu'une seule fois tant qu'il n'est pas rejeté
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_withdrawal_tx_id_unique 
ON public.transactions(tx_id) 
WHERE type = 'withdrawal' AND status <> 'rejected';

-- Index unique partiel : un seul retrait actif par client simultanément
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_withdrawal_active_per_user 
ON public.transactions(user_id) 
WHERE type = 'withdrawal' AND status IN ('pending', 'paid', 'crediting');

-- 4. Paramètres globaux de retrait dans app_settings
INSERT INTO public.app_settings (key, value, description) VALUES
  ('withdrawal_min_amount', '900', 'Montant minimum de retrait en FCFA'),
  ('withdrawal_daily_limit', '2000000', 'Plafond journalier de retrait en FCFA'),
  ('withdrawal_apps', '[{"code":"1xbet","name":"1XBET"}]', 'Applications de paris supportées pour le retrait')
ON CONFLICT (key) DO NOTHING;
```

---

## 5. Points à Décider par le Propriétaire

1. **Activation du paiement Togo (Mixx by Yas)** :
   Le moyen `Mixx by Yas` a été inséré avec `active = false`. Lorsque le compte FedaPay sera configuré et approvisionné pour les virements vers le Togo, le propriétaire pourra passer la ligne à `active = true` via Supabase ou le panneau d'administration.
2. **Devise de la caisse 1XBET (`XBET_CURRENCY_ID`)** :
   La vérification préalable du compte joueur s'assure que la devise du compte correspond à celle de la caisse (valeur par défaut : `27` = XOF). S'assurer que la variable d'environnement `XBET_CURRENCY_ID=27` est bien présente en production.
3. **Plages de plafonds journaliers** :
   Le plafond par défaut est positionné à `2 000 000 FCFA` par jour (réinitialisé à minuit heure du Bénin UTC+1). Si besoin, cette valeur peut être modifiée à tout moment dans `app_settings` (`withdrawal_daily_limit`).

---

## 6. Relecture 1

### A. Commits Réalisés
Chaque point de `CORRECTIONS-1.md` a fait l'objet d'un commit atomique dédié en français, signé avec `Co-Authored-By: Gemini <noreply@google.com>` :

1. **`5e131d6`** : `fix(client): validation stricte du schema de retrait cote serveur`
   - Application de `submitWithdrawalSchema.parse(data)` dans le `inputValidator` de `submitWithdrawal`.
   - Extraction et renvoi immédiat du premier message d'erreur Zod clair en lieu et place d'une trace d'erreur brute.

2. **`01fc140`** : `fix(client): filtrage de l'idempotence par utilisateur pour eviter les fuites tiers`
   - Ajout systématique du filtre `.eq("user_id", context.userId)` lors de la consultation par `idempotency_key` au début du handler ainsi que dans la branche d'erreur de conflit d'unicité (code 23505).
   - Une clé d'idempotence provenant d'un tiers ne renvoie aucune transaction existante.

3. **`49a51eb`** : `fix(admin): controles stricts du moyen de paiement et numero avant encaissement 1xbet`
   - Contrôles stricts avant tout appel à `XbetAdapter.payout` : moyen de paiement présent en base avec `payout_mode` et `country` non vides (suppression définitive du repli par défaut `mtn_open`).
   - Normalisation stricte du numéro via `normaliserNumero` avec rejet immédiat si invalide (suppression du repli sur les chiffres bruts).
   - En cas d'échec de validation : remise de la transaction à l'état `pending` (`UPDATE status='pending' WHERE id=... AND status='paid'`), consignation dans `admin_logs` (`abort_withdrawal_validation`) et levée d'une erreur claire sans toucher au code 1XBET.

4. **`ec3f45e`** : `fix(admin): blocage du virement fedapay si le montant recu 1xbet n'est pas exploitable`
   - Mise à jour de `XbetAdapter.payout` (côté admin et client) pour renvoyer `NaN` (et non `0`) si la clé `summa` est absente de la réponse 1XBET.
   - Blocage strict du virement FedaPay si `montantReel` n'est pas un entier strictement positif (`Number.isFinite`, `Number.isInteger`, `> 0`).
   - Transition en `failed_credit` avec libellé explicite « RÉSULTAT INCERTAIN : 1XBET a confirmé sans montant exploitable, vérifier la caisse » et enregistrement de `xbet_payout_ref`.

5. **`2487759`** : `test(retrait): tests de non-regression pour les corrections 1 a 4`
   - Ajout des tests de non-régression dans `tests/retrait.test.ts` couvrant l'ensemble des 4 points de correction.

### B. Commandes Lancées et Résultats Réels

1. **Suite de tests unitaires et intégration** :
   ```bash
   export PATH="/root/.bun/bin:$PATH" && bun test tests/retrait.test.ts
   ```
   **Résultat réel :**
   ```text
   bun test v1.4.2 (744846f84)

    21 pass
    0 fail
    61 expect() calls
   Ran 21 tests across 1 file. [2.99s]
   ```
   Les 21 tests (les 15 initiaux + les 6 nouveaux tests de la Relecture 1) passent tous avec succès.

2. **Build de production Client (`apps/client`)** :
   ```bash
   cd apps/client && bun run build
   ```
   **Résultat réel :**
   ```text
   ✓ built in 1m 55s
   code de sortie : 0
   0 erreur TypeScript, Vite ou Nitro.
   ```

3. **Build de production Admin (`apps/admin`)** :
   ```bash
   cd apps/admin && bun run build
   ```
   **Résultat réel :**
   ```text
   ✓ built in 2m 23s
   code de sortie : 0
   0 erreur TypeScript, Vite ou Nitro.
   ```

