-- PROTEGE V13.19.0 - Gestão administrativa de adolescentes
-- Pré-requisitos: V13.17.0 e V13.18.0.
-- Execute uma única vez no Supabase SQL Editor antes de publicar a V13.19.0.

alter table public.cadastros_adolescentes add column if not exists status text not null default 'ativo';
alter table public.cadastros_adolescentes add column if not exists observacoes text;
alter table public.cadastros_adolescentes add column if not exists ong_id uuid;
alter table public.cadastros_adolescentes add column if not exists updated_by uuid;
alter table public.cadastros_adolescentes add column if not exists updated_by_email text;

alter table public.cadastros_adolescentes drop constraint if exists cadastros_adolescentes_status_chk;
alter table public.cadastros_adolescentes add constraint cadastros_adolescentes_status_chk check (status in ('ativo','pausado','encerrado'));

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname='cadastros_adolescentes_ong_id_fkey' and conrelid='public.cadastros_adolescentes'::regclass
  ) then
    alter table public.cadastros_adolescentes add constraint cadastros_adolescentes_ong_id_fkey foreign key (ong_id) references public.ongs(id) on delete set null;
  end if;
end $$;

create index if not exists cadastros_adolescentes_status_created_idx on public.cadastros_adolescentes(status,created_at desc);
create index if not exists cadastros_adolescentes_ong_created_idx on public.cadastros_adolescentes(ong_id,created_at desc) where ong_id is not null;

grant select on table public.cadastros_adolescentes to authenticated;
grant update on table public.cadastros_adolescentes to authenticated;

drop policy if exists cadastros_adolescentes_update_admin on public.cadastros_adolescentes;
create policy cadastros_adolescentes_update_admin on public.cadastros_adolescentes
for update to authenticated
using (public.protege_is_admin())
with check (public.protege_is_admin());


-- Mantém o mesmo padrão de auditoria administrativa usado nas famílias.
drop trigger if exists protege_audit_cadastros_adolescentes on public.cadastros_adolescentes;
create trigger protege_audit_cadastros_adolescentes
after insert or update or delete on public.cadastros_adolescentes
for each row execute function public.protege_audit_trigger();

analyze public.cadastros_adolescentes;
