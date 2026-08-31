-- PROTEGE V13.14.0
-- Produtividade, auditoria, métricas, notificações e hardening das novas estruturas.
-- Migração incremental/idempotente. Não remove dados.

create or replace function public.protege_is_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.usuarios_perfis
    where user_id=auth.uid() and perfil='admin' and ativo=true
  );
$$;
revoke all on function public.protege_is_admin() from public;
grant execute on function public.protege_is_admin() to authenticated;

alter table public.pre_cadastro_profissionais add column if not exists motivo_recusa text;
alter table public.pre_cadastro_profissionais add column if not exists aprovado_em timestamptz;
alter table public.pre_cadastro_profissionais add column if not exists aprovado_por uuid;
alter table public.pre_cadastro_profissionais add column if not exists recusado_em timestamptz;
alter table public.pre_cadastro_profissionais add column if not exists recusado_por uuid;
alter table public.pre_cadastro_profissionais add column if not exists ultimo_acesso_enviado_em timestamptz;

create table if not exists public.pre_cadastro_profissionais_historico (
  id uuid primary key default gen_random_uuid(),
  pre_cadastro_id uuid not null references public.pre_cadastro_profissionais(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  observacao text,
  motivo_recusa text,
  realizado_por uuid,
  realizado_por_email text,
  created_at timestamptz not null default now()
);
create index if not exists pre_prof_hist_pre_created_idx on public.pre_cadastro_profissionais_historico(pre_cadastro_id,created_at desc);
alter table public.pre_cadastro_profissionais_historico enable row level security;
revoke all on public.pre_cadastro_profissionais_historico from anon;
grant select on public.pre_cadastro_profissionais_historico to authenticated;
drop policy if exists pre_prof_hist_admin_select on public.pre_cadastro_profissionais_historico;
create policy pre_prof_hist_admin_select on public.pre_cadastro_profissionais_historico for select to authenticated using (public.protege_is_admin());

create table if not exists public.auditoria_eventos (
  id bigserial primary key,
  tabela text not null,
  registro_id text,
  acao text not null check (acao in ('INSERT','UPDATE','DELETE','ACESSO','APROVACAO','RECUSA','REENVIO_ACESSO')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  realizado_por uuid,
  realizado_por_email text,
  origem text default 'web',
  created_at timestamptz not null default now()
);
create index if not exists auditoria_eventos_created_idx on public.auditoria_eventos(created_at desc);
create index if not exists auditoria_eventos_table_record_idx on public.auditoria_eventos(tabela,registro_id,created_at desc);
create index if not exists auditoria_eventos_actor_idx on public.auditoria_eventos(realizado_por,created_at desc);
alter table public.auditoria_eventos enable row level security;
revoke all on public.auditoria_eventos from anon;
grant select,insert on public.auditoria_eventos to authenticated;
drop policy if exists auditoria_admin_select on public.auditoria_eventos;
create policy auditoria_admin_select on public.auditoria_eventos for select to authenticated using (public.protege_is_admin());
drop policy if exists auditoria_insert_authenticated on public.auditoria_eventos;
create policy auditoria_insert_authenticated on public.auditoria_eventos for insert to authenticated with check (realizado_por=auth.uid());

create or replace function public.protege_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  mail text := nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'email';
  rid text;
begin
  if tg_op='DELETE' then rid:=coalesce(to_jsonb(old)->>'id','');
  else rid:=coalesce(to_jsonb(new)->>'id',''); end if;
  insert into public.auditoria_eventos(tabela,registro_id,acao,dados_anteriores,dados_novos,realizado_por,realizado_por_email,origem)
  values(tg_table_name,rid,tg_op,case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,uid,mail,'db-trigger');
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

-- Auditoria nas tabelas operacionais principais. Os triggers são recriados para manter idempotência.
do $$
declare t text;
begin
  foreach t in array array['familias','filhos','profissionais','ongs','atendimentos','agenda'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists protege_audit_%I on public.%I',t,t);
      execute format('create trigger protege_audit_%I after insert or update or delete on public.%I for each row execute function public.protege_audit_trigger()',t,t);
    end if;
  end loop;
end $$;

-- Índices seguros para filtros/ordenação mais usados.
create index if not exists profissionais_status_nome_idx on public.profissionais(status,nome);
create index if not exists profissionais_ong_status_idx on public.profissionais(ong_id,status) where ong_id is not null;
create index if not exists familias_status_created_idx on public.familias(status,created_at desc);
create index if not exists familias_ong_created_idx on public.familias(ong_id,created_at desc) where ong_id is not null;
create index if not exists atendimentos_status_data_idx on public.atendimentos(status,data_hora desc);
create index if not exists atendimentos_prof_data_idx on public.atendimentos(profissional_id,data_hora desc) where profissional_id is not null;
create index if not exists atendimentos_familia_data_idx on public.atendimentos(familia_id,data_hora desc) where familia_id is not null;
create index if not exists agenda_status_inicio_idx on public.agenda(status,data_inicio);
create index if not exists pre_cadastro_prof_status_created_idx on public.pre_cadastro_profissionais(status,created_at desc);

create or replace function public.protege_dashboard_metricas()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  result jsonb;
begin
  if not public.protege_is_admin() then raise exception 'Acesso restrito a administradores'; end if;
  select jsonb_build_object(
    'familias_total',(select count(*) from public.familias),
    'familias_mes',(select count(*) from public.familias where created_at>=date_trunc('month',now())),
    'profissionais_ativos',(select count(*) from public.profissionais where status='ativo'),
    'pre_cadastros_pendentes',(select count(*) from public.pre_cadastro_profissionais where status in ('pendente','em_analise')),
    'atendimentos_mes',(select count(*) from public.atendimentos where data_hora>=date_trunc('month',now())),
    'atendimentos_hoje',(select count(*) from public.atendimentos where data_hora>=current_date and data_hora<current_date+interval '1 day'),
    'serie_mensal',(
      select coalesce(jsonb_agg(jsonb_build_object('mes',to_char(m.mes,'YYYY-MM'),'total',coalesce(a.total,0)) order by m.mes),'[]'::jsonb)
      from generate_series(date_trunc('month',now())-interval '5 months',date_trunc('month',now()),interval '1 month') m(mes)
      left join lateral (select count(*) total from public.atendimentos x where x.data_hora>=m.mes and x.data_hora<m.mes+interval '1 month') a on true
    )
  ) into result;
  return result;
end;
$$;
revoke all on function public.protege_dashboard_metricas() from public;
grant execute on function public.protege_dashboard_metricas() to authenticated;

create or replace function public.protege_pre_cadastro_pendentes()
returns integer language plpgsql security definer set search_path=public as $$
begin
  if not public.protege_is_admin() then return 0; end if;
  return (select count(*)::int from public.pre_cadastro_profissionais where status in ('pendente','em_analise'));
end;$$;
revoke all on function public.protege_pre_cadastro_pendentes() from public;
grant execute on function public.protege_pre_cadastro_pendentes() to authenticated;

analyze public.profissionais;
analyze public.familias;
analyze public.atendimentos;
analyze public.pre_cadastro_profissionais;
