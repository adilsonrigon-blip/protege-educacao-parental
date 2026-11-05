#!/usr/bin/env python3
"""Converte o CSV oficial CBO2002 - Ocupação (MTE) em SQL para Supabase.
Uso: python importar_cbo.py caminho/arquivo.csv
Não faz conexões nem modifica o banco automaticamente.
"""
import csv,sys,re,unicodedata
from pathlib import Path
if len(sys.argv)!=2:raise SystemExit('Uso: python importar_cbo.py CBO2002_Ocupacao.csv')
raw=Path(sys.argv[1]).read_bytes()
for encoding in ('utf-8-sig','cp1252','latin1'):
 try:text=raw.decode(encoding);break
 except UnicodeDecodeError:pass
lines=text.splitlines();dialect=csv.Sniffer().sniff('\n'.join(lines[:10]),delimiters=';,\t')
rows=list(csv.reader(lines,dialect));headers=[re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',h).encode('ascii','ignore').decode().lower()) for h in rows[0]]
code_idx=next((i for i,h in enumerate(headers) if 'codigo' in h or h=='cod'),0)
name_idx=next((i for i,h in enumerate(headers) if 'titulo' in h or 'ocupacao' in h or 'descricao' in h),1)
items={}
for row in rows[1:]:
 if len(row)<=max(code_idx,name_idx):continue
 code=re.sub(r'\D','',row[code_idx]);name=row[name_idx].strip()
 if len(code)==6 and name:items[code]=name
if len(items)<1000:raise SystemExit(f'Foram encontradas apenas {len(items)} ocupações. Confira o CSV oficial e o cabeçalho. Nenhum SQL foi gerado.')
out=Path('supabase-cbo-importacao.sql')
with out.open('w',encoding='utf-8') as f:
 f.write('-- Importação da CBO: verifique a origem e a versão do CSV antes de executar.\nBEGIN;\n')
 for code,name in sorted(items.items()):
  esc=name.replace("'","''")
  f.write(f"INSERT INTO public.profissoes (nome,codigo_cbo,ativo) VALUES ('{esc}','{code}',true) ON CONFLICT (codigo_cbo) WHERE codigo_cbo IS NOT NULL DO UPDATE SET nome=EXCLUDED.nome;\n")
 f.write('COMMIT;\n')
print(f'{len(items)} ocupações; arquivo gerado: {out}')
