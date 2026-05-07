ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS documentos_financeiro_confirmados_em DATE NULL,
  ADD COLUMN IF NOT EXISTS documentos_financeiro_confirmados_por TEXT NULL;
