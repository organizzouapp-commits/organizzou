# Revisão de UX: resumo

Branch: `experiment/ux-review` (parte da `main`; nada foi mesclado nem enviado). Esta página resume o que mudou por tela, o que
ainda falta e como testar, voltar ou manter a versão nova.

## Como testar, voltar ou manter

```bash
# (a) testar a branch nova
git checkout experiment/ux-review
npm ci                                   # só se o package-lock mudou
PROTOTYPE_BYPASS_AUTH=1 npm run dev      # abre o dashboard sem login (só em desenvolvimento)
# ou, em modo produção (as rotas do dashboard pedem login):
npm run build && npm start

# testes
npm run lint && npm run typecheck && npm test
npx playwright test ux-foundation ux-tasks-agenda ux-life-modules ux-organizacao   # com o servidor de dev no ar (porta 3100)
npx playwright test smoke                                                          # varredura completa (~16 min), gera docs/QA-REPORT.md

# (b) voltar para a versão anterior
git checkout main

# (c) manter a versão nova
git checkout main && git merge experiment/ux-review
git push        # só se e quando você quiser
```

Antes de qualquer `supabase db push`, leia as duas migrations novas (veja "O que falta"): ambas são aditivas e **não foram aplicadas**.

## O que mudou, por tela

### Fundação (Prompt 1)
- Varredura Playwright (`tests/e2e/smoke.spec.ts`) e relatórios em `docs/QA-REPORT.md` e `docs/QA-ANALYSIS.md`.
- Correções: Hoje sem "100%" com 0 tarefas; avisos (toasts) no topo; gráfico de peso estável; skeletons após 200 ms e
  pré-busca das rotas; site que espera a foto de fundo; rodapé do cadastro; folha do login mobile; índice das políticas fixo;
  abas e controles segmentados que rolam e mantêm o item ativo à vista.
- Recursos simulados agora aparecem como "Em breve" ou "Prévia" (`docs/INTEGRATIONS-STATUS.md`).
- Primitivas de layout em `src/components/organizzou/layout/` (`docs/LAYOUT.md`).
- "Fazer upgrade" e a página Plano Pro (só interface, sem pagamento): `src/lib/plans.ts`, `/dashboard/plano`, lista de espera.

### Hoje, Tarefas, Agenda (Prompt 2)
- **Hoje:** cards de resumo, insight em uma linha, linha do tempo "Seu dia" com o marcador "agora" e coluna lateral.
- **Tarefas:** barra de uma linha, chips rápidos, Kanban fluido com adicionar rápido, painel de detalhes lateral com "Salvo",
  atalhos (N, /, E, Espaço, ?).
- **Agenda:** grade de semana e dia com arrastar para criar, mover e redimensionar; mês com "+N mais"; mini calendário lateral.

### Finanças, Rotina, Treinos, Dieta, Estudos (Prompt 3)
- **Finanças:** visão geral em duas colunas, lançamentos agrupados por dia com adição rápida, contas fixas com estado claro, metas em grade.
- **Rotina:** dias da semana rotulados, histórico em largura total, estatísticas com a mesma altura.
- **Treinos:** faixa da semana, séries em uma linha, cards de treino com "Duplicar".
- **Dieta:** anel de calorias e água no topo, refeições em grade, peso com seletor de período.
- **Estudos:** cronômetro grande com coluna lateral, matérias em grade, provas e prazos com edição na linha.

### Organização, conta e site (Prompt 4)
- **Notas:** três painéis com a altura da tela, seção "Fixadas", contagem por pasta, indicador "Salvo". Lembretes em grade, títulos que quebram
  linha e "Adiar" dentro do menu ⋯; aviso de que a entrega é "Em breve".
- **Metas:** grade de cards com barra, "faltam N dias" abaixo dela e itens ligados dentro do card.
- **Diário:** check-in e insights lado a lado, gráficos com a mesma altura, histórico com humor, sono e nota.
- **Cofre:** cartão de desbloqueio centralizado; lista de itens com painel de detalhes (≥1280 px) ou folha em tela cheia; gerador em duas colunas.
  O assistente e a busca nunca leem o cofre: `src/mocks/vault-guard.test.ts` falha se algum arquivo do assistente importar módulos do cofre.
- **Perfil e Configurações:** uma tela só, com menu vertical (Perfil, Aparência, Avisos, WhatsApp, Segurança e dados, Plano e cobrança) e abas rolantes no
  celular. Aparência com pré-visualização dos temas; Avisos com colunas App e WhatsApp rotuladas.
- **Ajuda:** perguntas frequentes com busca, cartão de contato e "Falar com o assistente". "Reportar problema" está "Em breve".
- **Políticas:** logo no topo, fundo do site, índice fixo, texto legível e data de última atualização.
- **Login e cadastro:** os passos decorativos saíram da ordem do Tab (o teclado vai direto aos campos) e os botões de envio informam `aria-busy`.

## O que falta (e o que decidir)

- **Migrations não aplicadas** (aditivas, nulas ou com `if not exists`):
  `20260105000001_profiles_plan.sql` (plano do usuário, com trava para só o service role alterar) e
  `20260105000002_tasks_reminder_repeat.sql` (lembrete e repetição de tarefas). Aplicar só com o seu aval.
- **Nada disso existe de verdade ainda** (aparece como "Em breve"): pagamentos, WhatsApp, Open Finance, avisos por app/WhatsApp, 2FA e passkeys,
  exportar dados, excluir conta pela tela, backup do cofre, foto de perfil, relato de problema, IA nos flashcards e no assistente.
- O e-mail de suporte (`suporte@organizzouapp.com`) é provisório.
- Os dados de todos os módulos ainda são de exemplo (`src/mocks/`); só login, perfil, tema e a lista de espera usam o Supabase.
- As rotas do dashboard só podem ser medidas em produção com uma conta real (o atalho de teste só funciona em desenvolvimento).
- Chaves de cor: o contorno do chip "hoje" e o anel de progresso usam Tinta/Papel (nunca Lima fino sobre fundo claro).
