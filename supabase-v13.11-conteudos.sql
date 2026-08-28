-- PROTEGE V13.11.0 — Depoimentos, notícias, eventos e materiais públicos
-- Execute UMA VEZ no SQL Editor do Supabase após as migrações de perfis/admin.

create table if not exists public.depoimentos (
  id uuid primary key default gen_random_uuid(),
  nome_exibicao text not null,
  localidade text,
  texto text not null,
  foto_url text,
  ordem integer not null default 0,
  publicado boolean not null default false,
  autorizado_publicacao boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.publicacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'noticia' check (tipo in ('noticia','evento','conteudo')),
  titulo text not null,
  resumo text not null,
  conteudo text,
  imagem_url text,
  paper_url text,
  link_url text,
  data_evento timestamptz,
  publicado boolean not null default false,
  publicado_em timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_depoimentos_publicados on public.depoimentos(publicado,ordem,created_at desc);
create index if not exists idx_publicacoes_publicadas on public.publicacoes(publicado,publicado_em desc,created_at desc);
create index if not exists idx_publicacoes_tipo on public.publicacoes(tipo);

alter table public.depoimentos enable row level security;
alter table public.publicacoes enable row level security;

-- Público lê somente conteúdo explicitamente publicado.
drop policy if exists "publico le depoimentos publicados" on public.depoimentos;
drop policy if exists "admin gerencia depoimentos" on public.depoimentos;
create policy "publico le depoimentos publicados" on public.depoimentos for select to anon, authenticated
using (publicado = true and autorizado_publicacao = true);
create policy "admin gerencia depoimentos" on public.depoimentos for all to authenticated
using ((select public.usuario_e_admin())) with check ((select public.usuario_e_admin()));

drop policy if exists "publico le publicacoes publicadas" on public.publicacoes;
drop policy if exists "admin gerencia publicacoes" on public.publicacoes;
create policy "publico le publicacoes publicadas" on public.publicacoes for select to anon, authenticated
using (publicado = true);
create policy "admin gerencia publicacoes" on public.publicacoes for all to authenticated
using ((select public.usuario_e_admin())) with check ((select public.usuario_e_admin()));

-- Bucket público: somente admin pode gravar; arquivos publicados podem ser abertos pelo site.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('protege-conteudos','protege-conteudos',true,15728640,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "admin envia conteudos publicos" on storage.objects;
drop policy if exists "admin altera conteudos publicos" on storage.objects;
drop policy if exists "admin exclui conteudos publicos" on storage.objects;
create policy "admin envia conteudos publicos" on storage.objects for insert to authenticated
with check (bucket_id='protege-conteudos' and (select public.usuario_e_admin()));
create policy "admin altera conteudos publicos" on storage.objects for update to authenticated
using (bucket_id='protege-conteudos' and (select public.usuario_e_admin()))
with check (bucket_id='protege-conteudos' and (select public.usuario_e_admin()));
create policy "admin exclui conteudos publicos" on storage.objects for delete to authenticated
using (bucket_id='protege-conteudos' and (select public.usuario_e_admin()));
