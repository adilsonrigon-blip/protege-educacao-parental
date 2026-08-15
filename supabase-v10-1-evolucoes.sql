-- PROTEGE V10.1 - Evoluções incrementais do atendimento
-- Execute UMA VEZ no SQL Editor do Supabase, depois da V9.

create table if not exists public.atendimento_evolucoes (
  id uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  profissional_id uuid references public.profissionais(id) on delete set null,
  etapa integer not null check (etapa between 1 and 10),
  titulo text,
  conteudo text not null check (char_length(trim(conteudo)) > 0),
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_atendimento_evolucoes_atendimento
on public.atendimento_evolucoes(atendimento_id, created_at asc);

create index if not exists idx_atendimento_evolucoes_profissional
on public.atendimento_evolucoes(profissional_id, created_at desc);

alter table public.atendimento_evolucoes enable row level security;

drop policy if exists "profissionais autenticados leem evolucoes" on public.atendimento_evolucoes;
drop policy if exists "profissionais autenticados cadastram evolucoes" on public.atendimento_evolucoes;

create policy "profissionais autenticados leem evolucoes"
on public.atendimento_evolucoes for select to authenticated using (true);

create policy "profissionais autenticados cadastram evolucoes"
on public.atendimento_evolucoes for insert to authenticated with check (true);

-- Intencionalmente não há política de UPDATE ou DELETE.
-- Assim, uma evolução nova é acrescentada ao histórico em vez de substituir a anterior.
