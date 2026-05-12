DROP TABLE IF EXISTS anexos CASCADE;
DROP TABLE IF EXISTS historico_compras CASCADE;
DROP TABLE IF EXISTS compras CASCADE;
DROP TABLE IF EXISTS propostas CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP FUNCTION IF EXISTS validate_setor_compras_schema();
DROP FUNCTION IF EXISTS update_updated_at_column();

CREATE TABLE clientes (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  documento VARCHAR(20) NULL,
  contato VARCHAR(100) NULL,
  email VARCHAR(255) NULL,
  arquivado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usuarios (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  perfil TEXT NOT NULL DEFAULT 'comprador' CHECK (perfil IN ('admin', 'comprador', 'orcamentista', 'solicitante', 'financeiro')),
  tema_preferido TEXT NOT NULL DEFAULT 'claro' CHECK (tema_preferido IN ('claro', 'escuro')),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE propostas (
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

CREATE TABLE compras (
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

CREATE TABLE historico_compras (
  id BIGSERIAL PRIMARY KEY,
  compra_id BIGINT NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  evento VARCHAR(500) NOT NULL,
  data TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  usuario VARCHAR(100) DEFAULT 'Sistema'
);

CREATE TABLE anexos (
  id BIGSERIAL PRIMARY KEY,
  compra_id BIGINT NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'outro' CHECK (tipo IN ('cotacao', 'nf', 'boleto', 'outro')),
  arquivo_url VARCHAR(500) NOT NULL,
  nome_arquivo VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION validate_setor_compras_schema()
RETURNS JSONB AS $$
DECLARE
  issues TEXT[] := ARRAY[]::TEXT[];
  usuarios_perfil_def TEXT;
  compras_categoria_def TEXT;
  compras_etapa_def TEXT;
  compras_status_def TEXT;
  compras_status_entrega_def TEXT;
  anexos_tipo_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO usuarios_perfil_def FROM pg_constraint WHERE conname = 'usuarios_perfil_check' LIMIT 1;
  SELECT pg_get_constraintdef(oid) INTO compras_categoria_def FROM pg_constraint WHERE conname = 'compras_categoria_check' LIMIT 1;
  SELECT pg_get_constraintdef(oid) INTO compras_etapa_def FROM pg_constraint WHERE conname = 'compras_etapa_autorizacao_check' LIMIT 1;
  SELECT pg_get_constraintdef(oid) INTO compras_status_def FROM pg_constraint WHERE conname = 'compras_status_check' LIMIT 1;
  SELECT pg_get_constraintdef(oid) INTO compras_status_entrega_def FROM pg_constraint WHERE conname = 'compras_status_entrega_check' LIMIT 1;
  SELECT pg_get_constraintdef(oid) INTO anexos_tipo_def FROM pg_constraint WHERE conname = 'anexos_tipo_check' LIMIT 1;

  IF usuarios_perfil_def IS NULL OR usuarios_perfil_def NOT ILIKE '%admin%' OR usuarios_perfil_def NOT ILIKE '%comprador%' OR usuarios_perfil_def NOT ILIKE '%orcamentista%' THEN
    issues := array_append(issues, 'usuarios.perfil:constraint');
  END IF;

  IF compras_categoria_def IS NULL OR compras_categoria_def NOT ILIKE '%perfis%' OR compras_categoria_def NOT ILIKE '%vidros%' OR compras_categoria_def NOT ILIKE '%acessorios%' OR compras_categoria_def NOT ILIKE '%perdas%' OR compras_categoria_def NOT ILIKE '%outros%' THEN
    issues := array_append(issues, 'compras.categoria:constraint');
  END IF;

  IF compras_etapa_def IS NULL OR compras_etapa_def NOT ILIKE '%nenhuma%' OR compras_etapa_def NOT ILIKE '%solicitada%' OR compras_etapa_def NOT ILIKE '%liberada%' THEN
    issues := array_append(issues, 'compras.etapa_autorizacao:constraint');
  END IF;

  IF compras_status_def IS NULL OR compras_status_def NOT ILIKE '%cotacao%' OR compras_status_def NOT ILIKE '%em_analise%' OR compras_status_def NOT ILIKE '%retificacao%' OR compras_status_def NOT ILIKE '%pedido_autorizado%' THEN
    issues := array_append(issues, 'compras.status:constraint');
  END IF;

  IF compras_status_entrega_def IS NULL OR compras_status_entrega_def NOT ILIKE '%pendente%' OR compras_status_entrega_def NOT ILIKE '%entregue%' THEN
    issues := array_append(issues, 'compras.status_entrega:constraint');
  END IF;

  IF anexos_tipo_def IS NULL OR anexos_tipo_def NOT ILIKE '%cotacao%' OR anexos_tipo_def NOT ILIKE '%nf%' OR anexos_tipo_def NOT ILIKE '%boleto%' OR anexos_tipo_def NOT ILIKE '%outro%' THEN
    issues := array_append(issues, 'anexos.tipo:constraint');
  END IF;

  RETURN jsonb_build_object('missing_items', issues);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON clientes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usuarios_updated_at
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_propostas_updated_at
BEFORE UPDATE ON propostas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compras_updated_at
BEFORE UPDATE ON compras
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
