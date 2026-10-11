-- PROTEGE V13.24.30 — Quem Somos
-- Execute UMA VEZ no SQL Editor do Supabase.
create table if not exists public.quem_somos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  posicao text not null,
  biografia text not null,
  foto_url text,
  linkedin_url text,
  instagram_url text,
  facebook_url text,
  site_url text,
  ordem integer not null default 0,
  publicado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_quem_somos_publicado_ordem on public.quem_somos(publicado,ordem,nome);
alter table public.quem_somos enable row level security;
drop policy if exists "publico le quem somos publicado" on public.quem_somos;
drop policy if exists "admin gerencia quem somos" on public.quem_somos;
create policy "publico le quem somos publicado" on public.quem_somos for select to anon, authenticated using (publicado=true);
create policy "admin gerencia quem somos" on public.quem_somos for all to authenticated using ((select public.usuario_e_admin())) with check ((select public.usuario_e_admin()));
-- Reutiliza o bucket publico protege-conteudos, já existente no projeto.
