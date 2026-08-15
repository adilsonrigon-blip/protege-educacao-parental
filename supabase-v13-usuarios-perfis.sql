-- PROTEGE V13 - Usuários, perfis de acesso e segurança por profissional
-- Execute UMA VEZ no SQL Editor do Supabase, depois das migrações anteriores.
-- Esta migração transforma o usuário já existente em ADMIN e restringe profissionais à própria agenda/atendimentos.

create table if not exists public.usuarios_perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profissional_id uuid unique references public.profissionais(id) on delete set null,
  nome text not null,
  email text not null,
  perfil text not null default 'profissional' check (perfil in ('admin','profissional')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_usuarios_perfis_profissional on public.usuarios_perfis(profissional_id);
create index if not exists idx_usuarios_perfis_perfil on public.usuarios_perfis(perfil, ativo);
alter table public.usuarios_perfis enable row level security;

-- Funções auxiliares usadas pelas políticas RLS.
create or replace function public.usuario_e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios_perfis p
    where p.user_id = auth.uid() and p.ativo = true and p.perfil = 'admin'
  );
$$;

create or replace function public.profissional_atual_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.profissional_id
  from public.usuarios_perfis p
  where p.user_id = auth.uid() and p.ativo = true
  limit 1;
$$;

revoke all on function public.usuario_e_admin() from public;
revoke all on function public.profissional_atual_id() from public;
grant execute on function public.usuario_e_admin() to authenticated;
grant execute on function public.profissional_atual_id() to authenticated;

-- PERFIS: cada usuário lê seu perfil; admin lê todos.
drop policy if exists "usuario le proprio perfil" on public.usuarios_perfis;
drop policy if exists "admin le todos perfis" on public.usuarios_perfis;
create policy "usuario le proprio perfil" on public.usuarios_perfis
for select to authenticated using ((select auth.uid()) = user_id);
create policy "admin le todos perfis" on public.usuarios_perfis
for select to authenticated using ((select public.usuario_e_admin()));

-- PROFISSIONAIS: admin vê todos; profissional vê somente a si mesmo.
drop policy if exists "profissionais autenticados leem profissionais" on public.profissionais;
drop policy if exists "profissionais autenticados cadastram profissionais" on public.profissionais;
drop policy if exists "profissionais autenticados atualizam profissionais" on public.profissionais;
drop policy if exists "v13 le profissionais" on public.profissionais;
create policy "v13 le profissionais" on public.profissionais
for select to authenticated
using ((select public.usuario_e_admin()) or id = (select public.profissional_atual_id()));

-- FAMÍLIAS E FILHOS: todos os profissionais ativos podem consultar para executar o trabalho;
-- apenas admin pode alterar cadastro definitivo.
drop policy if exists "profissionais leem familias" on public.familias;
drop policy if exists "profissionais cadastram familias" on public.familias;
drop policy if exists "profissionais atualizam familias" on public.familias;
drop policy if exists "profissionais leem filhos" on public.filhos;
drop policy if exists "profissionais cadastram filhos" on public.filhos;
drop policy if exists "profissionais atualizam filhos" on public.filhos;
drop policy if exists "v13 le familias" on public.familias;
drop policy if exists "v13 admin insere familias" on public.familias;
drop policy if exists "v13 admin atualiza familias" on public.familias;
drop policy if exists "v13 le filhos" on public.filhos;
drop policy if exists "v13 admin insere filhos" on public.filhos;
drop policy if exists "v13 admin atualiza filhos" on public.filhos;
create policy "v13 le familias" on public.familias for select to authenticated using (true);
create policy "v13 admin insere familias" on public.familias for insert to authenticated with check ((select public.usuario_e_admin()));
create policy "v13 admin atualiza familias" on public.familias for update to authenticated using ((select public.usuario_e_admin())) with check ((select public.usuario_e_admin()));
create policy "v13 le filhos" on public.filhos for select to authenticated using (true);
create policy "v13 admin insere filhos" on public.filhos for insert to authenticated with check ((select public.usuario_e_admin()));
create policy "v13 admin atualiza filhos" on public.filhos for update to authenticated using ((select public.usuario_e_admin())) with check ((select public.usuario_e_admin()));

