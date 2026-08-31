-- PROTEGE V13.14.1 - endereco do pre-cadastro profissional + RPC versionada
begin;
alter table public.pre_cadastro_profissionais add column if not exists cep text;
alter table public.pre_cadastro_profissionais add column if not exists logradouro text;
alter table public.pre_cadastro_profissionais add column if not exists numero text;
alter table public.pre_cadastro_profissionais add column if not exists complemento text;
alter table public.pre_cadastro_profissionais add column if not exists bairro text;
alter table public.profissionais add column if not exists cep text;
alter table public.profissionais add column if not exists logradouro text;
alter table public.profissionais add column if not exists numero text;
alter table public.profissionais add column if not exists complemento text;
alter table public.profissionais add column if not exists bairro text;
alter table public.profissionais add column if not exists cidade text;
alter table public.profissionais add column if not exists estado text;
create index if not exists pre_cadastro_prof_cep_idx on public.pre_cadastro_profissionais(cep) where cep is not null;
create index if not exists profissionais_cep_idx on public.profissionais(cep) where cep is not null;
create or replace function public.enviar_pre_cadastro_profissional_v13141(
  p_nome text, p_email text, p_cpf text, p_data_nascimento date,
  p_cep text, p_logradouro text, p_numero text, p_complemento text, p_bairro text,
  p_cidade text, p_estado text, p_celular text, p_especialidade text,
  p_formacao_origem text, p_formacao_educacao_parental text, p_como_conheceu text,
  p_motivacao text, p_consentimento_lgpd boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := regexp_replace(coalesce(p_cpf,''), '\D', '', 'g'); e text := lower(trim(coalesce(p_email,''))); z text := regexp_replace(coalesce(p_cep,''), '\D', '', 'g'); novo_id uuid;
begin
  if trim(coalesce(p_nome,''))='' or e='' or z !~ '^\d{8}$' or trim(coalesce(p_logradouro,''))='' or trim(coalesce(p_numero,''))='' or trim(coalesce(p_bairro,''))='' or trim(coalesce(p_cidade,''))='' or trim(coalesce(p_celular,''))='' or trim(coalesce(p_especialidade,''))='' or trim(coalesce(p_formacao_origem,''))='' or trim(coalesce(p_motivacao,''))='' then return jsonb_build_object('ok',false,'message','Preencha todos os campos obrigatórios, incluindo o endereço.'); end if;
  if p_consentimento_lgpd is not true then return jsonb_build_object('ok',false,'message','É necessário aceitar a autorização de tratamento dos dados.'); end if;
  if not public.cpf_valido(c) then return jsonb_build_object('ok',false,'message','CPF inválido.'); end if;
  if p_estado !~ '^[A-Za-z]{2}$' then return jsonb_build_object('ok',false,'message','UF inválida.'); end if;
  if not public.celular_valido(p_celular) then return jsonb_build_object('ok',false,'message','Celular inválido.'); end if;
  if exists(select 1 from public.pre_cadastro_profissionais where cpf=c) or exists(select 1 from public.profissionais where cpf=c) then return jsonb_build_object('ok',false,'message','Já existe um cadastro com este CPF.'); end if;
  if exists(select 1 from public.pre_cadastro_profissionais where lower(email)=e) or exists(select 1 from public.profissionais where lower(email)=e) then return jsonb_build_object('ok',false,'message','Já existe um cadastro com este e-mail.'); end if;
  insert into public.pre_cadastro_profissionais(nome,email,cpf,data_nascimento,cep,logradouro,numero,complemento,bairro,cidade,estado,celular,especialidade,formacao_origem,formacao_educacao_parental,como_conheceu,motivacao,consentimento_lgpd)
  values(trim(p_nome),e,c,p_data_nascimento,z,trim(p_logradouro),trim(p_numero),nullif(trim(coalesce(p_complemento,'')),''),trim(p_bairro),trim(p_cidade),upper(trim(p_estado)),trim(p_celular),trim(p_especialidade),trim(p_formacao_origem),trim(p_formacao_educacao_parental),trim(p_como_conheceu),trim(p_motivacao),true) returning id into novo_id;
  return jsonb_build_object('ok',true,'id',novo_id);
exception when unique_violation then return jsonb_build_object('ok',false,'message','CPF ou e-mail já cadastrado.'); end; $$;
revoke all on function public.enviar_pre_cadastro_profissional_v13141(text,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean) from public;
grant execute on function public.enviar_pre_cadastro_profissional_v13141(text,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean) to anon, authenticated;
analyze public.pre_cadastro_profissionais; analyze public.profissionais; commit;
