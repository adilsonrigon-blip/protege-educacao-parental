-- Proteje: executar em ambiente de homologação e revisar antes da produção.
create table if not exists public.profissoes (id uuid primary key default gen_random_uuid(),nome text not null unique,ativo boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.profissoes enable row level security;
drop policy if exists profissoes_leitura_ativas on public.profissoes;
create policy profissoes_leitura_ativas on public.profissoes for select to anon,authenticated using (ativo or exists(select 1 from public.usuarios_perfis up where up.user_id=auth.uid() and up.perfil='admin' and up.ativo));
-- Escrita de profissões exclusivamente por administradores autenticados.
drop policy if exists profissoes_admin_insert on public.profissoes;
create policy profissoes_admin_insert on public.profissoes for insert to authenticated with check (exists(select 1 from public.usuarios_perfis up where up.user_id=auth.uid() and up.perfil='admin' and up.ativo));
drop policy if exists profissoes_admin_update on public.profissoes;
create policy profissoes_admin_update on public.profissoes for update to authenticated using (exists(select 1 from public.usuarios_perfis up where up.user_id=auth.uid() and up.perfil='admin' and up.ativo)) with check (exists(select 1 from public.usuarios_perfis up where up.user_id=auth.uid() and up.perfil='admin' and up.ativo));
insert into public.profissoes(nome) values ('Educação Parental'),('Fonoaudiologia'),('Pedagogia'),('Psicologia'),('Psicopedagogia') on conflict (nome) do nothing;
alter table public.profissionais add column if not exists pais text not null default 'BR';
alter table public.profissionais add column if not exists tipo_documento text not null default 'cpf';
alter table public.profissionais add column if not exists numero_documento text;
alter table public.profissionais alter column cpf drop not null;
alter table public.profissionais alter column cep type text;
alter table public.profissionais alter column estado type text;
create unique index if not exists profissionais_documento_unico on public.profissionais(pais,tipo_documento,numero_documento) where numero_documento is not null;
alter table public.pre_cadastro_profissionais add column if not exists pais text not null default 'BR';
alter table public.pre_cadastro_profissionais add column if not exists tipo_documento text not null default 'cpf';
alter table public.pre_cadastro_profissionais add column if not exists numero_documento text;
alter table public.pre_cadastro_profissionais alter column cpf drop not null;
alter table public.pre_cadastro_profissionais alter column cep type text;
alter table public.pre_cadastro_profissionais alter column estado type text;
create unique index if not exists pre_cadastro_profissionais_documento_unico on public.pre_cadastro_profissionais(pais,tipo_documento,numero_documento) where numero_documento is not null;
-- CPF obrigatório somente quando tipo_documento = cpf; demais documentos exigem número.
-- Revisar triggers/constraints antigas de CPF e UF no banco antes de publicar.

-- NOTA: inspecione pg_constraint para remover apenas constraints antigas incompatíveis com CPF nulo e UF internacional.
-- Execute SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid IN ('public.profissionais'::regclass,'public.pre_cadastro_profissionais'::regclass);

-- IMPORTANTE: a atualização da Edge Function deve ocorrer APÓS a migração.
-- Não remova índices de CPF existentes: índices únicos PostgreSQL permitem múltiplos NULLs.
