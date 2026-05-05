ALTER TABLE clientes ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_perfil_check;
ALTER TABLE usuarios
ADD CONSTRAINT usuarios_perfil_check
CHECK (perfil IN ('admin', 'comprador', 'orcamentista'));

ALTER TABLE compras DROP CONSTRAINT IF EXISTS compras_categoria_check;
UPDATE compras
SET categoria = 'perdas'
WHERE categoria = 'outros' OR categoria IS NULL OR categoria = '';
ALTER TABLE compras ALTER COLUMN categoria SET DEFAULT 'perdas';
ALTER TABLE compras
ADD CONSTRAINT compras_categoria_check
CHECK (categoria IN ('perfis', 'vidros', 'acessorios', 'perdas'));

ALTER TABLE anexos ADD COLUMN IF NOT EXISTS nome_arquivo VARCHAR(255);
ALTER TABLE anexos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

UPDATE anexos
SET nome_arquivo = COALESCE(NULLIF(nome_arquivo, ''), regexp_replace(split_part(arquivo_url, '?', 1), '^.*/', ''), 'anexo')
WHERE nome_arquivo IS NULL OR nome_arquivo = '';

UPDATE anexos
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;

ALTER TABLE anexos ALTER COLUMN nome_arquivo SET NOT NULL;
