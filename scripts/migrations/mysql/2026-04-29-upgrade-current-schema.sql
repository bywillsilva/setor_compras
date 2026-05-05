ALTER TABLE clientes ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_perfis DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_vidros DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_acessorios DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_perdas DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_outros DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS etapa_autorizacao ENUM('nenhuma', 'solicitada', 'liberada') DEFAULT 'nenhuma';

ALTER TABLE usuarios MODIFY COLUMN perfil ENUM('admin', 'comprador', 'orcamentista') DEFAULT 'comprador';

ALTER TABLE compras MODIFY COLUMN categoria VARCHAR(30) NULL;
UPDATE compras
SET categoria = 'outros'
WHERE categoria IS NULL OR categoria = '';
UPDATE compras
SET
  valor_categoria_perfis = CASE WHEN categoria = 'perfis' AND COALESCE(valor_categoria_perfis, 0) = 0 AND COALESCE(valor_categoria_vidros, 0) = 0 AND COALESCE(valor_categoria_acessorios, 0) = 0 AND COALESCE(valor_categoria_perdas, 0) = 0 AND COALESCE(valor_categoria_outros, 0) = 0 THEN COALESCE(valor_total, 0) ELSE COALESCE(valor_categoria_perfis, 0) END,
  valor_categoria_vidros = CASE WHEN categoria = 'vidros' AND COALESCE(valor_categoria_perfis, 0) = 0 AND COALESCE(valor_categoria_vidros, 0) = 0 AND COALESCE(valor_categoria_acessorios, 0) = 0 AND COALESCE(valor_categoria_perdas, 0) = 0 AND COALESCE(valor_categoria_outros, 0) = 0 THEN COALESCE(valor_total, 0) ELSE COALESCE(valor_categoria_vidros, 0) END,
  valor_categoria_acessorios = CASE WHEN categoria = 'acessorios' AND COALESCE(valor_categoria_perfis, 0) = 0 AND COALESCE(valor_categoria_vidros, 0) = 0 AND COALESCE(valor_categoria_acessorios, 0) = 0 AND COALESCE(valor_categoria_perdas, 0) = 0 AND COALESCE(valor_categoria_outros, 0) = 0 THEN COALESCE(valor_total, 0) ELSE COALESCE(valor_categoria_acessorios, 0) END,
  valor_categoria_perdas = CASE WHEN categoria = 'perdas' AND COALESCE(valor_categoria_perfis, 0) = 0 AND COALESCE(valor_categoria_vidros, 0) = 0 AND COALESCE(valor_categoria_acessorios, 0) = 0 AND COALESCE(valor_categoria_perdas, 0) = 0 AND COALESCE(valor_categoria_outros, 0) = 0 THEN COALESCE(valor_total, 0) ELSE COALESCE(valor_categoria_perdas, 0) END,
  valor_categoria_outros = CASE WHEN categoria = 'outros' AND COALESCE(valor_categoria_perfis, 0) = 0 AND COALESCE(valor_categoria_vidros, 0) = 0 AND COALESCE(valor_categoria_acessorios, 0) = 0 AND COALESCE(valor_categoria_perdas, 0) = 0 AND COALESCE(valor_categoria_outros, 0) = 0 THEN COALESCE(valor_total, 0) ELSE COALESCE(valor_categoria_outros, 0) END;
UPDATE compras
SET etapa_autorizacao = 'nenhuma'
WHERE etapa_autorizacao IS NULL OR etapa_autorizacao = '';
ALTER TABLE compras MODIFY COLUMN etapa_autorizacao ENUM('nenhuma', 'solicitada', 'liberada') DEFAULT 'nenhuma';
ALTER TABLE compras MODIFY COLUMN categoria ENUM('perfis', 'vidros', 'acessorios', 'perdas', 'outros') DEFAULT 'outros';

ALTER TABLE anexos ADD COLUMN IF NOT EXISTS nome_arquivo VARCHAR(255) NULL;
ALTER TABLE anexos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE anexos
SET nome_arquivo = COALESCE(NULLIF(nome_arquivo, ''), SUBSTRING_INDEX(arquivo_url, '/', -1), 'anexo')
WHERE nome_arquivo IS NULL OR nome_arquivo = '';

UPDATE anexos
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;
