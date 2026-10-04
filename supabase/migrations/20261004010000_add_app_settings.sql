-- Création de la table des paramètres globaux
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT now()
);

-- Activation de la sécurité RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Les clients peuvent lire les paramètres publics
CREATE POLICY "Public profiles are viewable by everyone" ON public.app_settings
  FOR SELECT USING (true);

-- Seuls les admins peuvent modifier les paramètres
CREATE POLICY "Admins can update settings" ON public.app_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Insertion des valeurs par défaut
INSERT INTO public.app_settings (key, value, description) VALUES
  ('whatsapp_number', '+22900000000', 'Numéro de réception des demandes de retrait'),
  ('emergency_number', '+22900000000', 'Numéro d''assistance affiché au client'),
  ('app_url', 'https://3asrecharge.com', 'URL de base du site frontend')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT SELECT ON public.app_settings TO authenticated, anon;
GRANT ALL ON public.app_settings TO service_role;
