# Cobertura da demonstração

Conta: `organizzouapp@gmail.com` (carregada por `npm run seed:demo -- organizzouapp@gmail.com`; conteúdo em `scripts/demo/content.ts`).
Capturas: `docs/demo-screenshots/1440x900/` (escuro, e claro nas telas principais) e `docs/demo-screenshots/390x844/` (escuro, página inteira),
geradas por `tests/e2e/demo-screenshots.spec.ts` com sessão real da conta de demonstração. Os nomes abaixo são `<nome>-escuro.jpg` ou
`<nome>-claro.jpg` nas duas pastas.

Legenda: **Coberto** = há linha real no banco e o elemento aparece numa captura (e um teste confere os dados em
`src/lib/demo-coverage.test.ts`). **Pendente** = a linha está no seed, mas depende de uma migration que ainda não foi aplicada.
**Em breve** = não existe de verdade ainda e a tela diz isso. **Sem tela** = não há interface para ver.

> As datas são sempre relativas a hoje (America/Sao_Paulo); alguns estados dependem do dia do mês (conta que vence hoje, atrasada), e o seed
> escolhe os dias de vencimento a partir de hoje para que todos apareçam em qualquer dia (de 2 a 28; no dia 1 não há como existir conta atrasada).

## Sino (cabeçalho)

| Elemento / estado | Status | Onde |
|---|---|---|
| Sino sem notificação (vazio, "Nada novo por aqui") | Coberto | `hoje-bell-escuro` (hoje, com a migration pendente) |
| Ponto Lima no sino com notificações não lidas e contagem no rótulo | **Pendente** (migration `20261103000005_notifications.sql`) | 3 não lidas no seed |
| Item não lido (ponto) / lido, tipos bill, study, workout, agenda, task, habit, goal, reminder, info | **Pendente** | 9 notificações no seed |
| "Marcar todas como lidas" e marcar uma ao abrir | **Pendente** | teste `demo-account` (sino) |

Depois de aplicar a migration e rodar o seed de novo, rode `E2E_DEMO_SCREENSHOTS=1 npx playwright test demo-screenshots` para a captura do sino cheio.

## Hoje

| Elemento / estado | Status | Captura |
|---|---|---|
| Destaques: cards de Tarefas de hoje, Hábitos, Gasto, Água, Próximo evento, Calorias, Sobra do mês, Próxima conta, Treinos, Estudo, Sequência, Sono, Humor (16 cards, rolagem lateral) | Coberto | `hoje` |
| Card Lima no primeiro visível; setas; Personalizar | Coberto | `hoje`, `hoje-personalizar` |
| Seu dia: grupos Atrasados, Manhã, Tarde/Noite, Sem horário, Concluídos | Coberto | `hoje` |
| Item: tarefa atrasada (há N dias), tarefa de hoje com hora, prioridade alta (bandeira), evento, treino do plano, hábito fixo, hábito de quantidade (barra), hábito com sequência, conta atrasada com "Pagar", conta que vence hoje, concluído | Coberto | `hoje` |
| Painéis: Notas e lembretes (aberto), Finanças, Dieta e água, Treino, Estudos, Como você está? | Coberto | `hoje`, `hoje-painel-financas-aberto` |
| Tema claro | Coberto | `hoje-claro` |
| Celular | Coberto | `390x844/hoje` |

## Tarefas

| Elemento / estado | Status | Captura |
|---|---|---|
| Quadro padrão "Minhas tarefas" (o que abre primeiro) com 16 cards nas 3 listas A fazer, Em andamento, Concluído; mais os quadros Faculdade (3 listas) e Lançamento do app (4 listas) no seletor | Coberto | `tarefas-kanban`, `tarefas-quatro-listas` |
| Kanban, Lista e Calendário | Coberto | `tarefas-kanban`, `tarefas-lista`, `tarefas-calendario` |
| Tarefa atrasada, de hoje com hora, de amanhã, sem data | Coberto | `tarefas-kanban` |
| Prioridade alta, média, baixa | Coberto | `tarefas-kanban`, `tarefas-lista` |
| Com checklist (1/3, 3/5), comentários, anexos (arquivos de verdade no Storage), etiquetas (Trabalho, Urgente...) | Coberto | `tarefas-kanban`, `tarefas-detalhe-detalhe-relatorio` |
| Concluída (coluna Concluído) | Coberto | `tarefas-kanban` |
| Tarefa ou quadro arquivado | Sem tela (arquivar só esconde; não há lista de arquivados) | |
| Mais de 15 tarefas no quadro que abre primeiro | Coberto (16 cards no quadro padrão; a etiqueta de Tarefas no menu conta as abertas de todos os quadros não arquivados) | `tarefas-kanban` |

## Agenda

| Elemento / estado | Status | Captura |
|---|---|---|
| Mês, Semana, Dia | Coberto | `agenda-mes`, `agenda-semana`, `agenda-dia` |
| Evento de dia todo, com hora, recorrente (semanal, mensal, anual), com lembrete (um e dois), acontecendo agora | Coberto | `agenda-mes`, `agenda-dia` |
| Tarefas com data, dias de treino e provas na agenda | Coberto | `agenda-mes` |
| 6+ eventos espalhados pelo mês | Coberto (19 eventos, 5 recorrentes) | `agenda-mes` |
| Tema claro | Coberto | `agenda-claro` |

## Rotina

