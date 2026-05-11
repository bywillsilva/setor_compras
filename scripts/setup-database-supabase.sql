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

CREATE TABLE IF NOT EXISTS perfil_permissoes (
  id BIGSERIAL PRIMARY KEY,
  perfil TEXT NOT NULL,
  feature TEXT NOT NULL,
  permitido BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_perfil_permissoes_unique
  ON perfil_permissoes (perfil, feature);

CREATE TABLE IF NOT EXISTS usuario_permissoes (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  permitido BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_permissoes_unique
  ON usuario_permissoes (usuario_id, feature);

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

CREATE TABLE IF NOT EXISTS solicitacoes_sensiveis (
  id BIGSERIAL PRIMARY KEY,
  entidade TEXT NOT NULL CHECK (entidade IN ('cliente', 'proposta', 'compra')),
  entidade_id BIGINT NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('editar', 'excluir')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'recusada')),
  motivo TEXT NULL,
  payload JSONB NULL,
  solicitante_id BIGINT NOT NULL,
  solicitante_nome TEXT NOT NULL,
  solicitante_perfil TEXT NOT NULL,
  aprovado_por TEXT NULL,
  aprovado_em TIMESTAMPTZ NULL,
  recusado_por TEXT NULL,
  recusado_em TIMESTAMPTZ NULL,
  observacao_admin TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
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
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS motivo TEXT;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS aprovado_por TEXT;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS recusado_por TEXT;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS recusado_em TIMESTAMPTZ;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS observacao_admin TEXT;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

INSERT INTO usuario_permissoes (usuario_id, feature, permitido)
SELECT usuarios.id, perfil_permissoes.feature, TRUE
FROM usuarios
JOIN perfil_permissoes
  ON perfil_permissoes.perfil = usuarios.perfil
 AND perfil_permissoes.permitido = TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM usuario_permissoes
  WHERE usuario_permissoes.usuario_id = usuarios.id
);

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
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_perfil_check;
ALTER TABLE usuarios
ADD CONSTRAINT usuarios_perfil_check
CHECK (perfil IN ('admin', 'comprador', 'orcamentista'));
ALTER TABLE compras
ADD CONSTRAINT compras_categoria_check
CHECK (categoria IN ('perfis', 'vidros', 'acessorios', 'perdas', 'outros'));

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

DROP TRIGGER IF EXISTS update_solicitacoes_sensiveis_updated_at ON solicitacoes_sensiveis;
CREATE TRIGGER update_solicitacoes_sensiveis_updated_at
BEFORE UPDATE ON solicitacoes_sensiveis
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
-- Upgrade do fluxo por etapas e assinaturas (2026-05-07)
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS solicitante_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS solicitado_por TEXT NULL,
  ADD COLUMN IF NOT EXISTS etapa_fluxo TEXT DEFAULT 'solicitacao_registrada',
  ADD COLUMN IF NOT EXISTS cotacao_enviada_por TEXT NULL,
  ADD COLUMN IF NOT EXISTS cotacao_recebida_em DATE NULL,
  ADD COLUMN IF NOT EXISTS cotacao_recebida_por TEXT NULL,
  ADD COLUMN IF NOT EXISTS aprovado_solicitante_em DATE NULL,
  ADD COLUMN IF NOT EXISTS aprovado_solicitante_por TEXT NULL,
  ADD COLUMN IF NOT EXISTS aprovado_admin_em DATE NULL,
  ADD COLUMN IF NOT EXISTS aprovado_admin_por TEXT NULL,
  ADD COLUMN IF NOT EXISTS aprovado_financeiro_em DATE NULL,
  ADD COLUMN IF NOT EXISTS aprovado_financeiro_por TEXT NULL,
  ADD COLUMN IF NOT EXISTS documentos_financeiro_confirmados_em DATE NULL,
  ADD COLUMN IF NOT EXISTS documentos_financeiro_confirmados_por TEXT NULL,
  ADD COLUMN IF NOT EXISTS confirmado_fornecedor_em DATE NULL,
  ADD COLUMN IF NOT EXISTS confirmado_fornecedor_por TEXT NULL;

UPDATE public.compras
SET etapa_fluxo = CASE
  WHEN status = 'pedido_autorizado' THEN 'pedido_autorizado'
  WHEN etapa_autorizacao = 'liberada' THEN 'liberada_para_fornecedor'
  WHEN etapa_autorizacao = 'solicitada' THEN 'aguardando_admin'
  WHEN status = 'retificacao' THEN 'retificacao'
  WHEN data_envio_fornecedor IS NOT NULL THEN 'cotacao_em_andamento'
  ELSE 'solicitacao_registrada'
END
WHERE etapa_fluxo IS NULL OR etapa_fluxo = '';

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_perfil_check;
ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_perfil_check
  CHECK (perfil IN ('admin', 'comprador', 'orcamentista', 'solicitante', 'financeiro'));

ALTER TABLE public.compras DROP CONSTRAINT IF EXISTS compras_etapa_fluxo_check;
ALTER TABLE public.compras
  ADD CONSTRAINT compras_etapa_fluxo_check
  CHECK (etapa_fluxo IN (
    'solicitacao_registrada',
    'cotacao_em_andamento',
    'analise_solicitante',
    'retificacao',
    'aprovada_solicitante',
    'aguardando_admin',
    'aprovada_admin',
    'aguardando_financeiro',
    'liberada_para_fornecedor',
    'pedido_autorizado'
  ));

CREATE OR REPLACE FUNCTION public.validate_setor_compras_schema()
RETURNS JSONB AS $$
DECLARE
  issues TEXT[] := ARRAY[]::TEXT[];
  usuarios_perfil_def TEXT;
  compras_etapa_fluxo_def TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'etapa_fluxo') THEN
    issues := array_append(issues, 'compras.etapa_fluxo');
  END IF;

  SELECT pg_get_constraintdef(oid) INTO usuarios_perfil_def FROM pg_constraint WHERE conname = 'usuarios_perfil_check' LIMIT 1;
  SELECT pg_get_constraintdef(oid) INTO compras_etapa_fluxo_def FROM pg_constraint WHERE conname = 'compras_etapa_fluxo_check' LIMIT 1;

  IF usuarios_perfil_def IS NULL OR usuarios_perfil_def NOT ILIKE '%solicitante%' OR usuarios_perfil_def NOT ILIKE '%financeiro%' THEN
    issues := array_append(issues, 'usuarios.perfil:constraint');
  END IF;

  IF compras_etapa_fluxo_def IS NULL OR compras_etapa_fluxo_def NOT ILIKE '%aprovada_admin%' OR compras_etapa_fluxo_def NOT ILIKE '%aguardando_financeiro%' OR compras_etapa_fluxo_def NOT ILIKE '%liberada_para_fornecedor%' THEN
    issues := array_append(issues, 'compras.etapa_fluxo:constraint');
  END IF;

  RETURN jsonb_build_object('missing_items', issues);
END;
$$ LANGUAGE plpgsql;
