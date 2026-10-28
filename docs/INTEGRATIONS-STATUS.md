# Status das integrações e funcionalidades

Legenda: **Real** = funciona de ponta a ponta com backend; **Simulado** = a interface existe, mas usa dados de exemplo
(`src/mocks/`, `isMock = true` em `src/mocks/config.ts`) ou uma resposta local, sem efeito fora do navegador; **Não construído**
= nada além de um aviso de "Em breve".

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
| Foto de perfil (upload) | Não construído (botão desabilitado, selo "Em breve") | `src/components/profile/profile-view.tsx` |
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
| Assistente de conversa (app) | Simulado: respostas por regras (regex) sobre dados de exemplo, sem IA. Marcado como "Prévia" | `src/mocks/assistant.ts`, `src/components/assistant/assistant-sheet.tsx` |
| Captura rápida (Novo) | Simulado: classifica o texto por regras e não grava nada | `src/components/assistant/quick-capture.tsx` |
| Busca global (Ctrl K) | Simulado: pesquisa só nos dados de exemplo | `src/mocks/search.ts`, `src/components/shell/command-palette.tsx` |
| Flashcards gerados a partir de anotações | Simulado (sem IA); marcado como "Em breve" | `src/components/studies/estudos-screen.tsx` |
| WhatsApp: conectar número, enviar código | Não construído (selo "Em breve"; nenhum código é enviado) | `src/components/settings/settings-extras.tsx` |
| WhatsApp: texto e voz com o assistente | Não construído | — |
| Avisos (app e WhatsApp), não perturbe | Simulado: preferências só no navegador, nada é enviado | `src/components/settings/settings-extras.tsx` |
| Lembretes das notas | Simulado: ficam só na lista; a tela avisa "Em breve" para app e WhatsApp | `src/components/notes/notas-screen.tsx` |
| Lembrete e repetição de tarefas | Não construído (campos desabilitados; migration aditiva `20260105000002` escrita e não aplicada) | `src/components/tasks/task-sheet.tsx` |

## Finanças

| Funcionalidade | Status | Onde está no código |
|---|---|---|
| Open Finance (conectar banco, importar lançamentos) | Não construído (selo "Em breve"; nenhum banco aparece como conectado) | `src/components/finance/financas-screen.tsx` |
| Lançamentos, contas fixas, orçamento, metas de economia | Simulado: estado local sobre dados de exemplo | `src/mocks/finance.ts`, `src/components/finance/financas-screen.tsx` |

## Módulos (dados)

| Módulo | Status | Onde está no código |
|---|---|---|
| Tarefas (quadros, lista, calendário, anexos) | Simulado no app (`isMock`); o servidor já tem ações e consultas reais prontas para ligar | `src/features/tasks/`, `src/mocks/tasks-api.ts` |
| Hoje, Rotina, Agenda, Treinos, Dieta, Estudos, Notas, Metas, Diário | Simulado: estado local sobre dados de exemplo; nada é salvo ao recarregar | `src/mocks/`, `src/components/*/` |
| Cofre de senhas | Simulado: itens de exemplo na memória. Exportação de backup e criptografia ainda não ligadas. O assistente e a busca global nunca leem o cofre (teste em `src/mocks/vault-guard.test.ts`) | `src/components/vault/cofre-screen.tsx`, `src/features/vault/passwords.ts` |
| Exportar dados (JSON/CSV) | Não construído (botões desabilitados) | `src/components/settings/settings-extras.tsx` |
| Notificações no sino | Simulado (exemplos fixos) | `src/components/shell/app-topbar.tsx` |

## Regra de segurança

O assistente e o WhatsApp **nunca** leem, escrevem nem recebem dados do Cofre. Hoje nenhum dos dois existe de verdade; quando
forem construídos, a proteção precisa estar no código (tabelas separadas, sem ferramenta do assistente para o cofre e uma
guarda no servidor), não só no prompt.
