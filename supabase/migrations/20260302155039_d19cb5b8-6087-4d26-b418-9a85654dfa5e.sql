
-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admin can manage email_settings" ON public.email_settings;

-- Recreate as PERMISSIVE
CREATE POLICY "Admin can manage email_settings"
ON public.email_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
