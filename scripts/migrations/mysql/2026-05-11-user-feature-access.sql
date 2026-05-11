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

INSERT INTO usuario_permissoes (usuario_id, feature, permitido)
SELECT usuarios.id, perfil_permissoes.feature, 1
FROM usuarios
JOIN perfil_permissoes
  ON perfil_permissoes.perfil = usuarios.perfil
 AND perfil_permissoes.permitido = 1
LEFT JOIN usuario_permissoes
  ON usuario_permissoes.usuario_id = usuarios.id
WHERE usuario_permissoes.id IS NULL;
