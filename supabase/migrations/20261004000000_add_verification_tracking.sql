-- Add strict verification tracking to profiles
ALTER TABLE public.profiles 
  ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN verified_by_tx_id UUID REFERENCES public.transactions(id);

-- Add index for quick lookup
CREATE INDEX idx_profiles_verification ON public.profiles(is_verified);

