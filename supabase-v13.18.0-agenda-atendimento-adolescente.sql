-- PROTEGE V13.18.0 - Adolescente em Agenda e Atendimentos
-- Pré-requisito: executar primeiro supabase-v13.17.0-cadastro-adolescente.sql.
-- Execute uma única vez no Supabase SQL Editor antes de publicar a V13.18.0.

-- Profissionais autenticados precisam consultar a lista de adolescentes para selecionar
-- o cadastro nas telas internas de Agenda e Atendimento.
grant select on table public.cadastros_adolescentes to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='cadastros_adolescentes'
      and policyname='cadastros_adolescentes_select_authenticated'
  ) then
    create policy cadastros_adolescentes_select_authenticated
      on public.cadastros_adolescentes
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- Um atendimento pode pertencer a uma família OU a um adolescente.
alter table public.atendimentos
  alter column familia_id drop not null;

alter table public.atendimentos
  add column if not exists adolescente_id uuid references public.cadastros_adolescentes(id) on delete restrict;

create index if not exists atendimentos_adolescente_id_idx
  on public.atendimentos(adolescente_id);

alter table public.atendimentos
  drop constraint if exists atendimentos_familia_ou_adolescente_chk;

alter table public.atendimentos
  add constraint atendimentos_familia_ou_adolescente_chk
  check (
    (familia_id is not null and adolescente_id is null)
    or
    (familia_id is null and adolescente_id is not null)
  );

-- Um agendamento também pode pertencer a uma família OU a um adolescente.
alter table public.agenda
  alter column familia_id drop not null;

alter table public.agenda
  add column if not exists adolescente_id uuid references public.cadastros_adolescentes(id) on delete restrict;

create index if not exists agenda_adolescente_id_idx
  on public.agenda(adolescente_id);

alter table public.agenda
  drop constraint if exists agenda_familia_ou_adolescente_chk;

alter table public.agenda
  add constraint agenda_familia_ou_adolescente_chk
  check (
    (familia_id is not null and adolescente_id is null)
    or
    (familia_id is null and adolescente_id is not null)
  );

-- Se houver checks antigos restringindo tipo_alvo, eles podem impedir o novo valor
-- 'adolescente'. Remove apenas checks que dependem da coluna tipo_alvo; a validação
-- funcional segue sendo feita pela aplicação e pela regra Família XOR Adolescente.
do $$
declare r record;
begin
  for r in
    select c.conname, t.relname
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public'
      and t.relname in ('atendimentos','agenda')
      and c.contype='c'
      and pg_get_constraintdef(c.oid) ilike '%tipo_alvo%'
  loop
    execute format('alter table public.%I drop constraint %I', r.relname, r.conname);
  end loop;
end $$;
