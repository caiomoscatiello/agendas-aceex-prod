
CREATE POLICY "Users can update own agenda status"
ON public.agendas
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