-- CAPTAÇÃO: o site continua podendo inserir; somente admin consulta/alterar os cadastros recebidos.
drop policy if exists "profissionais autenticados leem familias" on public.familias_interessadas;
drop policy if exists "profissionais autenticados atualizam familias" on public.familias_interessadas;
drop policy if exists "profissionais autenticados leem filhos" on public.filhos_interesse;
drop policy if exists "v13 admin le interesses" on public.familias_interessadas;
drop policy if exists "v13 admin atualiza interesses" on public.familias_interessadas;
drop policy if exists "v13 admin le filhos interesse" on public.filhos_interesse;
create policy "v13 admin le interesses" on public.familias_interessadas for select to authenticated using ((select public.usuario_e_admin()));
create policy "v13 admin atualiza interesses" on public.familias_interessadas for update to authenticated using ((select public.usuario_e_admin())) with check ((select public.usuario_e_admin()));
create policy "v13 admin le filhos interesse" on public.filhos_interesse for select to authenticated using ((select public.usuario_e_admin()));

-- AGENDA: admin vê/altera tudo; profissional somente os próprios compromissos.
drop policy if exists "profissionais autenticados leem agenda" on public.agenda;
drop policy if exists "profissionais autenticados cadastram agenda" on public.agenda;
drop policy if exists "profissionais autenticados atualizam agenda" on public.agenda;
drop policy if exists "v13 le agenda" on public.agenda;
drop policy if exists "v13 insere agenda" on public.agenda;
drop policy if exists "v13 atualiza agenda" on public.agenda;
create policy "v13 le agenda" on public.agenda for select to authenticated
using ((select public.usuario_e_admin()) or profissional_id = (select public.profissional_atual_id()));
create policy "v13 insere agenda" on public.agenda for insert to authenticated
with check ((select public.usuario_e_admin()) or profissional_id = (select public.profissional_atual_id()));
create policy "v13 atualiza agenda" on public.agenda for update to authenticated
using ((select public.usuario_e_admin()) or profissional_id = (select public.profissional_atual_id()))
with check ((select public.usuario_e_admin()) or profissional_id = (select public.profissional_atual_id()));

-- ATENDIMENTOS: admin vê/altera tudo; profissional somente os próprios.
drop policy if exists "profissionais autenticados leem atendimentos" on public.atendimentos;
drop policy if exists "profissionais autenticados cadastram atendimentos" on public.atendimentos;
drop policy if exists "profissionais autenticados atualizam atendimentos" on public.atendimentos;
drop policy if exists "v13 le atendimentos" on public.atendimentos;
drop policy if exists "v13 insere atendimentos" on public.atendimentos;
drop policy if exists "v13 atualiza atendimentos" on public.atendimentos;
create policy "v13 le atendimentos" on public.atendimentos for select to authenticated
using ((select public.usuario_e_admin()) or profissional_id = (select public.profissional_atual_id()));
create policy "v13 insere atendimentos" on public.atendimentos for insert to authenticated
with check ((select public.usuario_e_admin()) or profissional_id = (select public.profissional_atual_id()));
create policy "v13 atualiza atendimentos" on public.atendimentos for update to authenticated
using ((select public.usuario_e_admin()) or profissional_id = (select public.profissional_atual_id()))
with check ((select public.usuario_e_admin()) or profissional_id = (select public.profissional_atual_id()));

