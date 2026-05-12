ALTER TABLE usuarios
  MODIFY COLUMN perfil ENUM('admin', 'comprador', 'orcamentista', 'solicitante', 'financeiro') DEFAULT 'comprador';

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS tema_preferido ENUM('claro', 'escuro') NOT NULL DEFAULT 'claro' AFTER perfil;

UPDATE usuarios
SET tema_preferido = 'claro'
WHERE tema_preferido IS NULL OR tema_preferido NOT IN ('claro', 'escuro');
