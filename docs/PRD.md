# PROJETO: [NOME DO APP] — Aplicativo web de gestão pessoal (Life OS)

## 1. Visão geral
Crie um aplicativo web responsivo (mobile-first, instalável como PWA) de gestão
pessoal que une Dashboard, Tarefas, Rotina, Agenda, Finanças, Treinos, Dieta,
Estudos, Lembretes/Notas e Cofre de Senhas. Tudo pode ser controlado por
conversa, inclusive por ÁUDIO NO WHATSAPP, com um assistente Claude integrado
que registra as informações e envia lembretes no WhatsApp na hora certa.
Também deve existir uma extensão de navegador. Idioma: português do Brasil.

## 2. Referência de mercado (diferenciação)
Concorrentes "tudo em um": Notion, ClickUp, Lunatask, Luma OS, Lumeon, Brite.
Diferencial: Kanban estilo Trello/ClickUp + Open Finance + cofre de senhas +
extensão de navegador + assistente Claude no app E no WhatsApp (áudio e texto)
que cria, edita e lembra de tudo, em um único produto.

## 3. Stack e infraestrutura
- Frontend: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Backend/Banco: Supabase (Postgres, Auth, Storage, Realtime, Row Level Security
  em TODAS as tabelas, isolando dados por usuário)
- Deploy: Vercel (variáveis de ambiente para todas as chaves)
- IA: API do Claude via rota server-side, com tool use (ou servidor MCP próprio)
  para criar/editar registros em todos os módulos
- WhatsApp: WhatsApp Business Platform (Cloud API oficial da Meta), com webhook
  na Vercel para receber mensagens e enviar lembretes
- Áudio: transcrição de voz para texto (serviço de speech-to-text) ANTES de
  enviar o conteúdo ao Claude
- Agendamento de lembretes: Supabase (pg_cron) ou Vercel Cron
- Open Finance: agregador regulado (Pluggy ou Belvo)
- Extensão: Manifest V3 (Chrome/Edge/Firefox) usando a mesma API
- Referências de design: usar o Mobbin MCP para buscar telas de UX/UI
  (dashboards, kanban, calendário, hábitos, finanças, fitness, estudos, cofre)

## 4. Identidade visual
- Nome: escolher entre os finalistas [Esteio, Aprumo, Mirante, Vereda],
  após checar domínio, INPI e lojas de apps
- Criar logo, paleta, tipografia e design system (tokens e componentes)
- Estilo: moderno, calmo e premium; modo escuro padrão + modo claro
- Cor de destaque por módulo; ícones Lucide; cantos arredondados; micro-animações
- Inspiração: ClickUp, Trello, Notion, MyFitnessPal, NordPass, Google Agenda
  e telas de referência do Mobbin

## 5. Autenticação e segurança de conta
- Login e cadastro (e-mail/usuário + senha) via Supabase Auth
- Recuperação de senha, sessão persistente
- 2FA e biometria no mobile (WebAuthn/passkeys)

## 6. Módulos

### 6.1 Dashboard
- Visão do dia: rotina, tarefas, agenda, finanças, treino, dieta e estudos
- Cards de progresso, resumo financeiro rápido, próximos compromissos
- Insight diário do assistente, água e humor do dia

### 6.2 Tarefas (estilo Trello + ClickUp)
- Quadros com listas personalizáveis (A fazer, Em andamento, Concluído etc.)
- Cartões com: título, descrição, tags, status, prioridade, data, checklist,
  cores, anexos, categoria, comentários
- Arrastar e soltar entre listas; visualizações Kanban, Lista e Calendário
- Filtros, busca e ordenação

### 6.3 Rotina
- Hábitos diários: fixos e metas (com prazo/quantidade)
- Adicionar, editar, excluir e pausar hábitos
- Check diário, histórico semanal e mensal (calendário de consistência), streaks
- Estatísticas de constância; hábitos aparecem na Agenda

### 6.4 Agenda (estilo Google Agenda)
- Visões mês, semana e dia
- Eventos com data, horário, descrição, tema/cor, categoria, recorrência, lembrete
- Integração com Rotina, Tarefas e Estudos (itens com data aparecem na agenda)
- Opcional: sincronizar com Google Agenda

### 6.5 Finanças
- Entradas, saídas, saldo total, limite de gastos por categoria
- Gastos por categoria, histórico de lançamentos e pagamentos
- Gráficos: onde estou gastando, sobra mensal, evolução
- Contas recorrentes e assinaturas com alerta de vencimento
- Orçamento mensal e metas financeiras
- Conexão com Open Finance (importação automática e categorização)

### 6.6 Treinos
- Cadastrar, editar e excluir treinos e exercícios
- Marcar treino concluído no dia da semana, com séries, repetições e carga
- Gráficos de evolução (carga, volume, frequência) e recordes pessoais
- Cronômetro de descanso

### 6.7 Dieta (estilo MyFitnessPal)
- Metas de kcal e macros (proteína, carboidrato, gordura)
- Registrar, editar e duplicar refeições; banco de alimentos com busca
- Controle diário de calorias/macros, água e histórico
- Gráficos de progresso e peso corporal

### 6.8 Estudos (NOVO)
- Cadastro de matérias, cursos, livros e concursos/provas, com cor e prioridade
- Cronograma semanal de estudos, integrado à Agenda
- Sessões de estudo com timer (Pomodoro/foco) e registro automático de horas
- Metas de horas por semana e por matéria; progresso de cursos e leituras
- Gráficos: horas estudadas por matéria, constância e evolução
- Anotações por matéria (usando o módulo de Notas)
- Flashcards com repetição espaçada e quiz; o Claude pode gerar flashcards e
  resumos a partir das minhas anotações
