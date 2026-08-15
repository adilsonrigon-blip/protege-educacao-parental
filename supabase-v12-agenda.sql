-- PROTEGE V12 - Agenda completa
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase.

create table if not exists public.agenda (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.familias(id) on delete cascade,
  filho_id uuid references public.filhos(id) on delete set null,
  profissional_id uuid references public.profissionais(id) on delete set null,
  atendimento_id uuid references public.atendimentos(id) on delete set null,
  atendimento_para text not null,
  tipo_alvo text not null default 'familia' check (tipo_alvo in ('familia','responsavel','filho')),
  tipo text not null default 'atendimento' check (tipo in ('atendimento','retorno','reuniao','supervisao','outro')),
  data_inicio timestamptz not null,
  data_fim timestamptz,
  status text not null default 'agendado' check (status in ('agendado','confirmado','realizado','cancelado','falta')),
  observacoes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agenda_inicio on public.agenda(data_inicio);
create index if not exists idx_agenda_familia on public.agenda(familia_id, data_inicio);
create index if not exists idx_agenda_profissional on public.agenda(profissional_id, data_inicio);
create index if not exists idx_agenda_status on public.agenda(status, data_inicio);

alter table public.agenda enable row level security;

drop policy if exists "profissionais autenticados leem agenda" on public.agenda;
drop policy if exists "profissionais autenticados cadastram agenda" on public.agenda;
drop policy if exists "profissionais autenticados atualizam agenda" on public.agenda;

create policy "profissionais autenticados leem agenda"
on public.agenda for select to authenticated using (true);
create policy "profissionais autenticados cadastram agenda"
on public.agenda for insert to authenticated with check (true);
create policy "profissionais autenticados atualizam agenda"
on public.agenda for update to authenticated using (true) with check (true);

-- Se já existirem atendimentos com status 'agendado', trazemos esses registros para a Agenda.
insert into public.agenda (
  familia_id, filho_id, profissional_id, atendimento_id, atendimento_para,
  tipo_alvo, tipo, data_inicio, status, observacoes, created_by
)
select
  a.familia_id,
  a.filho_id,
  a.profissional_id,
  a.id,
  coalesce(a.dados->>'membro_atendido','Família'),
  case when a.tipo_alvo='responsaveis' then 'responsavel' else a.tipo_alvo end,
  'atendimento',
  a.data_hora,
  'agendado',
  a.observacoes,
  a.created_by
from public.atendimentos a
where a.status='agendado'
  and not exists (select 1 from public.agenda g where g.atendimento_id=a.id);
