ALTER TABLE usuarios
  MODIFY COLUMN perfil ENUM('admin', 'comprador', 'orcamentista', 'solicitante', 'financeiro') DEFAULT 'comprador';

ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS solicitante_id INT NULL AFTER proposta_id,
  ADD COLUMN IF NOT EXISTS solicitado_por VARCHAR(255) NULL AFTER solicitante_id,
  ADD COLUMN IF NOT EXISTS etapa_fluxo ENUM(
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
  ) DEFAULT 'solicitacao_registrada' AFTER etapa_autorizacao,
  ADD COLUMN IF NOT EXISTS cotacao_enviada_por VARCHAR(255) NULL AFTER data_envio_fornecedor,
  ADD COLUMN IF NOT EXISTS cotacao_recebida_em DATE NULL AFTER cotacao_enviada_por,
  ADD COLUMN IF NOT EXISTS cotacao_recebida_por VARCHAR(255) NULL AFTER cotacao_recebida_em,
  ADD COLUMN IF NOT EXISTS aprovado_solicitante_em DATE NULL AFTER cotacao_recebida_por,
  ADD COLUMN IF NOT EXISTS aprovado_solicitante_por VARCHAR(255) NULL AFTER aprovado_solicitante_em,
  ADD COLUMN IF NOT EXISTS aprovado_admin_em DATE NULL AFTER aprovado_solicitante_por,
  ADD COLUMN IF NOT EXISTS aprovado_admin_por VARCHAR(255) NULL AFTER aprovado_admin_em,
  ADD COLUMN IF NOT EXISTS aprovado_financeiro_em DATE NULL AFTER aprovado_admin_por,
  ADD COLUMN IF NOT EXISTS aprovado_financeiro_por VARCHAR(255) NULL AFTER aprovado_financeiro_em,
  ADD COLUMN IF NOT EXISTS documentos_financeiro_confirmados_em DATE NULL AFTER aprovado_financeiro_por,
  ADD COLUMN IF NOT EXISTS documentos_financeiro_confirmados_por VARCHAR(255) NULL AFTER documentos_financeiro_confirmados_em,
  ADD COLUMN IF NOT EXISTS confirmado_fornecedor_em DATE NULL AFTER documentos_financeiro_confirmados_por,
  ADD COLUMN IF NOT EXISTS confirmado_fornecedor_por VARCHAR(255) NULL AFTER confirmado_fornecedor_em;

UPDATE compras
SET etapa_autorizacao = 'nenhuma'
WHERE etapa_autorizacao IS NULL OR etapa_autorizacao = '';

UPDATE compras
SET etapa_fluxo = CASE
  WHEN status = 'pedido_autorizado' THEN 'pedido_autorizado'
  WHEN etapa_autorizacao = 'liberada' THEN 'liberada_para_fornecedor'
  WHEN etapa_autorizacao = 'solicitada' THEN 'aguardando_admin'
  WHEN status = 'retificacao' THEN 'retificacao'
  WHEN data_envio_fornecedor IS NOT NULL THEN 'cotacao_em_andamento'
  ELSE 'solicitacao_registrada'
END
WHERE etapa_fluxo IS NULL OR etapa_fluxo = '';

ALTER TABLE compras
  MODIFY COLUMN etapa_autorizacao ENUM('nenhuma', 'solicitada', 'liberada') DEFAULT 'nenhuma',
  MODIFY COLUMN etapa_fluxo ENUM(
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
  ) DEFAULT 'solicitacao_registrada',
  MODIFY COLUMN categoria ENUM('perfis', 'vidros', 'acessorios', 'perdas', 'outros') DEFAULT 'outros';
