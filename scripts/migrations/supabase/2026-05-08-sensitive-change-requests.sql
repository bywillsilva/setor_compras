CREATE TABLE IF NOT EXISTS public.solicitacoes_sensiveis (
  id BIGSERIAL PRIMARY KEY,
  entidade TEXT NOT NULL,
  entidade_id BIGINT NOT NULL,
  acao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
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

ALTER TABLE public.solicitacoes_sensiveis
  ADD COLUMN IF NOT EXISTS motivo TEXT NULL,
  ADD COLUMN IF NOT EXISTS payload JSONB NULL,
  ADD COLUMN IF NOT EXISTS aprovado_por TEXT NULL,
  ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS recusado_por TEXT NULL,
  ADD COLUMN IF NOT EXISTS recusado_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS observacao_admin TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.solicitacoes_sensiveis DROP CONSTRAINT IF EXISTS solicitacoes_sensiveis_entidade_check;
ALTER TABLE public.solicitacoes_sensiveis
  ADD CONSTRAINT solicitacoes_sensiveis_entidade_check
  CHECK (entidade IN ('cliente', 'proposta', 'compra'));

ALTER TABLE public.solicitacoes_sensiveis DROP CONSTRAINT IF EXISTS solicitacoes_sensiveis_acao_check;
ALTER TABLE public.solicitacoes_sensiveis
  ADD CONSTRAINT solicitacoes_sensiveis_acao_check
  CHECK (acao IN ('editar', 'excluir'));

ALTER TABLE public.solicitacoes_sensiveis DROP CONSTRAINT IF EXISTS solicitacoes_sensiveis_status_check;
ALTER TABLE public.solicitacoes_sensiveis
  ADD CONSTRAINT solicitacoes_sensiveis_status_check
  CHECK (status IN ('pendente', 'aprovada', 'recusada'));

DROP TRIGGER IF EXISTS update_solicitacoes_sensiveis_updated_at ON public.solicitacoes_sensiveis;
CREATE TRIGGER update_solicitacoes_sensiveis_updated_at
BEFORE UPDATE ON public.solicitacoes_sensiveis
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
