# Organizzou Admin

Área interna em `/admin` para acompanhar usuários, planos e a saúde do produto. Usa **o mesmo shell do app** (cabeçalho, sidebar,
rail, cabeçalho e pílula do celular, Ctrl/Cmd K); só muda a navegação (`src/components/shell/admin-nav.ts`) e as ações do
cabeçalho (busca + "Voltar ao app").

> Estado: tudo isto está na branch `experiment/admin`. **Nenhuma migration foi aplicada** no banco. Veja "Colocando no ar" abaixo.

## Quem é admin

Admin = usuário do Supabase com `app_metadata.role = 'admin'`. Usuários **não conseguem** editar `app_metadata`; só a chave secreta
do servidor consegue. A função SQL `public.is_admin()` lê `auth.jwt() -> 'app_metadata' ->> 'role'`.

### Dar e tirar admin

```bash
npm run admin:grant    # pergunta o e-mail e torna a conta admin
npm run admin:revoke   # pergunta o e-mail e remove o papel
```

Os dois usam `scripts/make-admin.ts`, leem `.env.local` e gravam uma linha na auditoria. A pessoa precisa **sair e entrar de novo**
(ou esperar o token renovar) para o papel aparecer no JWT.

### Onde fica a chave secreta

Abra o arquivo **`.env.local`** (na raiz do projeto, nunca é versionado) e preencha, você mesmo, sem aspas:

```
SUPABASE_SECRET_KEY=sb_secret_...
```

Pegue em Supabase → Project Settings → API Keys → **Secret key**. Não cole a chave em chat, issue ou commit. Ela só é lida em
`src/lib/admin/secret.ts` (`import "server-only"`; um teste garante que nenhum componente de cliente a importa).

Sem a chave, as páginas de leitura funcionam, mas as ações que escrevem (alterar plano, suspender/reativar, reenviar confirmação,
encerrar sessões, exportar CSV) ficam **desativadas** com o aviso "Configure a chave do servidor".
Uma só chave serve a tudo no servidor (admin e lista de espera do site). O nome antigo `SUPABASE_SERVICE_ROLE_KEY` ainda é lido como alternativa, mas use `SUPABASE_SECRET_KEY`.

## Colocando no ar (ainda não feito)

Migrations novas, todas **aditivas** e compatíveis com o que já existe, em `supabase/migrations/`:

| Arquivo | O que faz |
|---|---|
| `20260201000001_admin_access.sql` | `public.is_admin()`, schema `admin`, `admin_audit_log`, `plan_history`, `profiles.plan_until`, `admin.revoke_user_sessions` |
| `20260201000002_profiles_last_seen.sql` | `profiles.last_seen_at`, `user_activity_hourly`, `public.touch_activity()` |
| `20260201000003_admin_functions.sql` | funções de leitura do schema `admin` (as páginas) |

Ordem: aplicar as três (`supabase db push`, só depois da sua aprovação) → no painel do Supabase, **Project Settings → API → Exposed
schemas**, adicionar **`admin`** (o `supabase/config.toml` local já inclui) → `npm run admin:grant` → entrar de novo.

Enquanto isso não for feito, cada página mostra o cartão "Não foi possível carregar estes dados" com o erro técnico (por exemplo
`PGRST106: Invalid schema: admin`), nunca zeros inventados.

Depois de aplicar, rode `supabase/tests/admin_forbidden.sql` no SQL Editor: ele não altera nada (faz rollback) e falha com o nome
da função se algum acesso estiver errado.

## Acesso e segurança (três travas)

1. **Proxy** (`src/lib/supabase/proxy.ts`): qualquer `/admin/**` de quem não é admin (deslogado ou não) responde **404**, sem
   redirecionar ao login e sem pista de que a área existe. `robots.txt` não menciona `/admin` de propósito.
2. **Layout/ações** (`src/lib/admin/guard.ts`): checagem no servidor; as ações ainda chamam `is_admin()` no banco, então um admin
   revogado é barrado mesmo com token ainda válido.
3. **Banco**: toda função do schema `admin` é `SECURITY DEFINER`, fixa `search_path` e começa com
   `if not public.is_admin() then raise exception 'forbidden'; end if;`. `execute` é revogado de `anon`/`public` e concedido só a
   `authenticated`.

