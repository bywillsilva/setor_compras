CREATE TABLE IF NOT EXISTS usuario_permissoes (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  permitido BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_permissoes_unique
  ON usuario_permissoes (usuario_id, feature);

INSERT INTO usuario_permissoes (usuario_id, feature, permitido)
SELECT usuarios.id, perfil_permissoes.feature, TRUE
FROM usuarios
JOIN perfil_permissoes
  ON perfil_permissoes.perfil = usuarios.perfil
 AND perfil_permissoes.permitido = TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM usuario_permissoes
  WHERE usuario_permissoes.usuario_id = usuarios.id
);
