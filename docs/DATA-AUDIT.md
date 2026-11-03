# Auditoria de dados por módulo

Branch `feat/real-data`. Legenda: **Real** = lê e grava no Supabase, por usuário, e sobrevive ao recarregar; **Simulado** = dados de
exemplo ou estado só na memória do navegador; **Quebrado** = grava e a gravação falha ou volta ao recarregar.

## Antes (o que a auditoria achou)

`isMock = true` valia em **todos** os ambientes (`src/mocks/config.ts`). Cada tela guardava o estado em `useState` iniciado com
`src/mocks/*`, então nada sobrevivia ao recarregar, e só existiam tabelas para Tarefas (e perfil/admin).

| Módulo | Tela / ação | Status antes | Tabelas antes |
|---|---|---|---|
| Hoje | Destaques, Seu dia, painéis | Simulado (mocks) | só `tasks`, `boards` |
| Hoje | Marcar item como feito em "Seu dia" | **Quebrado**: tarefas iam para a API de exemplo e hábitos, água e humor ficavam numa camada só do cliente (`today-state`); ao recarregar tudo voltava | — |
| Hoje | Layout (Personalizar) | Real em cookie/localStorage; coluna `profiles.dashboard_prefs` existia só em migration | `profiles` |
| Tarefas | Quadros, listas, cartões, checklist, comentários, etiquetas, arrastar, concluir | Simulado no app (`isMock`); servidor com ações reais prontas, mas desligadas | existiam |
| Rotina | Hábitos fixos e de quantidade, registros, sequências | Simulado | faltavam |
| Agenda | Eventos, recorrência, tarefas e treinos no calendário | Simulado | faltava `events` |
| Finanças | Contas, categorias, lançamentos, contas fixas, orçamento, metas | Simulado | faltavam todas |
| Treinos | Planos, exercícios, sessões, séries | Simulado | faltavam todas |
| Dieta | Refeições, alimentos, água, peso, metas | Simulado | faltavam todas |
| Estudos | Matérias, sessões/timer, provas, flashcards | Simulado | faltavam todas |
| Notas e lembretes | Notas, pastas, lembretes | Simulado | faltavam todas |
| Metas | Metas de vida, ligações, marcos | Simulado | faltavam todas |
| Diário | Humor, sono, check-in | Simulado | faltava `journal_entries` |
| Cofre | Senhas e documentos | Simulado (texto puro de exemplo na memória) | faltava |
| Configurações / Perfil | Nome, telefone, tema | Real (`profiles`) | existia |
| Plano | Plano e expiração da cortesia | Real (lê `profiles.plan`, `plan_until`); sem pagamento | existia |
| Busca (Ctrl K), contador de tarefas, notificações, assistente | Simulado (dados de exemplo para todo mundo) | — |
| Captura rápida (Novo) | Simulado ("Prévia, não salva") | — |

### O bug "feito em Seu dia volta depois de recarregar"

Causa: duas coisas somadas. (1) `isMock = true` mandava as tarefas para `createMockBoardApi`, que vive na memória. (2) Hábitos
(`saveHabitQty`), água e humor só mudavam o estado local `today-state`, sem nenhuma gravação. Como "Hoje" lê de novo o servidor
a cada carregamento, o que era só do cliente se perdia.

## Depois (esta branch)

Um jeito único de gravar (`src/features/persist/`): o registro de tabelas valida cada linha (zod), a ação `persistRows` grava com a
sessão do usuário (RLS decide; `user_id` é sempre o do usuário logado), e o hook `usePersistedRows` mostra a mudança na hora,
grava em ordem, desfaz e avisa com um toast se o banco recusar. As telas passaram de `useState(mock)` para
`usePersistedRows(tabela, dados do servidor)`.

**O app não tem mais nenhum dado de exemplo**: a pasta `src/mocks` foi apagada, e um teste (`src/lib/demo-seed.test.ts`) falha se alguém importar dados de exemplo de novo. Sem login (modo `PROTOTYPE_BYPASS_AUTH=1`, só para desenvolvimento local) as telas simplesmente aparecem vazias, como numa conta nova.

