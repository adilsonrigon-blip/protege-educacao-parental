# Testes automatizados — Protege

A partir da V13.10.4, nenhuma versão deve ser gerada antes de a suíte obrigatória passar 100%.

## Suíte obrigatória
`npm test`

Ela executa:
- validação de sintaxe do `script-v126.js`;
- testes unitários de máscaras e validações brasileiras;
- teste unitário do modo de edição da família;
- contratos entre HTML e JavaScript para botões/modais críticos;
- integridade dos links internos;
- IDs HTML duplicados;
- menu lateral padronizado;
- Agenda, ONGs, Profissionais, Famílias, Atendimento, Relatórios, Dashboard e Cadastro público.

## Smoke test de navegador
`python tests/browser_smoke.py`

Teste complementar em Chromium com Supabase simulado. Ele depende de um ambiente que permita navegação headless/local. Não faz parte do gate obrigatório neste ambiente porque o navegador é bloqueado administrativamente.

## Regra de release
Toda alteração futura deve: alterar código → rodar `npm test` → corrigir qualquer falha → somente então gerar o ZIP.


## Testes responsivos

A partir da V13.10.8, `npm test` executa também `tests/responsive.test.mjs`.
A suíte valida viewport, breakpoints, menu administrativo em tablet/celular,
wrappers de tabelas, modais, formulários, filtros, tamanho mínimo de toque
e comportamento do site público em telas estreitas.

## V13.11.0 — Conteúdos públicos
A suíte obrigatória passou a validar também:
- áreas de depoimentos e notícias/eventos na Home;
- acesso administrativo exclusivo à tela Conteúdos;
- autorização obrigatória para publicar depoimentos;
- suporte a foto, texto, PDF/paper, link e data de evento;
- leitura pública somente de registros publicados;
- migração RLS e Storage para conteúdo público;
- responsividade das novas áreas públicas e administrativas.
