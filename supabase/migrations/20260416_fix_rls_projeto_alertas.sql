-- Remover policy existente
DROP POLICY IF EXISTS "Coordenador vê alertas dos seus projetos" ON projeto_alertas;

-- Recriar com hierarquia: admin vê tudo, coordenador vê só seus projetos
CREATE POLICY "Hierarquia projeto_alertas" ON projeto_alertas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
    OR
    projeto_id IN (
      SELECT id FROM projetos
      WHERE coordenador_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
    OR
    projeto_id IN (
      SELECT id FROM projetos
      WHERE coordenador_id = auth.uid()
    )
  );