| Módulo | Status agora | Tabelas | Observação |
|---|---|---|---|
| Hoje: Destaques, Seu dia, painéis | **Real** | lê todas as abaixo (uma rodada de consultas por requisição) | Água, humor, hábitos e tarefas gravam. Um módulo vazio mostra "vazio", nunca número inventado |
| Hoje: layout | **Real** | `profiles.dashboard_prefs` (+ cookie e localStorage) | |
| Tarefas | **Real** | `boards`, `board_lists`, `tasks`, `task_checklist_items`, `task_comments`, `tags`, `task_tags`, `attachments` | As ações reais que já existiam passam a valer |
| Rotina | **Real** | `habits`, `habit_logs` | Um registro por hábito por dia |
| Agenda | **Real** | `events` (+ tarefas com data, dias de treino e provas lidos dos outros módulos) | Dias de treino e provas entram "o dia todo": nenhum horário foi escolhido |
| Finanças | **Real** | `finance_accounts`, `finance_categories`, `finance_transactions`, `finance_bills`, `finance_goals` | Valores em centavos. Sem Open Finance (removido do produto) |
| Treinos | **Real** | `exercises` (catálogo + próprios), `workout_plans`, `plan_exercises`, `workout_sessions`, `set_logs` | |
| Dieta | **Real** | `foods` (catálogo + próprios), `meal_items`, `diet_goals`, `weight_logs`, `water_logs` | Sem meta de peso até a pessoa definir |
| Estudos | **Real** | `subjects`, `study_sessions`, `study_deadlines`, `flashcard_decks`, `flashcards` | Novo: criar baralho e cartão. Os blocos semanais de exemplo não existem em conta real |
| Notas e lembretes | **Real** | `notes` (salva ~0,8 s depois de parar de digitar), `note_folders`, `reminders` | Entrega do lembrete pelo app segue "Em breve" |
| Metas | **Real** | `life_goals`, `life_goal_links`, `life_goal_milestones` | O progresso das ligações é **contado ao vivo** nos outros módulos (nada guardado) |
| Diário | **Real** | `journal_entries` (humor, texto, sono) | "Treinou" e "estudou" vêm dos outros módulos |
| Captura rápida (Novo) | **Real** | `tasks`, `finance_transactions`, `notes` | Tarefa, gasto ("gastei 45 no mercado") ou nota; o resto vira nota, e a tela diz isso |
| Busca global (Ctrl K) | **Real** | títulos das linhas do próprio usuário | |
| Contador de Tarefas no menu | **Real** | `tasks` | |
| Cofre | **Em breve** (página honesta) | — | Só vale com criptografia no navegador; ver "Decisões" |
| Notificações (sino), assistente | **Em breve** | — | Sem exemplos inventados em conta real |
| Configurações / Perfil | Real (como antes) | `profiles` | Foto de perfil: bucket `avatars` e coluna `profiles.avatar_path` prontos; o upload na tela segue "Em breve" |
| Plano | Real (como antes) | `profiles.plan`, `plan_until`, `plan_history` | Sem pagamento |
| Admin | Real (como antes) | tabelas `admin_*`, funções `admin.*` | Só contagens, nunca conteúdo dos módulos |

## Novas contas (provisionamento)

`public.provision_user(uuid)` (idempotente, chamada pelo gatilho de cadastro) cria: perfil (nome do Google, `America/Sao_Paulo`,
`pt-BR`, layout padrão do Hoje), o quadro "Minhas tarefas" com A fazer / Em andamento / Concluído, 11 categorias financeiras com
ícone, a "Conta principal" zerada, metas de dieta (com meta de água), preferências de notificação e a linha de estatísticas.
**Nenhum dado de demonstração.** Rodar de novo não muda nada e nunca mexe em linha que a pessoa já alterou
(`npm run users:backfill` faz isso para as contas que já existem).

## Decisões e o que ficou de fora

- **Cofre**: fica "Em breve". O desenho certo é criptografar no navegador (senha mestra, AES-GCM) e guardar só texto cifrado num
  schema próprio; isso é um projeto à parte, e o schema `vault` do Supabase já é usado pela extensão de segredos. Nenhuma tabela do
  cofre foi criada, então nada (assistente, admin) pode alcançá-lo.
- **Upload de foto**: bucket e coluna prontos, tela não ligada.
- **Preferências de notificação**: a tabela `notification_preferences` existe e é provisionada; a tela de avisos ainda guarda só no
  navegador (nada é enviado de qualquer jeito).
- **Push, pagamentos, voz, IA**: seguem "Em breve". As tabelas `push_subscriptions`, `user_stats`, `achievements` existem para quando forem construídos.
- **WhatsApp e Open Finance**: removidos do produto (03/11/2026). `whatsapp_links` continua no banco, sem uso; o drop está preparado em `supabase/pending-drops/`.

## Dados de demonstração: só em organizzouapp@gmail.com

O conteúdo que o app mostrava antes (tarefas como "Enviar relatório semanal à Marina", hábitos, eventos, treinos, estudos, notas, metas,
finanças, dieta, diário) virou **linhas reais** no banco, carregadas por `npm run seed:demo -- organizzouapp@gmail.com`
(`scripts/seed-demo.ts`, conteúdo em `scripts/demo/content.ts`). Datas relativas a hoje em America/Sao_Paulo; 60 a 90 dias de histórico.

- **Só a lista permitida**: o padrão é `organizzouapp@gmail.com` (`DEMO_SEED_ALLOWLIST` pode ampliar). `patrick.toledo.barros@gmail.com`
  é recusado sempre. Em produção (`NODE_ENV`, `VERCEL_ENV` ou `APP_ENV` = production) exige `--i-know-this-is-production`.
- **Sem duplicar**: os ids da demonstração são uuids versão 5 (o app só cria versão 4). Rodar de novo apaga tudo que a demonstração criou
  antes e grava de novo com as datas de hoje. `npm run seed:demo:reset -- <e-mail>` apaga só essas linhas.
- **Conta de teste**: o script marca `profiles.is_test = true`. Os números do admin deixam essas contas de fora por padrão, com a chave
  "Incluir contas de teste" (por admin). Só contagens, nunca conteúdo.
- **Todas as outras contas começam vazias**: o cadastro cria só padrões (perfil, quadro "Minhas tarefas" com 3 listas, 11 categorias
  financeiras, "Conta principal", metas de dieta e água, preferências de aviso, layout padrão do Hoje).
