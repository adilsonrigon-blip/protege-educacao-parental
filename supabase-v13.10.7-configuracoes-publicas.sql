-- PROTEGE V13.10.7
-- Configuracoes publicas administradas diretamente pelo SQL Editor.

create table if not exists public.configuracoes_publicas (
  chave text primary key,
  valor text not null,
  updated_at timestamptz not null default now()
);

alter table public.configuracoes_publicas enable row level security;

drop policy if exists "configuracoes_publicas_select" on public.configuracoes_publicas;
create policy "configuracoes_publicas_select"
on public.configuracoes_publicas
for select
to anon, authenticated
using (true);

insert into public.configuracoes_publicas (chave, valor, updated_at)
values ('whatsapp_contato', '5511965980606', now())
on conflict (chave) do update
set valor = excluded.valor,
    updated_at = now();

-- ALTERAR O WHATSAPP:
-- update public.configuracoes_publicas
-- set valor = '5511999999999', updated_at = now()
-- where chave = 'whatsapp_contato';