-- EVOLUÇÕES: preserva histórico; profissional só lê/adiciona evoluções em atendimentos próprios.
drop policy if exists "profissionais autenticados leem evolucoes" on public.atendimento_evolucoes;
drop policy if exists "profissionais autenticados cadastram evolucoes" on public.atendimento_evolucoes;
drop policy if exists "v13 le evolucoes" on public.atendimento_evolucoes;
drop policy if exists "v13 insere evolucoes" on public.atendimento_evolucoes;
create policy "v13 le evolucoes" on public.atendimento_evolucoes for select to authenticated
using (
  (select public.usuario_e_admin()) or exists (
    select 1 from public.atendimentos a
    where a.id = atendimento_id and a.profissional_id = (select public.profissional_atual_id())
  )
);
create policy "v13 insere evolucoes" on public.atendimento_evolucoes for insert to authenticated
with check (
  (select public.usuario_e_admin()) or (
    profissional_id = (select public.profissional_atual_id()) and exists (
      select 1 from public.atendimentos a
      where a.id = atendimento_id and a.profissional_id = (select public.profissional_atual_id())
    )
  )
);

-- Conversão de interessado passa a ser exclusiva do admin.
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
  if not public.usuario_e_admin() then raise exception 'Apenas administrador pode converter famílias'; end if;
  select * into v_interesse from public.familias_interessadas where id = p_interesse_id for update;
  if not found then raise exception 'Cadastro de interesse não encontrado'; end if;
  select id into v_familia_id from public.familias where origem_interesse_id = p_interesse_id;
  if v_familia_id is not null then
    update public.familias_interessadas set status='convertido',updated_at=now() where id=p_interesse_id;
    return v_familia_id;
  end if;
  insert into public.familias (origem_interesse_id,responsavel1,responsavel2,telefone,email,cep,logradouro,numero,complemento,bairro,cidade,estado,status,observacoes)
  values (v_interesse.id,v_interesse.responsavel1,v_interesse.responsavel2,v_interesse.telefone,v_interesse.email,v_interesse.cep,v_interesse.logradouro,v_interesse.numero,v_interesse.complemento,v_interesse.bairro,v_interesse.cidade,v_interesse.estado,'ativa',v_interesse.observacoes)
  returning id into v_familia_id;
  insert into public.filhos (familia_id,nome,idade) select v_familia_id,nome,idade from public.filhos_interesse where familia_interesse_id=p_interesse_id;
  update public.familias_interessadas set status='convertido',updated_at=now() where id=p_interesse_id;
  return v_familia_id;
end;
$$;
revoke all on function public.converter_interesse_em_familia(uuid) from public;
grant execute on function public.converter_interesse_em_familia(uuid) to authenticated;

-- BOOTSTRAP: transforma o usuário que já usa a plataforma em ADMIN.
-- Ajuste o e-mail abaixo somente se o login administrativo atual for outro.
do $$
declare
  v_user uuid;
  v_prof uuid;
begin
  select id into v_user from auth.users where lower(email)=lower('adilson.rigon@gmail.com') limit 1;
  if v_user is null then
    raise notice 'Usuário administrativo não encontrado no Auth. Crie-o antes e rode novamente esta migração.';
    return;
  end if;
  select id into v_prof from public.profissionais where lower(email)=lower('adilson.rigon@gmail.com') limit 1;
  if v_prof is null then
    insert into public.profissionais(auth_user_id,nome,email,status)
    values(v_user,'Administrador Protege','adilson.rigon@gmail.com','ativo') returning id into v_prof;
  else
    update public.profissionais set auth_user_id=v_user,updated_at=now() where id=v_prof;
  end if;
  insert into public.usuarios_perfis(user_id,profissional_id,nome,email,perfil,ativo)
  values(v_user,v_prof,coalesce((select nome from public.profissionais where id=v_prof),'Administrador Protege'),'adilson.rigon@gmail.com','admin',true)
  on conflict (user_id) do update set profissional_id=excluded.profissional_id,nome=excluded.nome,email=excluded.email,perfil='admin',ativo=true,updated_at=now();
end $$;