| Elemento / estado | Status | Captura |
|---|---|---|
| Hábito fixo feito / pendente; de quantidade parcial / completo; pausado; com sequência (40 dias) | Coberto | `rotina-hoje` |
| Últimos 7 dias (pontos), constância, melhor sequência | Coberto | `rotina-hoje` |
| Histórico (mapa por dia) e Estatísticas | Coberto | `rotina-historico`, `rotina-estatisticas` |

## Finanças

| Elemento / estado | Status | Captura |
|---|---|---|
| 4 contas (saldo total, por conta) | Coberto | `financas-visao-geral` |
| Entradas e saídas em todas as 11 categorias; 25+ lançamentos (130 em 6 meses) agrupados por dia | Coberto | `financas-lancamentos` |
| Contas fixas: paga, vence hoje, atrasada, a vencer | Coberto | `financas-contas-fixas`, `financas-visao-geral` |
| Orçamento: abaixo do limite, perto ("Perto do limite"), acima ("Acima do limite") | Coberto (limites escolhidos a partir do gasto do mês) | `financas-visao-geral` |
| Metas de economia: em andamento e alcançada | Coberto | `financas-metas` |
| Gráfico dos últimos 6 meses | Coberto | `financas-visao-geral` |
| Conectar banco (Open Finance) | **Em breve** | `financas` |
| Tema claro | Coberto | `financas-claro` |

## Treinos

| Elemento / estado | Status | Captura |
|---|---|---|
| Hoje: treino do dia; semana com dias de treino e descanso | Coberto | `treinos-hoje` |
| Meus treinos: 3 planos com 5 exercícios cada (séries, repetições, descanso, carga) | Coberto | `treinos-meus-treinos` |
| Evolução: carga por treino, volume por semana, recordes pessoais (15), frequência | Coberto | `treinos-evolucao` |
| Histórico de 40 sessões com 660 séries | Coberto | `treinos-evolucao` |

## Dieta

| Elemento / estado | Status | Captura |
|---|---|---|
| Café da manhã, almoço, lanche e jantar, cada um com alimentos | Coberto | `dieta-hoje` |
| Calorias e macros (restam), água do dia com histórico | Coberto | `dieta-hoje`, `dieta-historico` |
| Peso: 12 registros, meta | Coberto | `dieta-peso` |
| Histórico de 14 dias de refeições | Coberto | `dieta-historico` |

## Estudos

| Elemento / estado | Status | Captura |
|---|---|---|
| Matéria, curso, livro e concurso (progresso, meta semanal, prioridade) | Coberto | `estudos-materias` |
| Hoje: cronômetro, estudado hoje, horas por matéria, contagem regressiva | Coberto | `estudos-hoje` |
| Baralhos com cartões para revisar hoje e para depois | Coberto | `estudos-flashcards` |
| Provas e entregas com contagem regressiva | Coberto | `estudos-provas-e-prazos` |
| Blocos de estudo do cronograma | Sem tela de cadastro (não é um dado salvo); aparece "Nenhum bloco" | `estudos-hoje` |

## Notas e lembretes

| Elemento / estado | Status | Captura |
|---|---|---|
| 8 notas: em pasta, sem pasta, fixadas, com etiqueta | Coberto | `notas-notas`, `notas-nota-aberta` |
| Lembretes: atrasado, hoje, amanhã, mais tarde, concluído | Coberto | `notas-lembretes` |
| Entrega do lembrete por app e WhatsApp | **Em breve** (a tela avisa) | `notas-lembretes` |

## Metas, Diário

| Elemento / estado | Status | Captura |
|---|---|---|
| Metas em andamento (4) e concluída (1), com prazo, ligações com progresso ao vivo (estudo, tarefas, dinheiro, hábito, treino) e marcos feitos / pendentes | Coberto | `metas` |
| Diário: humor 1 a 5, sono, anotações, gráficos de 30 dias, "o que combina com seus melhores dias", 60 check-ins | Coberto | `diario` |

## Perfil, Configurações, Plano, Ajuda, Cofre

| Elemento / estado | Status | Captura |
|---|---|---|
| Perfil (nome, e-mail) e Configurações (abas) | Coberto | `perfil`, `configuracoes` |
| Plano (Gratuito, listas de espera) | Coberto | `plano` |
| Ajuda | Coberto | `ajuda` |
| Avisos (preferências por tipo) | **Em breve** (a entrega não existe; a tabela `notification_preferences` está pronta) | `configuracoes` |
| Foto de perfil (upload) | **Em breve** (bucket pronto) | `perfil` |
| Cofre | **Em breve** | `cofre` |
| WhatsApp, Open Finance, pagamentos, voz, assistente com IA | **Em breve** | telas acima |
| Conquistas, nível e XP | **Sem tela** (as tabelas `user_stats` e `achievements` existem; nenhuma tela as mostra). Sequências aparecem em Hoje e Rotina | |

## Admin (conta de administrador)

| Página | Status | Captura |
|---|---|---|
| Visão geral, Usuários, Atividade, Módulos, Planos, Assinaturas, Lista de espera, Assistente, Integrações, Status, Auditoria, Suporte | Coberto (contagens e dados de conta; as contas de teste ficam fora dos números, com a chave "Incluir contas de teste") | `admin-*` |

## Como conferir de novo

```
npm run seed:demo -- organizzouapp@gmail.com           # recarrega a demonstração (idempotente)
NEXT_DIST_DIR=.next-shots npx next dev -p 3100         # servidor com login de verdade (sem PROTOTYPE_BYPASS_AUTH)
E2E_DEMO_SCREENSHOTS=1 npx playwright test demo-screenshots
npx vitest run src/lib/demo-coverage.test.ts src/lib/demo-seed.test.ts
```
