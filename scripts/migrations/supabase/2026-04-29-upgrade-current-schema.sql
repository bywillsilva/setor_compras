ALTER TABLE clientes ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_perfis NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_vidros NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_acessorios NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_perdas NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_outros NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS etapa_autorizacao TEXT DEFAULT 'nenhuma';

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_perfil_check;
ALTER TABLE usuarios
ADD CONSTRAINT usuarios_perfil_check
CHECK (perfil IN ('admin', 'comprador', 'orcamentista'));

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

ALTER TABLE anexos ADD COLUMN IF NOT EXISTS nome_arquivo VARCHAR(255);
ALTER TABLE anexos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

UPDATE anexos
SET nome_arquivo = COALESCE(NULLIF(nome_arquivo, ''), regexp_replace(split_part(arquivo_url, '?', 1), '^.*/', ''), 'anexo')
WHERE nome_arquivo IS NULL OR nome_arquivo = '';

UPDATE anexos
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;

ALTER TABLE anexos ALTER COLUMN nome_arquivo SET NOT NULL;
