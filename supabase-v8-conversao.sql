-- PROTEGE V8 - Cadastro definitivo de famílias e conversão de interessados
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase.

create table if not exists public.familias (
  id uuid primary key default gen_random_uuid(),
  origem_interesse_id uuid unique references public.familias_interessadas(id) on delete set null,
  responsavel1 text not null,
  responsavel2 text,
  telefone text not null,
  email text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  status text not null default 'ativa' check (status in ('ativa','pausada','encerrada')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.filhos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.familias(id) on delete cascade,
  nome text not null,
  idade integer check (idade is null or (idade >= 0 and idade <= 99)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_familias_status on public.familias(status);
create index if not exists idx_familias_created_at on public.familias(created_at desc);
create index if not exists idx_filhos_familia on public.filhos(familia_id);

alter table public.familias enable row level security;
alter table public.filhos enable row level security;

drop policy if exists "profissionais leem familias" on public.familias;
drop policy if exists "profissionais cadastram familias" on public.familias;
drop policy if exists "profissionais atualizam familias" on public.familias;
drop policy if exists "profissionais leem filhos" on public.filhos;
drop policy if exists "profissionais cadastram filhos" on public.filhos;
drop policy if exists "profissionais atualizam filhos" on public.filhos;

create policy "profissionais leem familias"
on public.familias for select to authenticated using (true);

create policy "profissionais cadastram familias"
on public.familias for insert to authenticated with check (true);

create policy "profissionais atualizam familias"
on public.familias for update to authenticated using (true) with check (true);

create policy "profissionais leem filhos"
on public.filhos for select to authenticated using (true);

create policy "profissionais cadastram filhos"
on public.filhos for insert to authenticated with check (true);

create policy "profissionais atualizam filhos"
on public.filhos for update to authenticated using (true) with check (true);

-- Conversão atômica: cria a família e seus filhos e marca o interesse como convertido.
-- É idempotente: se o interesse já tiver sido convertido, retorna a família já criada.
create or replace function public.converter_interesse_em_familia(p_interesse_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_interesse public.familias_interessadas%rowtype;
  v_familia_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Acesso não autorizado';
  end if;

  select * into v_interesse
  from public.familias_interessadas
  where id = p_interesse_id
  for update;

  if not found then
    raise exception 'Cadastro de interesse não encontrado';
  end if;

  select id into v_familia_id
  from public.familias
  where origem_interesse_id = p_interesse_id;

  if v_familia_id is not null then
    update public.familias_interessadas
       set status = 'convertido', updated_at = now()
     where id = p_interesse_id;
    return v_familia_id;
  end if;

  insert into public.familias (
    origem_interesse_id, responsavel1, responsavel2, telefone, email,
    cep, logradouro, numero, complemento, bairro, cidade, estado,
    status, observacoes
  ) values (
    v_interesse.id, v_interesse.responsavel1, v_interesse.responsavel2,
    v_interesse.telefone, v_interesse.email, v_interesse.cep,
    v_interesse.logradouro, v_interesse.numero, v_interesse.complemento,
    v_interesse.bairro, v_interesse.cidade, v_interesse.estado,
    'ativa', v_interesse.observacoes
  ) returning id into v_familia_id;

  insert into public.filhos (familia_id, nome, idade)
  select v_familia_id, fi.nome, fi.idade
  from public.filhos_interesse fi
  where fi.familia_interesse_id = p_interesse_id;

  update public.familias_interessadas
     set status = 'convertido', updated_at = now()
   where id = p_interesse_id;

  return v_familia_id;
end;
$$;

revoke all on function public.converter_interesse_em_familia(uuid) from public;
grant execute on function public.converter_interesse_em_familia(uuid) to authenticated;