- Contagem regressiva para provas, entregas e prazos, com lembretes
- Ranking de matérias mais e menos estudadas

### 6.9 Lembretes e Notas
- Notas, anotações e lembretes com data/hora e notificação (push e WhatsApp)
- Pastas, tags, fixar notas, busca, editor com formatação

### 6.10 Cofre de Senhas (estilo NordPass)
- Senhas, documentos pessoais, cartões e notas seguras, em pastas
- Criptografia ponta a ponta no cliente (zero-knowledge) com senha mestra
- Gerador de senhas, alerta de senhas fracas/repetidas
- Preenchimento automático pela extensão do navegador

### 6.11 Assistente Claude (chat no app)
- Chat em todas as telas (botão flutuante)
- Linguagem natural cria/edita registros em todos os módulos
  (ex.: "gastei 45 no mercado", "marca treino de peito hoje", "estudei 2h de
  direito constitucional")
- Pedir confirmação antes de apagar ou fazer ação sensível
- Responder perguntas sobre meus dados
- NUNCA ter acesso ao conteúdo do cofre de senhas

## 7. Integração com WhatsApp (NOVO)
Tudo pode ser controlado por áudio ou texto no WhatsApp.

### 7.1 Controle por áudio e texto
- Envio de áudio -> transcrição -> Claude interpreta -> registra no módulo
  correto -> responde por mensagem confirmando o que foi feito
- Exemplos: "adiciona tarefa pagar o aluguel sexta", "gastei 80 de gasolina",
  "terminei o treino de costas, 4 séries de 10 com 60 quilos", "almocei arroz,
  feijão e frango", "estudei 1 hora de matemática"
- Consultas por áudio: "quanto gastei esse mês?", "o que tenho amanhã?",
  "como estão meus hábitos da semana?"
- Funciona também com texto, fotos de comprovantes/notas (opcional) e
  respostas rápidas por botões
- Se o Claude não tiver certeza do que entendeu, pergunta antes de salvar

### 7.2 Lembretes no WhatsApp na hora certa
- Lembretes de tarefas com data, compromissos da agenda, hábitos do dia,
  contas a vencer, horário do treino, refeições, água e sessões de estudo
- Resumo matinal do dia (tarefas, agenda, treino, dieta, contas) e resumo
  noturno opcional
- Revisão semanal enviada no WhatsApp
- Respostas diretas ao lembrete: "feito", "adiar 1 hora", "cancelar"
- Configuração por tipo de lembrete, horários permitidos e "não perturbe"

### 7.3 Segurança e conformidade do WhatsApp
- Vincular o número ao usuário por código de verificação; aceitar mensagens
  somente de números verificados
- Opt-in explícito e opção de sair (opt-out) a qualquer momento, conforme
  LGPD e regras da Meta
- Confirmação antes de apagar ou alterar dados importantes
- O cofre de senhas NUNCA é acessível pelo WhatsApp
- Registrar histórico das ações feitas por WhatsApp para auditoria

## 8. Funcionalidades extras (obrigatórias no escopo)
1. Revisão semanal automática gerada pelo Claude (hábitos, gastos, treinos,
   estudos e tarefas atrasadas), enviada no app e no WhatsApp.
2. Metas de vida ligadas a tarefas, hábitos, finanças e estudos, com progresso.
3. Diário e humor: check-in diário e gráfico de correlação com sono, treino,
   estudo e hábitos.
4. Sono e água: registro rápido, com meta diária.
5. Contas recorrentes e assinaturas: alerta de vencimento e total mensal fixo.
6. Notificações push (PWA) e widgets para a tela inicial do celular.
7. Busca global (Cmd/Ctrl + K) em todos os módulos.
8. Captura rápida por texto ou voz no app, com o Claude classificando o destino.
9. Modo offline (PWA) com sincronização automática ao reconectar.
10. Exportação e backup (CSV/JSON); o cofre exporta apenas criptografado.
11. Gamificação leve: streaks, conquistas e nível, sem pressão excessiva.

## 9. Mobile
- Mobile-first, navegação inferior, botão "+" de criação rápida, gestos de
  deslizar em cartões e checklists
- PWA instalável com notificações, widgets e suporte offline

## 10. Extensão de navegador
- Login com a mesma conta, acesso rápido ao cofre e preenchimento automático
- Captura rápida de tarefas/notas e salvar página como lembrete ou material
  de estudo

## 11. Segurança e privacidade
- RLS no Supabase, validação no servidor, variáveis de ambiente, HTTPS
- Chaves (Claude, WhatsApp, transcrição, Open Finance) somente no servidor
- Dados sensíveis criptografados; conformidade com a LGPD

## 12. Entrega
1. Confirmar nome e apresentar identidade visual
2. Buscar referências no Mobbin e apresentar o design system
3. Modelar o banco de dados (esquema Supabase + políticas RLS)
4. Implementar por módulos: Auth, Dashboard e Tarefas primeiro
5. Integrar assistente Claude no app, depois WhatsApp (áudio + lembretes)
6. Implementar Estudos, Open Finance e a extensão
7. Publicar na Vercel e documentar o setup
Pergunte antes de decisões importantes e entregue cada etapa para validação.