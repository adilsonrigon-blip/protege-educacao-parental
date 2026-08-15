# Protege Educação Parental — V5

Nesta versão foi iniciada a transformação do site em plataforma operacional.

## Novidades
- Formulário público grava famílias interessadas no banco Supabase.
- Grade de filhos vinculada ao cadastro da família.
- Login profissional preparado para Supabase Auth.
- Nova página `familias-interessadas.html` com busca, filtro, status, observações e WhatsApp.
- Dashboard mostra novos interesses e os cadastros mais recentes.
- Modo de teste local continua funcionando enquanto o Supabase ainda não estiver conectado.

## Para ativar o banco real
1. Crie um projeto gratuito no Supabase.
2. Abra SQL Editor e execute todo o arquivo `supabase.sql`.
3. Em Authentication > Users, crie o primeiro usuário profissional (e-mail e senha).
4. Em Project Settings > API, copie a Project URL e a chave anon/public.
5. Abra `config.js` e cole os dois valores.
6. Envie todos os arquivos desta pasta para o repositório GitHub, substituindo os existentes.

## Segurança inicial
O SQL habilita Row Level Security (RLS): visitantes anônimos podem inserir novos cadastros, mas somente usuários autenticados podem ler ou alterar a fila de famílias interessadas.

## Próxima etapa
Converter um cadastro aprovado em Família/Filhos definitivos e conectar os atendimentos ao banco.
