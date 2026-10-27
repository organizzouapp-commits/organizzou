# Checklist: colocar organizzouapp.com no ar

Tudo que é URL absoluta (redirect do OAuth, links dos e-mails, Open Graph, canonical, sitemap, robots) vem de
`NEXT_PUBLIC_SITE_URL`. Nenhum domínio ou `localhost` está fixo no código. Ao trocar o domínio, só as configurações
abaixo mudam.

## Mapa de rotas

| Rota | Acesso | Observação |
|---|---|---|
| `/` | público | Página "Em breve" (lista de espera) |
| `/politicas` (`#termos`, `#privacidade`, `#cookies`) | público | Termos, privacidade e cookies |
| `/login`, `/cadastro` | público | Logado → redireciona para `/dashboard` |
| `/recuperar-senha` | público | Logado → redireciona para `/dashboard` |
| `/recuperar-senha/nova-senha` | público | Destino do link do e-mail (a sessão já vem do `/auth/callback`) |
| `/auth/callback` | público | Troca o código do Supabase por sessão e segue para `next` (ou `/dashboard`) |
| `/dashboard` e tudo abaixo (`/dashboard/tarefas`, `/dashboard/financas`, …) | **protegido** | Deslogado → `/login?next=<caminho>` |

URLs antigas (`/entrar`, `/hoje`, `/tarefas`, `/em-breve`, `/termos`, `/privacidade`, …) respondem 308 para as novas
(configurado em `next.config.ts`).

## 1. Vercel

1. Projeto → **Settings → Domains** → adicionar `organizzouapp.com` (apex) e `www.organizzouapp.com`.
2. Marcar o apex como principal e configurar o `www` com **Redirect to organizzouapp.com** (308).
3. No DNS do registrador, apontar o apex (registro `A` / `ALIAS`) e o `www` (`CNAME`) para os valores que a Vercel mostrar.
4. Aguardar o certificado HTTPS ficar ativo.

## 2. Variáveis de ambiente (Vercel → Settings → Environment Variables, ambiente Production)

| Variável | Valor em produção |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://organizzouapp.com` (sem barra no final) |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | `.organizzouapp.com` (o ponto inicial compartilha a escolha de cookies entre o site e o app) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | as do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | chave secreta do Supabase (obrigatória para a lista de espera gravar) |

Depois de alterar variáveis `NEXT_PUBLIC_*`, faça um novo deploy (elas entram no build).

## 3. Supabase → Authentication → URL Configuration

- **Site URL:** `https://organizzouapp.com`
- **Redirect URLs** (manter as de desenvolvimento):
  - `https://organizzouapp.com/**`
  - `http://localhost:3000/**`
- Os e-mails de confirmação e de recuperação usam essas URLs. A recuperação aponta para
  `/auth/callback?next=/recuperar-senha/nova-senha`.

## 4. Login com Google

1. **Google Cloud Console → APIs e serviços → Credenciais → ID do cliente OAuth:**
   - **Origens JavaScript autorizadas:** adicionar `https://organizzouapp.com`.
   - **URI de redirecionamento autorizado:** continua sendo o callback do Supabase
     (`https://<project-ref>.supabase.co/auth/v1/callback`). Não mude.
2. **Tela de consentimento OAuth:** domínio autorizado `organizzouapp.com`, links para
   `https://organizzouapp.com/politicas#privacidade` e `https://organizzouapp.com/politicas#termos`.
3. Tirar o app do modo **Testing**: Tela de consentimento → **Publicar app** (em teste só os usuários de teste conseguem entrar).
4. Supabase → Authentication → Providers → Google: habilitado, com Client ID e Secret.
   No `supabase/config.toml` local: `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` no `.env.local`.

## 5. Conferir depois do deploy

- [ ] `https://organizzouapp.com/` mostra a página "Em breve"; `www.` redireciona para o apex.
- [ ] `/login`, `/cadastro`, `/recuperar-senha` com as animações; logado, redirecionam para `/dashboard`.
- [ ] Deslogado, `/dashboard/financas` → `/login?next=/dashboard/financas` → após entrar, abre `/dashboard/financas`.
- [ ] Login com Google volta para `/dashboard`.
- [ ] E-mail de recuperação chega com link `https://organizzouapp.com/auth/callback?...` e abre `/recuperar-senha/nova-senha`.
- [ ] `/robots.txt` e `/sitemap.xml` mostram o domínio de produção.
- [ ] Compartilhar `https://organizzouapp.com/` mostra o cartão (Open Graph) com o logo.
- [ ] Formulário da lista de espera grava em `waitlist` (Supabase → Table editor).
