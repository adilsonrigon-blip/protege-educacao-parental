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
