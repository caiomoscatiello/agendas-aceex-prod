
-- Update profiles SELECT policy to allow coordenadores to see non-admin profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'coordenador')
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = profiles.user_id AND ur.role = 'admin'
    )
  )
);

-- Update user_roles SELECT policy to allow coordenadores to see non-admin roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view roles"
ON public.user_roles
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'coordenador')
    AND role != 'admin'
  )
);
