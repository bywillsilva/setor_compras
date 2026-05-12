ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS tema_preferido TEXT NOT NULL DEFAULT 'claro';

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_tema_preferido_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_tema_preferido_check
  CHECK (tema_preferido IN ('claro', 'escuro'));

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_perfil_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_perfil_check
  CHECK (perfil IN ('admin', 'comprador', 'orcamentista', 'solicitante', 'financeiro'));

UPDATE usuarios
SET tema_preferido = 'claro'
WHERE tema_preferido IS NULL OR tema_preferido NOT IN ('claro', 'escuro');
