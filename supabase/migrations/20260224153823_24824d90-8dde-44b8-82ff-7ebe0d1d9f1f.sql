
-- Fix profiles SELECT policy to use has_role (SECURITY DEFINER) instead of direct subquery
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR (
    has_role(auth.uid(), 'coordenador')
    AND NOT has_role(user_id, 'admin')
  )
);
