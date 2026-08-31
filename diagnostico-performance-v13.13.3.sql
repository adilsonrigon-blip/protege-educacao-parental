-- PROTEGE V13.13.3 - DIAGNÓSTICO DE PERFORMANCE (somente leitura)
-- Execute no SQL Editor do Supabase e envie o resultado se a plataforma continuar lenta.
-- Este arquivo NÃO altera tabelas, dados, políticas ou índices.

-- 1) Tamanho e estimativa de linhas das tabelas principais
select
  schemaname,
  relname as tabela,
  n_live_tup as linhas_estimadas,
  n_dead_tup as linhas_mortas,
  last_analyze,
  last_autoanalyze,
  pg_size_pretty(pg_total_relation_size(format('%I.%I',schemaname,relname)::regclass)) as tamanho_total
from pg_stat_user_tables
where schemaname='public'
  and relname in ('familias_interessadas','familias','filhos','profissionais','ongs','atendimentos','atendimento_evolucoes','agenda','usuarios_perfis','pre_cadastro_profissionais','depoimentos','publicacoes')
order by pg_total_relation_size(format('%I.%I',schemaname,relname)::regclass) desc;

-- 2) Índices existentes nas tabelas usadas com maior frequência
select tablename, indexname, indexdef
from pg_indexes
where schemaname='public'
  and tablename in ('familias_interessadas','familias','profissionais','ongs','atendimentos','atendimento_evolucoes','agenda','usuarios_perfis','pre_cadastro_profissionais')
order by tablename,indexname;

-- 3) Uso dos índices (idx_scan = quantas vezes o índice foi utilizado desde o reset das estatísticas)
select
  relname as tabela,
  indexrelname as indice,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
from pg_stat_user_indexes
where schemaname='public'
  and relname in ('familias_interessadas','familias','profissionais','ongs','atendimentos','atendimento_evolucoes','agenda','usuarios_perfis','pre_cadastro_profissionais')
order by relname, idx_scan desc;

-- 4) Cache de leitura por tabela. Quanto mais próximo de 100%, melhor após aquecimento.
select
  relname as tabela,
  heap_blks_read,
  heap_blks_hit,
  case when heap_blks_hit + heap_blks_read = 0 then null
       else round(100.0 * heap_blks_hit / (heap_blks_hit + heap_blks_read),2)
  end as cache_hit_percent
from pg_statio_user_tables
where schemaname='public'
  and relname in ('familias_interessadas','familias','profissionais','ongs','atendimentos','atendimento_evolucoes','agenda')
order by relname;
