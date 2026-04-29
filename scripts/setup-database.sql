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
  perfil ENUM('admin', 'comprador') DEFAULT 'comprador',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
  categoria ENUM('perfis', 'vidros', 'acessorios', 'outros') DEFAULT 'outros',
  fornecedor VARCHAR(255) NOT NULL,
  descricao TEXT NOT NULL,
  valor_total DECIMAL(15, 2) NULL,
  numero_pedido VARCHAR(100) NULL,
  status ENUM('cotacao', 'em_analise', 'retificacao', 'pedido_autorizado') DEFAULT 'cotacao',
  status_entrega ENUM('pendente', 'entregue') DEFAULT 'pendente',
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

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE anexos ADD COLUMN IF NOT EXISTS nome_arquivo VARCHAR(255) NULL;
ALTER TABLE anexos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE anexos
SET nome_arquivo = COALESCE(NULLIF(nome_arquivo, ''), SUBSTRING_INDEX(arquivo_url, '/', -1), 'anexo')
WHERE nome_arquivo IS NULL OR nome_arquivo = '';

UPDATE anexos
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;
