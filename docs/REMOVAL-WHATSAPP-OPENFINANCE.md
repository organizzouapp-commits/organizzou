# Remoção de WhatsApp e Open Finance (03/11/2026)

Decisão de produto: o Organizzou **não terá** WhatsApp nem Open Finance. O assistente vive só dentro do app (captura rápida, chat e
voz do navegador). Este documento lista tudo o que existia, o que foi feito e o que fica para depois.

Nada destrutivo foi aplicado no banco. Os objetos de banco listados abaixo continuam lá, sem uso.

## Inventário

| Onde | O que fazia | Ação |
| --- | --- | --- |
| `src/components/shell/whatsapp-cta.tsx` | Cartão Lima "Conecte seu WhatsApp" na sidebar e o hook `useWhatsAppAccess` | Renomeado para `plan-cta.tsx`; ficou só o cartão de upgrade (Free). Pro não vê cartão |
| `src/components/shell/app-sidebar.tsx`, `app-topbar.tsx`, `app-topheader.tsx` | Entrada "Conectar WhatsApp" no flyout do rail, no menu do avatar (mobile) e no dropdown Configurações | Removida |
| `src/components/organizzou/plan-context.tsx`, `src/components/shell/app-shell.tsx`, `src/app/(app)/layout.tsx` | Estado `whatsappConnected` e cookie de dev `dev_whatsapp` | Removidos |
| `src/lib/plans.ts` | `canUseWhatsApp`, limite `banks`, textos "Open Finance" e "no WhatsApp" | Removidos (Pro redefinido na etapa B) |
| `src/components/settings/settings-shell.tsx`, `settings-extras.tsx` | Aba/tela WhatsApp (só visual, nenhum código era enviado), coluna WhatsApp em Avisos, seção Open Finance em Segurança | Removidos. Avisos agora tem as colunas App e E-mail (prévia, não salva) |
| `src/components/finance/financas-screen.tsx` | Botão e diálogo "Conectar banco" (lista fictícia de bancos), selo "Importado" | Removidos. Finanças é 100% manual |
| `src/components/notes/notas-screen.tsx`, `src/features/notes/types.ts` | Canal WhatsApp nos lembretes | Removido. Lembretes avisam pelo app (`push`) |
| `src/features/persist/registry.ts` | `whatsapp_enabled` em `notification_preferences`; `source: open_finance`; canal `whatsapp` em lembretes | Removidos do schema de escrita. Lembretes antigos com canal legado são normalizados para `push` ao gravar |
| `src/features/finance/types.ts` | `TransactionSource` incluía `open_finance` | Só `manual` |
| `src/lib/admin/integrations.ts`, `src/app/(admin)/admin/integracoes/page.tsx` | Cartões WhatsApp e Open Finance | Removidos. Entram E-mail (Resend) e Agendador de lembretes, ambos "Não construído" |
| `src/app/(admin)/admin/usuarios/page.tsx`, `src/features/admin/actions.ts`, `src/lib/admin/data.ts` | Coluna e CSV "WhatsApp vinculado" | Removidos |
| `src/components/auth/auth-shell.tsx` | Passo "Conecte seu WhatsApp" no cadastro | Troca por "Peça pelo assistente" |
| `src/components/help/help-view.tsx`, `profile-view.tsx`, `task-sheet.tsx`, `agenda-screen.tsx`, `site/waitlist-dialog.tsx`, `features/waitlist/*`, `(site)/layout.tsx`, `(site)/page.tsx` | Textos que citavam WhatsApp | Reescritos (telefone, assistente no app) |
| `src/server/assistant/engine.ts`, `vault-guard.test.ts`, `src/lib/supabase/bypass*.ts` | Comentários sobre WhatsApp futuro e `dev_whatsapp` | Atualizados |
| `scripts/demo/content.ts` | Lembretes de demonstração com canal `whatsapp` | Passam a `push` |
| `tests/e2e/wa-cta.mjs` | Teste do cartão de WhatsApp | Apagado |
| demais `tests/e2e/*` | Fluxos que passavam pelo WhatsApp | Atualizados; novo `removed-integrations.spec.ts` |
| `supabase/migrations/*` | `whatsapp_links`, `notification_preferences.whatsapp_enabled`, `audit_log.actor 'whatsapp'`, `transactions.source 'open_finance'`, RPCs admin com `whatsapp_linked` | **Mantidos** (migrações já aplicadas nunca são editadas). Nenhum código lê ou escreve esses objetos |
| `supabase/pending-drops/20261201000001_drop_whatsapp_open_finance.sql` | — | Preparado, **não aplicado**: derruba `whatsapp_links` e a coluna `whatsapp_enabled`. Para valer, mover para `supabase/migrations/` com aprovação explícita |

## O que nunca existiu neste repositório

Não havia rotas `/api/whatsapp/**`, webhook, tabela de mensagens, provedor de Open Finance (Pluggy/Belvo), SDK, variáveis
`WHATSAPP_*`/`STT_*`, nem a interface `Channel`. Só telas "Em breve". Um teste garante que `/api/whatsapp/*` responde 404.

## Sugestão (não implementada)

Importação gratuita de extrato em CSV/OFX no Finanças (prévia, mapeamento de colunas, detecção de duplicados, categorização por
palavras-chave e desfazer). Fica como próxima melhoria; não entrou aqui para não arriscar o módulo de finanças.
