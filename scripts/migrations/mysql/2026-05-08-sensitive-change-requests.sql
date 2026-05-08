CREATE TABLE IF NOT EXISTS solicitacoes_sensiveis (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  entidade ENUM('cliente', 'proposta', 'compra') NOT NULL,
  entidade_id BIGINT NOT NULL,
  acao ENUM('editar', 'excluir') NOT NULL,
  status ENUM('pendente', 'aprovada', 'recusada') NOT NULL DEFAULT 'pendente',
  motivo TEXT NULL,
  payload JSON NULL,
  solicitante_id BIGINT NOT NULL,
  solicitante_nome VARCHAR(255) NOT NULL,
  solicitante_perfil ENUM('admin', 'comprador', 'orcamentista', 'solicitante', 'financeiro') NOT NULL,
  aprovado_por VARCHAR(255) NULL,
  aprovado_em TIMESTAMP NULL,
  recusado_por VARCHAR(255) NULL,
  recusado_em TIMESTAMP NULL,
  observacao_admin TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS motivo TEXT NULL;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS payload JSON NULL;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS aprovado_por VARCHAR(255) NULL;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMP NULL;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS recusado_por VARCHAR(255) NULL;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS recusado_em TIMESTAMP NULL;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS observacao_admin TEXT NULL;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
