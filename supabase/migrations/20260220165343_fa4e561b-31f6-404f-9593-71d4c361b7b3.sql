
-- Drop all existing restrictive policies and recreate as permissive

-- agendas
DROP POLICY IF EXISTS "Admin can delete agendas" ON public.agendas;
DROP POLICY IF EXISTS "Admin can insert agendas" ON public.agendas;
DROP POLICY IF EXISTS "Users can view own agendas" ON public.agendas;

CREATE POLICY "Admin can delete agendas" ON public.agendas FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert agendas" ON public.agendas FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own agendas" ON public.agendas FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- apontamentos
DROP POLICY IF EXISTS "Users can delete own apontamentos" ON public.apontamentos;
DROP POLICY IF EXISTS "Users can insert own apontamentos" ON public.apontamentos;
DROP POLICY IF EXISTS "Users can view own apontamentos" ON public.apontamentos;

CREATE POLICY "Users can delete own apontamentos" ON public.apontamentos FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own apontamentos" ON public.apontamentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own apontamentos" ON public.apontamentos FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- requisicoes_agenda
DROP POLICY IF EXISTS "Users can insert own requisicoes" ON public.requisicoes_agenda;
DROP POLICY IF EXISTS "Users can view own requisicoes" ON public.requisicoes_agenda;

CREATE POLICY "Users can insert own requisicoes" ON public.requisicoes_agenda FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own requisicoes" ON public.requisicoes_agenda FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- user_roles
DROP POLICY IF EXISTS "Admin can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Admin can delete roles" ON public.user_roles FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert roles" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));
