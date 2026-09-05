-- PROTEGE V13.17.0 - Cadastro público simples de adolescente
-- Execute uma única vez no Supabase SQL Editor antes de publicar a nova versão.

create table if not exists public.cadastros_adolescentes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data_nascimento date not null,
  cpf text not null,
  celular text not null,
  email text not null,
  origem text not null default 'site',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cadastros_adolescentes_cpf_uidx on public.cadastros_adolescentes (cpf);
create index if not exists cadastros_adolescentes_created_idx on public.cadastros_adolescentes (created_at desc);

alter table public.cadastros_adolescentes enable row level security;
revoke all on table public.cadastros_adolescentes from anon;

create or replace function public.enviar_cadastro_adolescente(
  p_nome text,
  p_data_nascimento date,
  p_cpf text,
  p_celular text,
  p_email text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c text := regexp_replace(coalesce(p_cpf,''), '\D', '', 'g');
  cel text := regexp_replace(coalesce(p_celular,''), '\D', '', 'g');
  e text := lower(trim(coalesce(p_email,'')));
  novo_id uuid;
  soma integer;
  resto integer;
  dig1 integer;
  dig2 integer;
  i integer;
begin
  if trim(coalesce(p_nome,'')) = '' or p_data_nascimento is null or c = '' or cel = '' or e = '' then
    return jsonb_build_object('ok',false,'message','Preencha todos os campos obrigatórios.');
  end if;
  if p_data_nascimento > current_date then
    return jsonb_build_object('ok',false,'message','A data de nascimento não pode ser futura.');
  end if;
  if c !~ '^\d{11}$' or c ~ '^(\d)\1{10}$' then
    return jsonb_build_object('ok',false,'message','CPF inválido.');
  end if;
  soma:=0; for i in 1..9 loop soma:=soma+(substr(c,i,1)::int*(11-i)); end loop;
  resto:=soma%11; dig1:=case when resto<2 then 0 else 11-resto end;
  soma:=0; for i in 1..10 loop soma:=soma+(substr(c,i,1)::int*(12-i)); end loop;
  resto:=soma%11; dig2:=case when resto<2 then 0 else 11-resto end;
  if dig1<>substr(c,10,1)::int or dig2<>substr(c,11,1)::int then
    return jsonb_build_object('ok',false,'message','CPF inválido.');
  end if;
  if length(cel)=13 and left(cel,2)='55' then cel:=substr(cel,3); end if;
  if cel !~ '^[1-9][1-9]9[0-9]{8}$' then
    return jsonb_build_object('ok',false,'message','Celular inválido. Informe DDD e número com 9 dígitos.');
  end if;
  if e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('ok',false,'message','E-mail inválido.');
  end if;
  if exists(select 1 from public.cadastros_adolescentes where cpf=c) then
    return jsonb_build_object('ok',false,'message','Já existe um cadastro para este CPF.');
  end if;
  insert into public.cadastros_adolescentes(nome,data_nascimento,cpf,celular,email)
  values(trim(p_nome),p_data_nascimento,c,'('||substr(cel,1,2)||') '||substr(cel,3,5)||'-'||substr(cel,8,4),e)
  returning id into novo_id;
  return jsonb_build_object('ok',true,'id',novo_id);
exception when unique_violation then
  return jsonb_build_object('ok',false,'message','Já existe um cadastro para este CPF.');
end;
$$;

grant execute on function public.enviar_cadastro_adolescente(text,date,text,text,text) to anon, authenticated;