Toda escrita de admin usa a chave secreta **no servidor**, passa por um `alert-dialog` de confirmação e grava em
`admin_audit_log` (admin, ação, pessoa afetada, detalhes, data). A tabela só tem `select` para admin; inserir é só pelo servidor.
Exportar CSV também é registrado (copia dados pessoais para fora do app); se o registro falhar, a exportação é cancelada.

## Privacidade (LGPD)

Admins veem **dados da conta e agregados**. Nunca:

- conteúdo de tarefas, notas, finanças, dieta, diário ou estudos (títulos, descrições, textos, comentários, anexos);
- nada do schema `vault`, nem sequer contagens por usuário;
- o `payload` do `audit_log` do assistente (pode conter conteúdo): só ator, ação, confirmação, usuário e data;
- mensagens do assistente (nem existe tabela delas).

O painel de uma pessoa mostra **apenas contagens** por módulo (quadros, tarefas, etiquetas, anexos). Os testes
`src/lib/admin/admin-privacy.test.ts` leem as migrations e falham se uma função admin: não começar com a checagem, referenciar
`vault`, usar uma coluna de conteúdo, ler uma tabela fora da lista permitida, ou se a chave secreta escapar para o cliente.

## O que cada página mede

Todos os dias são em **America/Sao_Paulo**.

**Definições de atividade.** Um *dia ativo* é um dia em que a pessoa abriu o app. O proxy chama `public.touch_activity()` no
máximo uma vez a cada 10 minutos por navegador (um cookie de 10 min faz o controle; roda depois da resposta, sem pedido extra por
página). Ele grava `profiles.last_seen_at` e uma linha `(usuário, hora)` em `user_activity_hourly`.
- **Ativos hoje**: pessoas com dia ativo hoje. **DAU/WAU/MAU**: pessoas distintas com dia ativo no dia / nos últimos 7 / 30 dias.
- **Fallback**: quem ainda não tem registro usa `auth.users.last_sign_in_at` (uma única data).
- **O histórico começa quando a migration for aplicada.** As páginas dizem "medido desde …"; semanas anteriores aparecem como "—",
  nunca como 0%.

| Página | O que mostra | De onde vem |
|---|---|---|
| **Visão geral** | Usuários totais, ativos hoje, ativos 7 dias, novos 7 dias, Plano Pro, lista de espera, cada um com a variação (setas e sinal, sem cor) contra o período anterior; cadastros por dia (30/90/365), DAU/WAU/MAU, distribuição de planos; últimos cadastros e alertas | `admin.overview_stats`, `signups_by_day`, `active_users_series`, `plan_distribution`, `recent_signups`. "Sem base de comparação" quando não há dado anterior honesto (ex.: Pro de 7 dias atrás) |
| **Usuários** | Tabela com busca (nome/e-mail), filtros (plano, status, ativo/inativo, período de cadastro), ordenação, paginação no servidor e CSV das colunas visíveis. Clique abre o painel (lateral ≥1024px, tela cheia no celular): conta, contagens por módulo, histórico de plano, ações do admin e auditoria da pessoa | `admin.list_users`, `user_detail`; `plan_history`, `admin_audit_log` |
| **Atividade** | DAU/WAU/MAU; retenção por coorte (semana do cadastro × semanas 1–8, % da turma que abriu o app); mapa de horários de pico (pessoas distintas por dia da semana × hora) | `active_users_series`, `cohort_retention`, `activity_heatmap` |
| **Assinaturas e pagamentos** | Pessoas por plano e cortesias ativas (reais). MRR, churn, faturas e falhas: **"Em breve"**, sem números | `plan_distribution`, `active_courtesies`; interface tipada `src/lib/admin/billing.ts` para ligar um provedor depois |
| **Lista de espera** | Total, por origem (site / diálogo do Plano Pro), tabela com busca e CSV | tabela `waitlist` via `admin.waitlist_list` |
| **Planos e limites** | Somente leitura de `src/lib/plans.ts` (recursos, limites, preços provisórios). Mudanças são feitas no código | `src/lib/plans.ts` |
| **Uso dos módulos** | Registros criados por semana e % dos ativos (30 dias) que usam cada recurso. Só **contagens** | `admin.module_usage`, `module_adoption`. Hoje só Tarefas, Quadros, Etiquetas e Anexos têm tabela; os demais módulos são simulados e a página diz isso |
| **Assistente e IA** | Ações por dia e por ferramenta, taxa de confirmação, quem mais usa (id + e-mail). Mensagens por dia e custo em tokens: "Em breve", com o que precisa ser registrado | `public.audit_log` (sem o `payload`) via `admin.assistant_usage` |
| **Integrações** | Um cartão por integração de `docs/INTEGRATIONS-STATUS.md` com Real / Simulado / Não construído; números só onde é real (contas, Google, telefones informados) | `src/lib/admin/integrations.ts`, `admin.integration_numbers` |
| **Status** | Verificações feitas pelo servidor ao abrir e em "Verificar agora": banco (latência), autenticação, armazenamento, presença da chave da Claude (só presença), versão/commit, ambiente, última migration. Cada uma com ícone + texto: Operacional / Lento (>1,2 s) / Fora do ar / Não verificado | `src/lib/admin/status.ts`; sem serviço externo de monitoramento |
| **Suporte** | "Em breve": a tabela de relatos ainda não existe (veja abaixo) | `tableExists("support_reports")` |
| **Auditoria** | Tudo que um admin fez, com filtros por admin, ação e data | `admin_audit_log` (RLS: só admin lê) |

