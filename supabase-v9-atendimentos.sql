-- PROTEGE V9 - Profissionais, ficha da família e atendimentos reais
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase, depois da V8.

create table if not exists public.profissionais (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  nome text not null,
  email text unique,
  telefone text,
  especialidade text,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.familias(id) on delete cascade,
  filho_id uuid references public.filhos(id) on delete set null,
  profissional_id uuid references public.profissionais(id) on delete set null,
  tipo_alvo text not null default 'familia' check (tipo_alvo in ('familia','filho','responsaveis')),
  data_hora timestamptz not null default now(),
  status text not null default 'realizado' check (status in ('rascunho','agendado','realizado','cancelado')),
  etapa_atual integer not null default 10 check (etapa_atual between 1 and 10),
  dados jsonb not null default '{}'::jsonb,
  observacoes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profissionais_status on public.profissionais(status);
create index if not exists idx_atendimentos_familia on public.atendimentos(familia_id, data_hora desc);
create index if not exists idx_atendimentos_profissional on public.atendimentos(profissional_id, data_hora desc);
create index if not exists idx_atendimentos_data on public.atendimentos(data_hora desc);

alter table public.profissionais enable row level security;
alter table public.atendimentos enable row level security;

-- PROFISSIONAIS
 drop policy if exists "profissionais autenticados leem profissionais" on public.profissionais;
 drop policy if exists "profissionais autenticados cadastram profissionais" on public.profissionais;
 drop policy if exists "profissionais autenticados atualizam profissionais" on public.profissionais;

create policy "profissionais autenticados leem profissionais"
on public.profissionais for select to authenticated using (true);
create policy "profissionais autenticados cadastram profissionais"
on public.profissionais for insert to authenticated with check (true);
create policy "profissionais autenticados atualizam profissionais"
on public.profissionais for update to authenticated using (true) with check (true);

-- ATENDIMENTOS
 drop policy if exists "profissionais autenticados leem atendimentos" on public.atendimentos;
 drop policy if exists "profissionais autenticados cadastram atendimentos" on public.atendimentos;
 drop policy if exists "profissionais autenticados atualizam atendimentos" on public.atendimentos;

create policy "profissionais autenticados leem atendimentos"
on public.atendimentos for select to authenticated using (true);
create policy "profissionais autenticados cadastram atendimentos"
on public.atendimentos for insert to authenticated with check (true);
create policy "profissionais autenticados atualizam atendimentos"
on public.atendimentos for update to authenticated using (true) with check (true);
