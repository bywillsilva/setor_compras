-- Migration incremental para bases MySQL existentes
-- Adiciona suporte a arquivamento de clientes e propostas

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS arquivado BOOLEAN DEFAULT FALSE;
