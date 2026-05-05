CREATE TABLE IF NOT EXISTS clientes (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  documento VARCHAR(20) NULL,
  contato VARCHAR(100) NULL,
  email VARCHAR(255) NULL,
  arquivado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  perfil TEXT NOT NULL DEFAULT 'comprador' CHECK (perfil IN ('admin', 'comprador', 'orcamentista')),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS propostas (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  data_inicio DATE NULL,
  data_fim DATE NULL,
  valor_previsto NUMERIC(15, 2) DEFAULT 0,
  valor_previsto_perfis NUMERIC(15, 2) DEFAULT 0,
  valor_previsto_vidros NUMERIC(15, 2) DEFAULT 0,
  valor_previsto_acessorios NUMERIC(15, 2) DEFAULT 0,
  valor_previsto_outros NUMERIC(15, 2) DEFAULT 0,
  custo_perdas NUMERIC(15, 2) DEFAULT 0,
  arquivado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compras (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  proposta_id BIGINT NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'outros' CHECK (categoria IN ('perfis', 'vidros', 'acessorios', 'perdas', 'outros')),
  fornecedor VARCHAR(255) NOT NULL,
  descricao TEXT NOT NULL,
  valor_total NUMERIC(15, 2) NULL,
  valor_categoria_perfis NUMERIC(15, 2) DEFAULT 0,
  valor_categoria_vidros NUMERIC(15, 2) DEFAULT 0,
  valor_categoria_acessorios NUMERIC(15, 2) DEFAULT 0,
  valor_categoria_perdas NUMERIC(15, 2) DEFAULT 0,
  valor_categoria_outros NUMERIC(15, 2) DEFAULT 0,
  numero_pedido VARCHAR(100) NULL,
  status TEXT NOT NULL DEFAULT 'cotacao' CHECK (status IN ('cotacao', 'em_analise', 'retificacao', 'pedido_autorizado')),
  status_entrega TEXT NOT NULL DEFAULT 'pendente' CHECK (status_entrega IN ('pendente', 'entregue')),
  etapa_autorizacao TEXT NOT NULL DEFAULT 'nenhuma' CHECK (etapa_autorizacao IN ('nenhuma', 'solicitada', 'liberada')),
  previsao_entrega DATE NULL,
  data_envio_fornecedor DATE NULL,
  data_entrega_real DATE NULL,
  data_criacao TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  arquivado BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS historico_compras (
  id BIGSERIAL PRIMARY KEY,
  compra_id BIGINT NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  evento VARCHAR(500) NOT NULL,
  data TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  usuario VARCHAR(100) DEFAULT 'Sistema'
);

CREATE TABLE IF NOT EXISTS anexos (
  id BIGSERIAL PRIMARY KEY,
  compra_id BIGINT NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'outro' CHECK (tipo IN ('cotacao', 'nf', 'boleto', 'outro')),
  arquivo_url VARCHAR(500) NOT NULL,
  nome_arquivo VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_perfis NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_vidros NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_acessorios NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_perdas NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_outros NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS etapa_autorizacao TEXT DEFAULT 'nenhuma';
ALTER TABLE anexos ADD COLUMN IF NOT EXISTS nome_arquivo VARCHAR(255);
ALTER TABLE anexos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE compras DROP CONSTRAINT IF EXISTS compras_categoria_check;
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
ALTER TABLE compras ALTER COLUMN categoria SET DEFAULT 'outros';
UPDATE compras
SET etapa_autorizacao = 'nenhuma'
WHERE etapa_autorizacao IS NULL OR etapa_autorizacao = '';
ALTER TABLE compras ALTER COLUMN etapa_autorizacao SET DEFAULT 'nenhuma';
ALTER TABLE compras ALTER COLUMN etapa_autorizacao SET NOT NULL;
ALTER TABLE compras DROP CONSTRAINT IF EXISTS compras_etapa_autorizacao_check;
ALTER TABLE compras
ADD CONSTRAINT compras_etapa_autorizacao_check
CHECK (etapa_autorizacao IN ('nenhuma', 'solicitada', 'liberada'));
ALTER TABLE compras
ADD CONSTRAINT compras_categoria_check
CHECK (categoria IN ('perfis', 'vidros', 'acessorios', 'perdas', 'outros'));

UPDATE anexos
SET nome_arquivo = COALESCE(NULLIF(nome_arquivo, ''), regexp_replace(split_part(arquivo_url, '?', 1), '^.*/', ''), 'anexo')
WHERE nome_arquivo IS NULL OR nome_arquivo = '';

UPDATE anexos
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;

ALTER TABLE anexos ALTER COLUMN nome_arquivo SET NOT NULL;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON clientes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_propostas_updated_at ON propostas;
CREATE TRIGGER update_propostas_updated_at
BEFORE UPDATE ON propostas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_compras_updated_at ON compras;
CREATE TRIGGER update_compras_updated_at
BEFORE UPDATE ON compras
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
