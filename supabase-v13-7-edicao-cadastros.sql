-- PROTEGE V13.7 - Edição de cadastros + auditoria
-- Execute UMA VEZ no Supabase > SQL Editor.

alter table public.familias add column if not exists updated_by uuid;
alter table public.familias add column if not exists updated_by_email text;
alter table public.filhos add column if not exists updated_by uuid;
alter table public.filhos add column if not exists updated_by_email text;
alter table public.profissionais add column if not exists updated_by uuid;
alter table public.profissionais add column if not exists updated_by_email text;
alter table public.ongs add column if not exists updated_by uuid;
alter table public.ongs add column if not exists updated_by_email text;

-- Garante atualização de filhos por usuários autenticados.
drop policy if exists "filhos_update_v137" on public.filhos;
create policy "filhos_update_v137" on public.filhos
for update to authenticated using (true) with check (true);

-- Famílias continuam editáveis pela equipe autenticada.
drop policy if exists "familias_update_v137" on public.familias;
create policy "familias_update_v137" on public.familias
for update to authenticated using (true) with check (true);

-- ONG: edição administrativa.
drop policy if exists "ongs_admin_update_v137" on public.ongs;
create policy "ongs_admin_update_v137" on public.ongs
for update to authenticated
using (public.protege_is_admin())
with check (public.protege_is_admin());

grant update on public.familias, public.filhos, public.ongs to authenticated;
