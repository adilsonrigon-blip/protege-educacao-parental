# Protege - Educação Parental

Primeira versão navegável do site e protótipo do sistema de atendimentos.

## Estrutura

- `index.html` - Home institucional
- `login.html` - Login demonstrativo
- `dashboard.html` - Dashboard
- `atendimento.html` - Wizard de atendimento com 10 passos
- `css/style.css` - Identidade visual e responsividade
- `js/script.js` - Interações
- `images/logo-protege.jpeg` - Logo enviado pela Protege

## Executar

Como é uma primeira versão estática, basta abrir `index.html` no navegador.

Para desenvolvimento local recomendado:

```bash
python -m http.server 5500
```

Depois acesse `http://localhost:5500`.

## Próxima etapa

Substituir o login demonstrativo e o armazenamento local pelo Supabase:
- autenticação;
- usuários e perfis;
- profissionais;
- famílias;
- filhos;
- agenda;
- atendimentos;
- supervisão;
- auditoria;
- políticas de acesso (RLS).
