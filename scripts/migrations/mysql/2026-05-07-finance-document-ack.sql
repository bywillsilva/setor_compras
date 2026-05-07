ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS documentos_financeiro_confirmados_em DATE NULL AFTER aprovado_financeiro_por,
  ADD COLUMN IF NOT EXISTS documentos_financeiro_confirmados_por VARCHAR(255) NULL AFTER documentos_financeiro_confirmados_em;
