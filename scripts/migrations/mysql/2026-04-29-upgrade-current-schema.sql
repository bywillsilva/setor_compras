ALTER TABLE clientes ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;

ALTER TABLE usuarios MODIFY COLUMN perfil ENUM('admin', 'comprador', 'orcamentista') DEFAULT 'comprador';

ALTER TABLE compras MODIFY COLUMN categoria VARCHAR(30) NULL;
UPDATE compras
SET categoria = 'perdas'
WHERE categoria = 'outros' OR categoria IS NULL OR categoria = '';
ALTER TABLE compras MODIFY COLUMN categoria ENUM('perfis', 'vidros', 'acessorios', 'perdas') DEFAULT 'perdas';

ALTER TABLE anexos ADD COLUMN IF NOT EXISTS nome_arquivo VARCHAR(255) NULL;
ALTER TABLE anexos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE anexos
SET nome_arquivo = COALESCE(NULLIF(nome_arquivo, ''), SUBSTRING_INDEX(arquivo_url, '/', -1), 'anexo')
WHERE nome_arquivo IS NULL OR nome_arquivo = '';

UPDATE anexos
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;
