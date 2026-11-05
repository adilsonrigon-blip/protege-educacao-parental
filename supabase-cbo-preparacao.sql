-- Executar após a migração de profissionais internacionais (tabela public.profissoes).
-- A CBO oficial usa códigos de ocupação de 6 dígitos. Preserva profissões já cadastradas.
ALTER TABLE public.profissoes ADD COLUMN IF NOT EXISTS codigo_cbo text;
CREATE UNIQUE INDEX IF NOT EXISTS profissoes_codigo_cbo_unico ON public.profissoes(codigo_cbo) WHERE codigo_cbo IS NOT NULL;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS profissoes_nome_busca_idx ON public.profissoes USING gin (nome gin_trgm_ops);
-- A linha anterior exige pg_trgm; executar primeiro:
