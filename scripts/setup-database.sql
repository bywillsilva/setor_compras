CREATE TABLE IF NOT EXISTS clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  documento VARCHAR(20) NULL,
  contato VARCHAR(100) NULL,
  email VARCHAR(255) NULL,
  arquivado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  perfil ENUM('admin', 'comprador', 'orcamentista', 'solicitante', 'financeiro') DEFAULT 'comprador',
  tema_preferido ENUM('claro', 'escuro') NOT NULL DEFAULT 'claro',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS perfil_permissoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  perfil VARCHAR(40) NOT NULL,
  feature VARCHAR(80) NOT NULL,
  permitido BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_perfil_feature (perfil, feature)
);

CREATE TABLE IF NOT EXISTS usuario_permissoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  feature VARCHAR(80) NOT NULL,
  permitido BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuario_feature (usuario_id, feature),
  CONSTRAINT fk_usuario_permissoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS propostas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  nome VARCHAR(255) NOT NULL,
  data_inicio DATE NULL,
  data_fim DATE NULL,
  valor_previsto DECIMAL(15, 2) DEFAULT 0,
  valor_previsto_perfis DECIMAL(15, 2) DEFAULT 0,
  valor_previsto_vidros DECIMAL(15, 2) DEFAULT 0,
  valor_previsto_acessorios DECIMAL(15, 2) DEFAULT 0,
  valor_previsto_outros DECIMAL(15, 2) DEFAULT 0,
  custo_perdas DECIMAL(15, 2) DEFAULT 0,
  arquivado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_propostas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS compras (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  proposta_id INT NOT NULL,
  categoria ENUM('perfis', 'vidros', 'acessorios', 'perdas', 'outros') DEFAULT 'outros',
  fornecedor VARCHAR(255) NOT NULL,
  descricao TEXT NOT NULL,
  valor_total DECIMAL(15, 2) NULL,
  valor_categoria_perfis DECIMAL(15, 2) DEFAULT 0,
  valor_categoria_vidros DECIMAL(15, 2) DEFAULT 0,
  valor_categoria_acessorios DECIMAL(15, 2) DEFAULT 0,
  valor_categoria_perdas DECIMAL(15, 2) DEFAULT 0,
  valor_categoria_outros DECIMAL(15, 2) DEFAULT 0,
  numero_pedido VARCHAR(100) NULL,
  status ENUM('cotacao', 'em_analise', 'retificacao', 'pedido_autorizado') DEFAULT 'cotacao',
  status_entrega ENUM('pendente', 'entregue') DEFAULT 'pendente',
  etapa_autorizacao ENUM('nenhuma', 'solicitada', 'liberada') DEFAULT 'nenhuma',
  previsao_entrega DATE NULL,
  data_envio_fornecedor DATE NULL,
  data_entrega_real DATE NULL,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  arquivado BOOLEAN DEFAULT FALSE,
  CONSTRAINT fk_compras_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_compras_proposta FOREIGN KEY (proposta_id) REFERENCES propostas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS historico_compras (
  id INT AUTO_INCREMENT PRIMARY KEY,
  compra_id INT NOT NULL,
  evento VARCHAR(500) NOT NULL,
  data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  usuario VARCHAR(100) DEFAULT 'Sistema',
  CONSTRAINT fk_historico_compra FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS anexos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  compra_id INT NOT NULL,
  tipo ENUM('cotacao', 'nf', 'boleto', 'outro') DEFAULT 'outro',
  arquivo_url VARCHAR(500) NOT NULL,
  nome_arquivo VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_anexos_compra FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE
);

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

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_perfis DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_vidros DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_acessorios DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_perdas DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_categoria_outros DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS etapa_autorizacao ENUM('nenhuma', 'solicitada', 'liberada') DEFAULT 'nenhuma';
ALTER TABLE anexos ADD COLUMN IF NOT EXISTS nome_arquivo VARCHAR(255) NULL;
ALTER TABLE anexos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS motivo TEXT NULL;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS payload JSON NULL;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS aprovado_por VARCHAR(255) NULL;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMP NULL;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS recusado_por VARCHAR(255) NULL;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS recusado_em TIMESTAMP NULL;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS observacao_admin TEXT NULL;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE solicitacoes_sensiveis ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

INSERT INTO usuario_permissoes (usuario_id, feature, permitido)
SELECT usuarios.id, perfil_permissoes.feature, 1
FROM usuarios
JOIN perfil_permissoes
  ON perfil_permissoes.perfil = usuarios.perfil
 AND perfil_permissoes.permitido = 1
LEFT JOIN usuario_permissoes
  ON usuario_permissoes.usuario_id = usuarios.id
WHERE usuario_permissoes.id IS NULL;

UPDATE anexos
SET nome_arquivo = COALESCE(NULLIF(nome_arquivo, ''), SUBSTRING_INDEX(arquivo_url, '/', -1), 'anexo')
WHERE nome_arquivo IS NULL OR nome_arquivo = '';

UPDATE anexos
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;

ALTER TABLE usuarios MODIFY COLUMN perfil ENUM('admin', 'comprador', 'orcamentista') DEFAULT 'comprador';
ALTER TABLE compras MODIFY COLUMN categoria ENUM('perfis', 'vidros', 'acessorios', 'perdas', 'outros') DEFAULT 'outros';
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
UPDATE compras
SET etapa_autorizacao = 'nenhuma'
WHERE etapa_autorizacao IS NULL OR etapa_autorizacao = '';
ALTER TABLE compras MODIFY COLUMN etapa_autorizacao ENUM('nenhuma', 'solicitada', 'liberada') DEFAULT 'nenhuma';
ALTER TABLE compras MODIFY COLUMN categoria ENUM('perfis', 'vidros', 'acessorios', 'perdas', 'outros') DEFAULT 'outros';
-- Upgrade do fluxo por etapas e assinaturas (2026-05-07)
ALTER TABLE usuarios MODIFY COLUMN perfil ENUM('admin', 'comprador', 'orcamentista', 'solicitante', 'financeiro') DEFAULT 'comprador';
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
  ) DEFAULT 'solicitacao_registrada';
