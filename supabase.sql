-- PROTEGE - estrutura inicial do banco de dados (Supabase/PostgreSQL)
-- Execute no SQL Editor do Supabase uma única vez.

create extension if not exists pgcrypto;

create table if not exists public.familias_interessadas (
  id uuid primary key default gen_random_uuid(),
  responsavel1 text not null,
  responsavel2 text,
  telefone text not null,
  email text,
  cep text not null,
  logradouro text not null,
  numero text not null,
  complemento text,
  bairro text not null,
  cidade text not null,
  estado text not null,
  status text not null default 'novo' check (status in ('novo','em_contato','aprovado','nao_aprovado','convertido')),
  observacoes text,
  origem text not null default 'site',
  consentimento boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.filhos_interesse (
  id uuid primary key default gen_random_uuid(),
  familia_interesse_id uuid not null references public.familias_interessadas(id) on delete cascade,
  nome text not null,
  idade integer not null check (idade >= 0 and idade <= 99),
  created_at timestamptz not null default now()
);

-- RLS: visitante pode apenas INSERIR novos cadastros.
alter table public.familias_interessadas enable row level security;
alter table public.filhos_interesse enable row level security;

-- Remove políticas antigas com os mesmos nomes, se existirem.
drop policy if exists "site pode cadastrar familias" on public.familias_interessadas;
drop policy if exists "site pode cadastrar filhos" on public.filhos_interesse;
drop policy if exists "profissionais autenticados leem familias" on public.familias_interessadas;
drop policy if exists "profissionais autenticados atualizam familias" on public.familias_interessadas;
drop policy if exists "profissionais autenticados leem filhos" on public.filhos_interesse;

create policy "site pode cadastrar familias"
on public.familias_interessadas for insert
to anon, authenticated
with check (true);

create policy "site pode cadastrar filhos"
on public.filhos_interesse for insert
to anon, authenticated
with check (true);

create policy "profissionais autenticados leem familias"
on public.familias_interessadas for select
to authenticated
using (true);

create policy "profissionais autenticados atualizam familias"
on public.familias_interessadas for update
to authenticated
using (true)
with check (true);

create policy "profissionais autenticados leem filhos"
on public.filhos_interesse for select
to authenticated
using (true);

create index if not exists idx_familias_interessadas_status on public.familias_interessadas(status);
create index if not exists idx_familias_interessadas_created_at on public.familias_interessadas(created_at desc);
create index if not exists idx_filhos_interesse_familia on public.filhos_interesse(familia_interesse_id);
