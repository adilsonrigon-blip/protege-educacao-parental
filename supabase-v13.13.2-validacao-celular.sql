-- PROTEGE V13.13.2 - Validação de celular brasileiro no servidor
-- Execute uma única vez no Supabase SQL Editor.
-- Não altera nem apaga pré-cadastros existentes.

create or replace function public.celular_br_valido(p_celular text)
returns boolean
language plpgsql immutable strict
as $$
declare
  c text := regexp_replace(coalesce(p_celular,''), '\D', '', 'g');
  ddd text;
  ddds_validos text[] := array[
    '11','12','13','14','15','16','17','18','19','21','22','24','27','28',
    '31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49',
    '51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74','75','77','79',
    '81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99'
  ];
begin
  if length(c) = 13 and left(c,2) = '55' then c := substr(c,3); end if;
  if length(c) <> 11 then return false; end if;
  ddd := left(c,2);
  if not (ddd = any(ddds_validos)) then return false; end if;
  if substr(c,3,1) <> '9' then return false; end if;
  return true;
end; $$;

create or replace function public.enviar_pre_cadastro_profissional(
  p_nome text, p_email text, p_cpf text, p_data_nascimento date, p_cidade text, p_estado text, p_celular text,
  p_especialidade text, p_formacao_origem text, p_formacao_educacao_parental text, p_como_conheceu text,
  p_motivacao text, p_consentimento_lgpd boolean
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  c text := regexp_replace(coalesce(p_cpf,''), '\D', '', 'g');
  e text := lower(trim(coalesce(p_email,'')));
  cel text := regexp_replace(coalesce(p_celular,''), '\D', '', 'g');
  cel_formatado text;
  novo_id uuid;
begin
  if length(cel) = 13 and left(cel,2) = '55' then cel := substr(cel,3); end if;

  if trim(coalesce(p_nome,''))='' or e='' or trim(coalesce(p_cidade,''))='' or trim(coalesce(p_celular,''))='' or trim(coalesce(p_especialidade,''))='' or trim(coalesce(p_formacao_origem,''))='' or trim(coalesce(p_motivacao,''))='' then
    return jsonb_build_object('ok',false,'message','Preencha todos os campos obrigatórios.');
  end if;
  if p_consentimento_lgpd is not true then
    return jsonb_build_object('ok',false,'message','É necessário aceitar a autorização de tratamento dos dados.');
  end if;
  if not public.cpf_valido(c) then
    return jsonb_build_object('ok',false,'message','CPF inválido.');
  end if;
  if p_estado !~ '^[A-Za-z]{2}$' then
    return jsonb_build_object('ok',false,'message','UF inválida.');
  end if;
  if not public.celular_br_valido(cel) then
    return jsonb_build_object('ok',false,'message','Celular inválido. Informe um DDD válido e um celular com 11 dígitos, por exemplo (11) 99999-9999.');
  end if;

  cel_formatado := '(' || substr(cel,1,2) || ') ' || substr(cel,3,5) || '-' || substr(cel,8,4);

  if exists(select 1 from public.pre_cadastro_profissionais where cpf=c) or exists(select 1 from public.profissionais where cpf=c) then
    return jsonb_build_object('ok',false,'message','Já existe um cadastro com este CPF.');
  end if;
  if exists(select 1 from public.pre_cadastro_profissionais where lower(email)=e) or exists(select 1 from public.profissionais where lower(email)=e) then
    return jsonb_build_object('ok',false,'message','Já existe um cadastro com este e-mail.');
  end if;

  insert into public.pre_cadastro_profissionais(
    nome,email,cpf,data_nascimento,cidade,estado,celular,especialidade,formacao_origem,
    formacao_educacao_parental,como_conheceu,motivacao,consentimento_lgpd
  ) values(
    trim(p_nome),e,c,p_data_nascimento,trim(p_cidade),upper(trim(p_estado)),cel_formatado,trim(p_especialidade),
    trim(p_formacao_origem),trim(p_formacao_educacao_parental),trim(p_como_conheceu),trim(p_motivacao),true
  ) returning id into novo_id;

  return jsonb_build_object('ok',true,'id',novo_id);
exception when unique_violation then
  return jsonb_build_object('ok',false,'message','CPF ou e-mail já cadastrado.');
end; $$;

revoke all on function public.enviar_pre_cadastro_profissional(text,text,text,date,text,text,text,text,text,text,text,text,boolean) from public;
grant execute on function public.enviar_pre_cadastro_profissional(text,text,text,date,text,text,text,text,text,text,text,text,boolean) to anon, authenticated;