## O que ainda não existe (e a página diz isso)

- **WhatsApp vinculado**: a coluna da tabela de usuários existe, mas vale **Não** para todos, porque vincular WhatsApp ainda não
  foi construído. "Telefone informado" (do cadastro) aparece à parte no painel.
- **Pagamentos**: sem provedor, sem faturas, sem MRR/churn. Todo Pro é concedido por um admin (opcionalmente como cortesia com data
  de fim; depois dela a pessoa volta ao Gratuito sozinha, via `profiles.plan_until`).
- **Suporte**: o formulário "Reportar problema" ainda é só um aviso. Quando existir, crie `public.support_reports`
  (usuário, mensagem, status `aberto|em andamento|resolvido`, responsável, nota de resposta) e a caixa de entrada do admin é ligada
  a ela.
- **Mensagens e tokens do assistente**: não são registrados. Para ligar: tabela `assistant_messages (user_id, dia, canal)` **sem o
  texto** e tokens de entrada/saída por chamada.
- **Busca global (Ctrl/Cmd K)** no admin: vai a qualquer página do admin. Busca de usuário por nome/e-mail é a página Usuários.
- **Módulos simulados** (Hoje, Rotina, Agenda, Finanças, Treinos, Dieta, Estudos, Notas, Metas, Diário, Cofre): sem tabela, sem contagem.

## Desenvolvimento e testes

- `PROTOTYPE_BYPASS_AUTH=1` (só em desenvolvimento): o cookie `dev_admin=1` mostra a interface do admin sem login. Não dá acesso a
  dados (não há sessão) e **não funciona em produção** (testado: 404).
- `npx vitest run`: inclui `admin-privacy.test.ts` (regras de privacidade e acesso, sem banco).
- `npx playwright test admin`: 404 para não-admins em todas as rotas, admin vê todas as páginas, shell do app inalterado. O teste
  "alterar plano" (Pro na lista, auditoria, o app da pessoa sem "Fazer upgrade") precisa de projeto real e é pulado sem `E2E_ADMIN_EMAIL`,
  `E2E_ADMIN_PASSWORD`, `E2E_TARGET_EMAIL` e `E2E_TARGET_PASSWORD` (conta descartável, que não seja admin).
- `src/features/admin/change-plan.test.ts`: a ação de plano nunca dá sucesso falso (sem linha em `profiles`, gravação não guardada, chave ausente).
- `supabase/tests/admin_forbidden.sql`: comportamento no banco (não-admin recebe `forbidden`; `anon` não executa).
- `supabase/tests/profiles_protect_plan.sql`: o gatilho deixa o service role mudar `plan`/`plan_until` e bloqueia o usuário comum (faz rollback).

**Conta sem linha em `profiles`**: o `UPDATE` de um perfil que não existe afeta 0 linhas e não dá erro. A ação de plano agora cria o perfil que falta, lê a linha de volta e só então registra histórico e auditoria; a migration `20261102000002_profiles_backfill.sql` cria os perfis que faltam nas contas antigas.
