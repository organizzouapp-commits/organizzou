# Deploy na Vercel (primeiro deploy de produção)

Complementa `docs/DEPLOY-DOMINIO.md` (domínio, DNS, Google, Supabase Auth). Aqui: o que configurar na Vercel e **todas** as
variáveis de ambiente que o app lê. Nenhum valor real aparece neste arquivo.

## Ao importar o projeto

| Campo | Valor |
|---|---|
| Framework Preset | Next.js (detectado sozinho) |
| **Root Directory** | **`./` (a raiz do repositório; deixe como está)**. O `package.json` está na raiz do repositório |
| Build Command / Output | os padrões (`next build`). Os tipos de rota são gerados pelo próprio `next build`; nada manual |
| Install Command | o padrão (`npm install`; o `package-lock.json` está commitado e resolve sem erro de peer) |
| **Node.js Version** | **24.x** (Settings → General → Node.js Version). O `package.json` também fixa `"engines": { "node": "24.x" }` |

Segurança sempre ativa (em `next.config.ts`): `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin` e uma `Permissions-Policy` que desliga câmera, microfone, localização,
pagamento e USB no navegador. O HSTS é aplicado pela própria Vercel. Não há `vercel.json` e **não há cron jobs**: nada a
ajustar para o plano Hobby.

## Variáveis de ambiente

Cadastre em Vercel → Settings → Environment Variables, ambiente **Production** (e **Preview**, se for usar). Depois de mudar
qualquer `NEXT_PUBLIC_*`, faça um novo deploy: elas entram no build.

### O app lê estas

| Nome | Obrigatória? | Pública / só servidor | Onde achar | O que quebra sem ela |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Sim** | Pública | Supabase → Project Settings → API → Project URL | Nada funciona: login, cadastro, dashboard e lista de espera falham com "Supabase não configurado" |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou o alias `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | **Sim** (uma das duas) | Pública | Supabase → Project Settings → API Keys → Publishable key (`sb_publishable_…`) | Igual à de cima |
| `NEXT_PUBLIC_SITE_URL` | **Sim** | Pública | O domínio final, ex.: `https://organizzouapp.com` (sem `/` no final) | Links dos e-mails, redirect do Google, Open Graph, sitemap e robots saem com o endereço errado. Sem ela na Vercel o app usa o endereço da própria Vercel (`VERCEL_PROJECT_PRODUCTION_URL`), o que evita `localhost`, mas não é o domínio certo |
| `SUPABASE_SECRET_KEY` | **Sim** | **Só servidor** | Supabase → Project Settings → API Keys → Secret key (`sb_secret_…`) | A lista de espera não grava; no admin, as ações que escrevem (plano, suspender, sessões, exportar CSV) ficam desativadas |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | Recomendada | Pública | `.organizzouapp.com` (com o ponto inicial) | A escolha de cookies não é compartilhada entre o site e o app (o banner reaparece) |
| `ANTHROPIC_API_KEY` | Opcional | **Só servidor** | console.anthropic.com → API Keys | Só aparece como "Não configurada" na página Status do admin. O assistente atual é simulado e não usa a chave |
| `SUPABASE_SERVICE_ROLE_KEY` | Não (nome antigo) | **Só servidor** | O mesmo valor de `SUPABASE_SECRET_KEY` | Ainda é aceita como alternativa; use `SUPABASE_SECRET_KEY` |
| `GIT_COMMIT_SHA` | Opcional | Só servidor | A Vercel já fornece `VERCEL_GIT_COMMIT_SHA` sozinha | Só o commit na página Status do admin |

Nunca coloque `NEXT_PUBLIC_` na frente de uma chave secreta: ela iria para o navegador de todo mundo.

### A Vercel define sozinha (não cadastre)

`NODE_ENV`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_GIT_COMMIT_SHA`.

### NÃO defina em produção

| Nome | Por quê |
|---|---|
| `PROTOTYPE_BYPASS_AUTH` | Pula o login (só para capturas de tela locais). **É ignorada em produção** (`NODE_ENV` ou `VERCEL_ENV` = `production`), com teste em `src/lib/supabase/bypass.test.ts`; mesmo assim, não cadastre |
| `NEXT_DIST_DIR` | Muda a pasta de build; só para um segundo servidor local |
| `BASE`, `OUT`, `ONLY`, `SHOTS`, `LABEL`, `INJECT`, `THROTTLE`, `VERBOSE`, `MAX_CLICKS`, `QA_REPORT` | Só dos scripts de teste (Playwright) |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_TARGET_EMAIL`, `RLS_CHECK_EMAIL` | Credenciais de teste: nunca na Vercel |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | Só para o Supabase **local** (`supabase/config.toml`). O Google em produção é configurado no painel do Supabase (veja `DEPLOY-DOMINIO.md`) |

O cookie `dev_admin` (e `dev_plan`, `dev_whatsapp`) só tem efeito com `PROTOTYPE_BYPASS_AUTH`, ou seja, nunca em produção.

## Banco de dados (Supabase)

Estado conferido com `npx supabase migration list`:

| Migration | Estado | Se faltar |
|---|---|---|
| `20260101000001` … `20260105000002` (núcleo, tarefas, lista de espera, plano, lembretes) | aplicadas | — |
| `20260201000001` … `20260201000003` (admin: acesso, atividade, funções) | aplicadas | O admin mostra "Não foi possível carregar" |
| `20261102000001_profiles_dashboard_prefs.sql` (personalização da página Hoje) | **ainda não aplicada** | O app **não quebra**: as preferências ficam no cookie deste navegador em vez de seguir a conta |

Antes do primeiro login de admin em produção: Supabase → Project Settings → API → **Exposed schemas** → adicionar `admin`
(ver `docs/ADMIN.md`).

## Antes e depois do deploy

1. Cadastrar as variáveis acima, escolher Node 24.x, importar com Root Directory `./`.
2. Seguir `docs/DEPLOY-DOMINIO.md` (domínio, URLs do Supabase Auth, Google).
3. Conferir no site publicado: `/` abre; `/dashboard` deslogado vai para `/login`; `/admin` deslogado responde 404; cabeçalhos
   de segurança presentes (DevTools → Network → qualquer resposta).
4. Primeiro admin: no seu computador, com o `.env.local` apontando para o mesmo projeto Supabase, `npm run admin:grant`.
