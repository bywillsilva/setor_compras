ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;

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
SET etapa_autorizacao = 'nenhuma'
WHERE etapa_autorizacao IS NULL OR etapa_autorizacao = '';

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

ALTER TABLE public.compras DROP CONSTRAINT IF EXISTS compras_etapa_autorizacao_check;
ALTER TABLE public.compras
  ADD CONSTRAINT compras_etapa_autorizacao_check
  CHECK (etapa_autorizacao IN ('nenhuma', 'solicitada', 'liberada'));

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
  compras_categoria_def TEXT;
  compras_etapa_autorizacao_def TEXT;
  compras_etapa_fluxo_def TEXT;
  compras_status_def TEXT;
  compras_status_entrega_def TEXT;
  anexos_tipo_def TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'solicitante_id') THEN
    issues := array_append(issues, 'compras.solicitante_id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'solicitado_por') THEN
    issues := array_append(issues, 'compras.solicitado_por');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'etapa_fluxo') THEN
    issues := array_append(issues, 'compras.etapa_fluxo');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'cotacao_enviada_por') THEN
    issues := array_append(issues, 'compras.cotacao_enviada_por');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'cotacao_recebida_em') THEN
    issues := array_append(issues, 'compras.cotacao_recebida_em');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'cotacao_recebida_por') THEN
    issues := array_append(issues, 'compras.cotacao_recebida_por');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'aprovado_solicitante_em') THEN
    issues := array_append(issues, 'compras.aprovado_solicitante_em');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'aprovado_solicitante_por') THEN
    issues := array_append(issues, 'compras.aprovado_solicitante_por');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'aprovado_admin_em') THEN
    issues := array_append(issues, 'compras.aprovado_admin_em');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'aprovado_admin_por') THEN
    issues := array_append(issues, 'compras.aprovado_admin_por');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'aprovado_financeiro_em') THEN
    issues := array_append(issues, 'compras.aprovado_financeiro_em');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'aprovado_financeiro_por') THEN
    issues := array_append(issues, 'compras.aprovado_financeiro_por');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'confirmado_fornecedor_em') THEN
    issues := array_append(issues, 'compras.confirmado_fornecedor_em');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compras' AND column_name = 'confirmado_fornecedor_por') THEN
    issues := array_append(issues, 'compras.confirmado_fornecedor_por');
  END IF;

  SELECT pg_get_constraintdef(oid) INTO usuarios_perfil_def FROM pg_constraint WHERE conname = 'usuarios_perfil_check' LIMIT 1;
  SELECT pg_get_constraintdef(oid) INTO compras_categoria_def FROM pg_constraint WHERE conname = 'compras_categoria_check' LIMIT 1;
  SELECT pg_get_constraintdef(oid) INTO compras_etapa_autorizacao_def FROM pg_constraint WHERE conname = 'compras_etapa_autorizacao_check' LIMIT 1;
  SELECT pg_get_constraintdef(oid) INTO compras_etapa_fluxo_def FROM pg_constraint WHERE conname = 'compras_etapa_fluxo_check' LIMIT 1;
  SELECT pg_get_constraintdef(oid) INTO compras_status_def FROM pg_constraint WHERE conname = 'compras_status_check' LIMIT 1;
  SELECT pg_get_constraintdef(oid) INTO compras_status_entrega_def FROM pg_constraint WHERE conname = 'compras_status_entrega_check' LIMIT 1;
  SELECT pg_get_constraintdef(oid) INTO anexos_tipo_def FROM pg_constraint WHERE conname = 'anexos_tipo_check' LIMIT 1;

  IF usuarios_perfil_def IS NULL OR usuarios_perfil_def NOT ILIKE '%solicitante%' OR usuarios_perfil_def NOT ILIKE '%financeiro%' THEN
    issues := array_append(issues, 'usuarios.perfil:constraint');
  END IF;

  IF compras_categoria_def IS NULL OR compras_categoria_def NOT ILIKE '%perdas%' OR compras_categoria_def NOT ILIKE '%outros%' THEN
    issues := array_append(issues, 'compras.categoria:constraint');
  END IF;

  IF compras_etapa_autorizacao_def IS NULL OR compras_etapa_autorizacao_def NOT ILIKE '%nenhuma%' OR compras_etapa_autorizacao_def NOT ILIKE '%liberada%' THEN
    issues := array_append(issues, 'compras.etapa_autorizacao:constraint');
  END IF;

  IF compras_etapa_fluxo_def IS NULL OR compras_etapa_fluxo_def NOT ILIKE '%aprovada_admin%' OR compras_etapa_fluxo_def NOT ILIKE '%aguardando_financeiro%' OR compras_etapa_fluxo_def NOT ILIKE '%liberada_para_fornecedor%' THEN
    issues := array_append(issues, 'compras.etapa_fluxo:constraint');
  END IF;

  IF compras_status_def IS NULL OR compras_status_def NOT ILIKE '%pedido_autorizado%' THEN
    issues := array_append(issues, 'compras.status:constraint');
  END IF;

  IF compras_status_entrega_def IS NULL OR compras_status_entrega_def NOT ILIKE '%pendente%' OR compras_status_entrega_def NOT ILIKE '%entregue%' THEN
    issues := array_append(issues, 'compras.status_entrega:constraint');
  END IF;

  IF anexos_tipo_def IS NULL OR anexos_tipo_def NOT ILIKE '%cotacao%' OR anexos_tipo_def NOT ILIKE '%outro%' THEN
    issues := array_append(issues, 'anexos.tipo:constraint');
  END IF;

  RETURN jsonb_build_object('missing_items', issues);
END;
$$ LANGUAGE plpgsql;
