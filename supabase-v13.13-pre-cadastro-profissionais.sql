-- PROTEGE V13.13.0 - Pré-cadastro de profissionais
-- Execute uma única vez no Supabase SQL Editor antes de publicar a funcionalidade.

create extension if not exists pgcrypto;

alter table public.profissionais add column if not exists cpf text;
create unique index if not exists profissionais_cpf_unico on public.profissionais(cpf) where cpf is not null;

create table if not exists public.pre_cadastro_profissionais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  cpf text not null,
  data_nascimento date not null,
  cidade text not null,
  estado text not null,
  celular text not null,
  especialidade text not null,
  formacao_origem text not null,
  formacao_educacao_parental text not null,
  como_conheceu text not null,
  motivacao text not null,
  consentimento_lgpd boolean not null default false,
  status text not null default 'pendente' check (status in ('pendente','em_analise','aprovado','recusado')),
  observacoes_admin text,
  analisado_por uuid references auth.users(id) on delete set null,
  analisado_em timestamptz,
  profissional_id uuid references public.profissionais(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pre_cadastro_profissionais_cpf_unico on public.pre_cadastro_profissionais(cpf);
create index if not exists pre_cadastro_profissionais_status_idx on public.pre_cadastro_profissionais(status, created_at desc);

alter table public.pre_cadastro_profissionais enable row level security;
revoke all on public.pre_cadastro_profissionais from anon, authenticated;

create or replace function public.cpf_valido(p_cpf text)
returns boolean
language plpgsql immutable strict
as $$
declare
  c text := regexp_replace(p_cpf, '\D', '', 'g');
  soma integer; resto integer; d1 integer; d2 integer; i integer;
begin
  if length(c) <> 11 or c ~ '^(\d)\1{10}$' then return false; end if;
  soma := 0; for i in 1..9 loop soma := soma + substr(c,i,1)::int * (11-i); end loop;
  resto := (soma * 10) % 11; d1 := case when resto = 10 then 0 else resto end;
  soma := 0; for i in 1..10 loop soma := soma + substr(c,i,1)::int * (12-i); end loop;
  resto := (soma * 10) % 11; d2 := case when resto = 10 then 0 else resto end;
  return d1 = substr(c,10,1)::int and d2 = substr(c,11,1)::int;
end; $$;

create or replace function public.enviar_pre_cadastro_profissional(
  p_nome text, p_email text, p_cpf text, p_data_nascimento date, p_cidade text, p_estado text, p_celular text,
  p_especialidade text, p_formacao_origem text, p_formacao_educacao_parental text, p_como_conheceu text,
  p_motivacao text, p_consentimento_lgpd boolean
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare c text := regexp_replace(coalesce(p_cpf,''), '\D', '', 'g'); e text := lower(trim(coalesce(p_email,''))); novo_id uuid;
begin
  if trim(coalesce(p_nome,''))='' or e='' or trim(coalesce(p_cidade,''))='' or trim(coalesce(p_celular,''))='' or trim(coalesce(p_especialidade,''))='' or trim(coalesce(p_formacao_origem,''))='' or trim(coalesce(p_motivacao,''))='' then
    return jsonb_build_object('ok',false,'message','Preencha todos os campos obrigatórios.');
  end if;
  if p_consentimento_lgpd is not true then return jsonb_build_object('ok',false,'message','É necessário aceitar a autorização de tratamento dos dados.'); end if;
  if not public.cpf_valido(c) then return jsonb_build_object('ok',false,'message','CPF inválido.'); end if;
  if p_estado !~ '^[A-Za-z]{2}$' then return jsonb_build_object('ok',false,'message','UF inválida.'); end if;
  if exists(select 1 from public.pre_cadastro_profissionais where cpf=c) or exists(select 1 from public.profissionais where cpf=c) then return jsonb_build_object('ok',false,'message','Já existe um cadastro com este CPF.'); end if;
  if exists(select 1 from public.pre_cadastro_profissionais where lower(email)=e) or exists(select 1 from public.profissionais where lower(email)=e) then return jsonb_build_object('ok',false,'message','Já existe um cadastro com este e-mail.'); end if;
  insert into public.pre_cadastro_profissionais(nome,email,cpf,data_nascimento,cidade,estado,celular,especialidade,formacao_origem,formacao_educacao_parental,como_conheceu,motivacao,consentimento_lgpd)
  values(trim(p_nome),e,c,p_data_nascimento,trim(p_cidade),upper(trim(p_estado)),trim(p_celular),trim(p_especialidade),trim(p_formacao_origem),trim(p_formacao_educacao_parental),trim(p_como_conheceu),trim(p_motivacao),true)
  returning id into novo_id;
  return jsonb_build_object('ok',true,'id',novo_id);
exception when unique_violation then return jsonb_build_object('ok',false,'message','CPF ou e-mail já cadastrado.');
end; $$;

revoke all on function public.enviar_pre_cadastro_profissional(text,text,text,date,text,text,text,text,text,text,text,text,boolean) from public;
grant execute on function public.enviar_pre_cadastro_profissional(text,text,text,date,text,text,text,text,text,text,text,text,boolean) to anon, authenticated;
