CREATE TABLE IF NOT EXISTS resumos_contratos (
  id BIGSERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  periodo_referencia CHAR(7) NOT NULL,
  created_by_user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_by_nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resumo_contrato_itens (
  id BIGSERIAL PRIMARY KEY,
  resumo_id BIGINT NOT NULL REFERENCES resumos_contratos(id) ON DELETE CASCADE,
  proposta_id BIGINT NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  valor_contrato NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ordem INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resumos_contratos_periodo ON resumos_contratos (periodo_referencia);
CREATE INDEX IF NOT EXISTS idx_resumo_contrato_itens_resumo ON resumo_contrato_itens (resumo_id);
