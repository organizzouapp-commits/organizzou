# Assistente e captura rápida

Um só motor (`src/server/assistant/`) serve o chat do app, a captura rápida e, na próxima tarefa, o WhatsApp.

## Como funciona

| Peça | Arquivo | O que faz |
|---|---|---|
| Leitor por regras | `parse.ts` | Texto livre vira itens (tarefa, gasto, receita, nota, hábito, evento, lembrete, meta, humor, água, peso, sono, treino, estudo). Datas no fuso America/Sao_Paulo. Puro: roda no navegador (prévia "Vou criar:") e no servidor (salvar). |
| Criação | `execute.ts` | Cria as linhas de verdade com a sessão da pessoa (RLS). Nunca usa a chave de serviço. Texto que não deu para entender, ou que não pôde ser criado, vira nota na pasta **Inbox**. |
| Ferramentas | `tools.ts` | Ferramentas validadas com zod: criar, atualizar, concluir, consultar. Não existe ferramenta de cofre (teste em `vault-guard.test.ts`). Apagar nunca roda sozinho: a pessoa confirma. |
| Motor | `engine.ts` | Laço de tool use com a SDK da Anthropic (só no servidor), no máximo 5 passos, resposta curta, prompt do sistema com cache. |
| Limites | `usage.ts` | Mensagens por dia por plano (`src/lib/plans.ts`: Gratuito 15, Pro 200), contadas em `assistant_usage`. Sem a tabela, o modelo **não** é chamado. |
| Chat | `src/app/api/assistant/chat/route.ts` | GET: estado, uso do dia, histórico. POST: um turno em streaming. DELETE: limpa a conversa. |

## Captura rápida

1. O leitor por regras roda primeiro (grátis e offline).
2. Só o que ficou incerto vai ao modelo, e só se houver chave e a pessoa estiver dentro do limite do dia.
3. Se ainda assim não deu: nota no Inbox + aviso "Salvei como nota. Mudar para…".
4. Tudo que é criado grava em `audit_log` com `actor = app_quick_capture` (enquanto a migration do assistente não for aplicada, grava `actor = app` com `payload.actor = app_quick_capture`).

## Ligar o assistente

1. Anthropic Console → API keys → criar uma chave só para o Organizzou.
2. Console → Settings → Limits: definir o limite mensal de gasto (spend limit) e o alerta por e-mail.
3. `.env.local`: `ANTHROPIC_API_KEY=sk-ant-...` (e, se quiser, `ASSISTANT_MODEL`; padrão `claude-haiku-5-5`). Reinicie o servidor.
4. Vercel → Project → Settings → Environment Variables: `ANTHROPIC_API_KEY`, ambiente Production (e Preview se precisar), marcada como **Sensitive**. Redeploy.
5. Aplicar a migration `20261104000001_assistant.sql` (`npx supabase db push`, com aprovação). Sem ela o chat fica em "Assistente indisponível".

Sem a chave: o chat mostra "Assistente indisponível" e a captura rápida segue só com regras e Inbox.

## Testes

- `npx vitest run src/server src/features/assistant`: leitor, ferramentas, motor com cliente simulado, limites, guarda do cofre.
- `E2E_DEMO_SESSION=1 npx playwright test quick-capture`: captura de tarefa, gasto, nota, hábito, texto ambíguo (Inbox), vários itens + Desfazer, gaveta mobile, lista de notificações, estado do chat.
