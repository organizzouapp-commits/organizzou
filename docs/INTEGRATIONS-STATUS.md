# Status das integrações e funcionalidades

Legenda: **Real** = funciona de ponta a ponta com backend; **Simulado** = a interface existe, mas usa dados de exemplo
(`src/mocks/`, só no protótipo local sem login, `PROTOTYPE_BYPASS_AUTH=1`; `isMock` em `src/mocks/config.ts`) ou uma resposta local, sem efeito fora do navegador; **Não construído**
= nada além de um aviso de "Em breve".

Auditoria completa por módulo, com as tabelas: `docs/DATA-AUDIT.md`.

Regra do produto: a interface nunca afirma que algo aconteceu se não aconteceu. Tudo que é simulado e tem efeito externo
(WhatsApp, banco, e-mail, pagamento, IA) aparece com selo **"Em breve"** e controle desabilitado com uma explicação curta.

## Contas e acesso

| Funcionalidade | Status | Onde está no código |
|---|---|---|
| Criar conta, entrar com e-mail e senha | Real (Supabase Auth) | `src/features/auth/actions.ts`, `src/components/auth/` |
| Entrar com Google | Real (Supabase OAuth; exige configurar o provedor) | `src/components/auth/auth-parts.tsx`, `src/app/auth/callback/route.ts` |
| Recuperar e trocar senha | Real (e-mail enviado pelo Supabase) | `src/features/auth/actions.ts`, `src/components/profile/profile-view.tsx` |
| Perfil (nome, telefone) e tema | Real (`profiles`) | `src/features/settings/actions.ts` |
| Lista de espera (site) | Real (tabela `waitlist`, service role, limite por IP/e-mail) | `src/features/waitlist/actions.ts` |
| Lista de espera do Plano Pro | Real (mesma tabela, `source = plano-pro`) | `src/components/plan/pro-waitlist-dialog.tsx` |
| Verificação em duas etapas | Não construído (selo "Em breve") | `src/components/settings/settings-extras.tsx` |
| Passkeys (biometria) | Não construído (selo "Em breve") | `src/components/settings/settings-extras.tsx` |
| Excluir conta | Não construído (botão desabilitado com explicação) | `src/components/settings/settings-extras.tsx` |
| Foto de perfil (upload) | Não construído (botão desabilitado, selo "Em breve"); bucket `avatars` e `profiles.avatar_path` já existem | `src/components/profile/profile-view.tsx` |
| Reportar problema (Ajuda) | Não construído (formulário desabilitado, selo "Em breve"; o e-mail de suporte é um endereço provisório) | `src/components/help/help-view.tsx` |

## Pagamentos e planos

| Funcionalidade | Status | Onde está no código |
|---|---|---|
| Pagamentos / assinatura | **Não construído (planejado).** Nenhum provedor integrado e nenhum dado de cartão é guardado | — |
| Definição dos planos Gratuito e Pro, limites e preços (placeholders `TODO(owner)`) | Real (apenas configuração) | `src/lib/plans.ts` |
| Plano do usuário | Real quando a migration `20260105000001_profiles_plan.sql` for aplicada; até lá, todos são `free` | `src/lib/plan-server.ts`, `src/components/organizzou/plan-context.tsx` |
| Página "Plano Pro" e pontos de entrada "Fazer upgrade" | Real (interface); o botão leva para a lista de espera | `src/app/(app)/dashboard/plano/`, `src/components/plan/` |

## Assistente e mensageria

