ALTER TABLE clientes ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;

ALTER TABLE anexos ADD COLUMN IF NOT EXISTS nome_arquivo VARCHAR(255);
ALTER TABLE anexos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

UPDATE anexos
SET nome_arquivo = COALESCE(NULLIF(nome_arquivo, ''), regexp_replace(split_part(arquivo_url, '?', 1), '^.*/', ''), 'anexo')
WHERE nome_arquivo IS NULL OR nome_arquivo = '';

UPDATE anexos
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;

ALTER TABLE anexos ALTER COLUMN nome_arquivo SET NOT NULL;
