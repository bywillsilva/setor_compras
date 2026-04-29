ALTER TABLE anexos ADD COLUMN IF NOT EXISTS nome_arquivo VARCHAR(255) NULL;
ALTER TABLE anexos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE anexos
SET nome_arquivo = COALESCE(NULLIF(nome_arquivo, ''), SUBSTRING_INDEX(arquivo_url, '/', -1), 'anexo')
WHERE nome_arquivo IS NULL OR nome_arquivo = '';

UPDATE anexos
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;