| Funcionalidade | Status | Onde está no código |
|---|---|---|
| Assistente de conversa (app) | Protótipo: respostas por regras sobre dados de exemplo. **Conta real: "Em breve"**, sem respostas inventadas | `src/mocks/assistant.ts`, `src/components/assistant/assistant-sheet.tsx` |
| Captura rápida (Novo) | **Real** em conta real: vira tarefa, gasto ("gastei 45 no mercado") ou nota; no protótipo é só prévia | `src/components/assistant/quick-capture.tsx`, `src/features/assistant/actions.ts` |
| Busca global (Ctrl K) | **Real** em conta real (títulos dos dados do próprio usuário); no protótipo, dados de exemplo | `src/features/search/actions.ts`, `src/components/shell/command-palette.tsx` |
| Flashcards gerados a partir de anotações | Simulado (sem IA); marcado como "Em breve" | `src/components/studies/estudos-screen.tsx` |
| WhatsApp: conectar número, enviar código | Não construído (selo "Em breve"; nenhum código é enviado) | `src/components/settings/settings-extras.tsx` |
| WhatsApp: texto e voz com o assistente | Não construído | — |
| Avisos (app e WhatsApp), não perturbe | Simulado: preferências só no navegador, nada é enviado (a tabela `notification_preferences` já existe e é criada no cadastro) | `src/components/settings/settings-extras.tsx` |
| Lembretes das notas | **Real** (gravados em `reminders`); a entrega por app e WhatsApp segue "Em breve" e a tela avisa | `src/components/notes/notas-screen.tsx` |
| Lembrete e repetição de tarefas | Não construído (campos desabilitados; migration aditiva `20260105000002` escrita e não aplicada) | `src/components/tasks/task-sheet.tsx` |

## Finanças

| Funcionalidade | Status | Onde está no código |
|---|---|---|
| Open Finance (conectar banco, importar lançamentos) | Não construído (selo "Em breve"; nenhum banco aparece como conectado) | `src/components/finance/financas-screen.tsx` |
| Lançamentos, contas fixas, orçamento, metas de economia | **Real** (`finance_*`) | `src/features/persist/`, `src/components/finance/financas-screen.tsx` |

## Módulos (dados)

| Módulo | Status | Onde está no código |
|---|---|---|
| Tarefas (quadros, lista, calendário, anexos) | **Real** | `src/features/tasks/` |
| Hoje, Rotina, Agenda, Treinos, Dieta, Estudos, Notas, Metas, Diário | **Real**: gravam por usuário (RLS) e sobrevivem ao recarregar. Exigem as migrations `20261103000001..3` | `src/features/persist/`, `supabase/migrations/20261103*`, `docs/DATA-AUDIT.md` |
| Cofre de senhas | **Em breve** em conta real (página honesta, nada é guardado); no protótipo, itens de exemplo na memória. Criptografia no navegador ainda não construída. O assistente e a busca global nunca leem o cofre (teste em `src/mocks/vault-guard.test.ts`) | `src/components/vault/cofre-screen.tsx`, `src/features/vault/passwords.ts` |
| Exportar dados (JSON/CSV) | Não construído (botões desabilitados) | `src/components/settings/settings-extras.tsx` |
| Notificações no sino | Protótipo: exemplos fixos. **Conta real: vazio e "em breve"** | `src/components/shell/app-topbar.tsx` |

## Área admin

| Funcionalidade | Status | Onde está no código |
|---|---|---|
| Painel `/admin` (visão geral, usuários, atividade, assinaturas, lista de espera, planos, módulos, assistente, integrações, status, auditoria) | Real quando as migrations `20260201000001..3` forem aplicadas e o schema `admin` exposto; antes disso, cada página avisa que não carregou | `src/app/(admin)/admin/`, `supabase/migrations/20260201*`, `docs/ADMIN.md` |
| Ações do admin (plano, suspender, sessões, e-mail de confirmação) com auditoria | Real; exige `SUPABASE_SECRET_KEY` no servidor | `src/features/admin/actions.ts` |
| Suporte (caixa de relatos) | Não construído (não existe a tabela de relatos) | `src/app/(admin)/admin/suporte/` |
| MRR, churn, faturas e falhas de pagamento | Não construído (sem provedor); interface tipada pronta | `src/lib/admin/billing.ts` |

## Regra de segurança

O assistente e o WhatsApp **nunca** leem, escrevem nem recebem dados do Cofre. Hoje nenhum dos dois existe de verdade; quando
forem construídos, a proteção precisa estar no código (tabelas separadas, sem ferramenta do assistente para o cofre e uma
guarda no servidor), não só no prompt.
