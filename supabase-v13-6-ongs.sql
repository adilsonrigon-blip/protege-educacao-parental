-- PROTEGE V13.6 - ONGs
-- Execute uma única vez no Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.ongs (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  responsavel text,
  telefone text,
  email text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  observacoes text,
  status text not null default 'ativa' check (status in ('ativa','inativa')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ongs_cnpj_unique
  on public.ongs (cnpj)
  where cnpj is not null and trim(cnpj) <> '';

alter table public.familias
  add column if not exists ong_id uuid references public.ongs(id) on delete set null;

alter table public.profissionais
  add column if not exists ong_id uuid references public.ongs(id) on delete set null;

create index if not exists idx_familias_ong_id on public.familias(ong_id);
create index if not exists idx_profissionais_ong_id on public.profissionais(ong_id);

create or replace function public.protege_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios_perfis up
    where up.user_id = auth.uid()
      and up.perfil = 'admin'
      and up.ativo = true
  );
$$;

revoke all on function public.protege_is_admin() from public;
grant execute on function public.protege_is_admin() to authenticated;

alter table public.ongs enable row level security;

drop policy if exists "ongs_read_authenticated" on public.ongs;
create policy "ongs_read_authenticated"
on public.ongs for select
to authenticated
using (true);

drop policy if exists "ongs_admin_insert" on public.ongs;
create policy "ongs_admin_insert"
on public.ongs for insert
to authenticated
with check (public.protege_is_admin());

drop policy if exists "ongs_admin_update" on public.ongs;
create policy "ongs_admin_update"
on public.ongs for update
to authenticated
using (public.protege_is_admin())
with check (public.protege_is_admin());

drop policy if exists "ongs_admin_delete" on public.ongs;
create policy "ongs_admin_delete"
on public.ongs for delete
to authenticated
using (public.protege_is_admin());

-- Permite que um Admin associe/desassocie uma ONG de uma família.
drop policy if exists "familias_admin_update_v136" on public.familias;
create policy "familias_admin_update_v136"
on public.familias for update
to authenticated
using (public.protege_is_admin())
with check (public.protege_is_admin());

grant select on public.ongs to authenticated;
grant insert, update, delete on public.ongs to authenticated;
