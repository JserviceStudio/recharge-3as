-- Migration: Automatisation Dépôt 1XBET

-- 1. Ajout des nouveaux statuts à l'enum tx_status
-- Note: 'ALTER TYPE ... ADD VALUE' ne peut pas être exécuté dans un bloc transactionnel sous Postgres.
ALTER TYPE tx_status ADD VALUE IF NOT EXISTS 'awaiting_payment';
ALTER TYPE tx_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE tx_status ADD VALUE IF NOT EXISTS 'crediting';
ALTER TYPE tx_status ADD VALUE IF NOT EXISTS 'failed_credit';

-- 2. Ajout des colonnes à la table transactions
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS provider_ref varchar(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS provider_status varchar(100),
  ADD COLUMN IF NOT EXISTS xbet_credit_ref varchar(255),
  ADD COLUMN IF NOT EXISTS credit_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credited_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text;

-- 3. Création de la table api_logs
CREATE TABLE IF NOT EXISTS public.api_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
    provider varchar(50) NOT NULL CHECK (provider IN ('aggregator', 'xbet')),
    endpoint varchar(255) NOT NULL,
    request_payload jsonb,
    response_payload jsonb,
    http_status integer,
    duration_ms integer,
    created_at timestamptz DEFAULT now()
);

-- Activation de la RLS sur api_logs
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

-- 4. Politiques RLS pour api_logs
-- Seul le serveur (via service_role) peut insérer des logs. 
-- Les utilisateurs ayant le rôle "admin" peuvent lire les logs.
CREATE POLICY "Admins can view api_logs" ON public.api_logs
  FOR SELECT 
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Le rôle admin_logs doit aussi pouvoir insérer, mais comme on utilise souvent service_role côté serveur, c'est couvert par défaut.
-- Si on veut autoriser l'admin à insérer :
CREATE POLICY "Admins can insert api_logs" ON public.api_logs
  FOR INSERT 
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
  );
