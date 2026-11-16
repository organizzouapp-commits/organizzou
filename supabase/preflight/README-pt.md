# Preflight da rodada 2 (somente leitura)

Antes de aplicar qualquer migração preparada, rode o preflight para ver o que já existe no banco e se há algo que possa travar.

## Como rodar
1. Abra o projeto no painel do Supabase e vá em **SQL Editor**.
2. Cole todo o conteúdo de `supabase/preflight/round-2-check.sql` e clique em **Run**.
3. O arquivo só tem `select`: não cria, altera nem apaga nada. Pode rodar quantas vezes quiser.

## Como ler o resultado
Uma única tabela com as colunas `section`, `item`, `result` e `note`.

- **A. quem sou eu**: o papel que está rodando e quem é dono de `storage.objects`. Se a nota disser **ATENÇÃO**, a migração #1 (avatars) pode falhar ao criar policies.
- **B. permissão**: `true` em "pode DELETE em auth.sessions" significa que a migração #8 (sessões) deve funcionar. `false` significa que ela vai falhar com `sessions_delete_not_permitted`: não aplique antes de resolver.
- **C. tabelas base**: se `push_subscriptions` ou `notification_preferences` não existirem, a migração #5 as cria sozinha.
- **D. metas de Finanças**: quantidade e ids das metas cujo prazo é igual ou anterior ao dia de criação. A migração #4 já corrige essas linhas no backfill; a lista serve para você conferir.
- **E. o que já existe**: para cada objeto das 10 migrações (tabela, coluna, policy, função, bucket, constraint), `true` = já aplicado, `false` = falta aplicar. Use para saber o que já foi aplicado antes de decidir os lotes. Atenção à policy antiga `passkey_credentials_update_own` (deve sumir depois da #7) e às colunas com UPDATE para `authenticated` (depois da #7 deve ser só `device_label`).

## Ordem segura de aplicação (3 lotes)
Nenhuma migração apaga dados. Todas são aditivas e podem ser repetidas. Aplique um lote, teste o app, só então siga para o próximo. **Nunca comece pelo projeto de produção nos itens marcados como "teste antes".**

| Lote | Migrações | Observação |
|------|-----------|------------|
| **1** | #1 avatars, #2 support_reports, #3 installment_bills, #9 user_meals, #10 goal_links | Baixo risco. Se a nota da seção A avisar sobre `storage.objects`, trate a #1 à parte. |
| **2** | #5 push_notifications, #6 two_factor | A #5 é idempotente e cria as tabelas base se faltarem. |
| **3** | #7 passkeys, depois #4 goal_start_and_opening, depois #8 user_sessions | Veja abaixo. |

Detalhes do lote 3:
- **#7 passkeys**: depois de aplicar, confira na seção E que só `device_label` tem UPDATE para `authenticated`, e teste renomear e entrar com uma passkey.
- **#4 goal_start_and_opening**: só **depois do preflight**. Veja na seção D quantas metas antigas têm prazo igual ou anterior à criação; o backfill ajusta o início delas. Depois de conferir, você pode rodar à mão a linha comentada `validate constraint` do arquivo.
- **#8 user_sessions**: só **depois de testar localmente** com `supabase start` (se tiver Docker) ou em um projeto gratuito descartável do Supabase. Nunca primeiro em produção. Ela apaga linhas de `auth.sessions`: entre em dois navegadores, encerre um pelo outro em Configurações > Segurança > Sessões ativas e confirme que ele volta para o login.

## Importante
- Não rode `db push` sem a sua decisão; nada disso foi aplicado.
- Rode o preflight de novo depois de cada lote: as linhas da seção E devem passar de `false` para `true`.
