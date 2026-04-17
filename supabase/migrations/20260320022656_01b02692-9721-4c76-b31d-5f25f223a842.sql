ALTER TABLE public.projeto_stakeholders
  ADD COLUMN IF NOT EXISTS profile_user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;