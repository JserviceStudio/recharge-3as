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
