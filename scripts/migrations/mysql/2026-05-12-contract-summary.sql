CREATE TABLE IF NOT EXISTS resumos_contratos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  periodo_referencia CHAR(7) NOT NULL,
  created_by_user_id BIGINT NOT NULL,
  created_by_nome VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resumo_contrato_itens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  resumo_id BIGINT NOT NULL,
  proposta_id BIGINT NOT NULL,
  cliente_id BIGINT NOT NULL,
  valor_contrato DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ordem INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_resumo_contrato_itens_resumo FOREIGN KEY (resumo_id) REFERENCES resumos_contratos(id) ON DELETE CASCADE,
  CONSTRAINT fk_resumo_contrato_itens_proposta FOREIGN KEY (proposta_id) REFERENCES propostas(id) ON DELETE CASCADE,
  CONSTRAINT fk_resumo_contrato_itens_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

CREATE INDEX idx_resumos_contratos_periodo ON resumos_contratos (periodo_referencia);
CREATE INDEX idx_resumo_contrato_itens_resumo ON resumo_contrato_itens (resumo_id);
