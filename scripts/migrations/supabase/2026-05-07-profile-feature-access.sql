CREATE TABLE IF NOT EXISTS public.perfil_permissoes (
  id BIGSERIAL PRIMARY KEY,
  perfil TEXT NOT NULL,
  feature TEXT NOT NULL,
  permitido BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_perfil_permissoes_unique
  ON public.perfil_permissoes (perfil, feature);
