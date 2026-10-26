# Organizzou — Design System (v2 · clean, layout v3)

Fonte da verdade visual do app. Todo componente, tela e PR deve seguir este documento.
O **layout v3** (seções 5.1 a 5.3: cartões bento, sidebar flutuante, barra superior e telas de acesso) vale para todas as fases futuras.
Stack: Next.js (App Router) + Tailwind CSS v4 + shadcn/ui (Radix, preset Nova) + ícones Lucide.
Tokens prontos: `organizzou-tokens.css` (mesclar em `src/app/globals.css`).

---

## 1. Princípios

1. **Clean.** Fundo liso, poucas caixas, muito espaço. Separar com espaço e linhas finas antes de usar cards.
2. **Paleta fechada de 6 cores.** Nenhuma outra cor entra no sistema. Bordas, textos secundários e fundos suaves
   são as mesmas cores com transparência.
3. **Lima é o único destaque.** Ação principal, item ativo, progresso e foco. No máximo ~5–10% da tela.
4. **Escuro primeiro.** O modo escuro é o padrão; o claro é completo, com o mesmo cuidado.
5. **Ícone identifica o módulo, não a cor.** Todos os módulos usam a mesma paleta.
6. **Mobile-first.** Projetar em 375 px, depois 768 e 1280.

---

## 2. Paleta (as únicas cores do sistema)

| Cor | HEX | Papel |
|---|---|---|
| **Lima** | `#DBFD00` | Destaque: botão primário (escuro), item ativo, progresso, checks, foco |
| **Lima verso** | `#8FA800` | Segundo tom do ícone; série secundária de gráficos no escuro |
| **Tinta** | `#0C0E07` | Fundo do escuro; texto e botão primário no claro |
| **Tinta verso** | `#4B5A00` | Destaque legível no claro (progresso, foco, gráficos); dobra do ícone sobre lima |
| **Grafite** | `#1A1D12` | Superfícies no escuro (cards, menus, modais) |
| **Papel** | `#F6F7F0` | Fundo do claro; texto no escuro |

Transparências permitidas (sempre de Papel no escuro, de Tinta no claro): 4–8% para fundos suaves e hover,
10% para bordas, 16–18% para bordas de inputs, 60–65% para texto secundário.

### 2.1 Tokens (shadcn)

| Token | Escuro (padrão) | Claro |
|---|---|---|
| `background` | Tinta | Papel + Tinta 4% (para os cartões Papel se destacarem) |
| `foreground` | Papel | Tinta |
| `card` / `popover` | Grafite | Papel (com borda) |
| `primary` / `primary-foreground` | Lima / Tinta | Tinta / Papel |
| `secondary`, `muted` | Papel 6% | Tinta 4–5% |
| `muted-foreground` | Papel 60% (6,8:1) | Tinta 65% (5,9:1) |
| `accent` (hover) | Papel 8% | Tinta 6% |
| `border` / `input` | Papel 10% / 16% | Tinta 10% / 18% |
| `ring` (foco) | Lima | Tinta verso |
| `highlight` / `highlight-foreground` | Lima / Tinta | Lima / Tinta |
| `destructive` / `destructive-foreground` | Papel / Tinta | Tinta / Papel |
| `chart-1…5` | Lima, Lima verso, Papel, Papel 45%, Tinta verso | Tinta verso, Tinta, Lima verso, Tinta 35%, Grafite |
| `sidebar` / `sidebar-foreground` | Grafite / Papel | **Tinta / Papel** (sidebar escura sobre app claro) |
| `sidebar-accent` (hover) · `sidebar-border` | Papel 6% · Papel 10% | Papel 6% · Papel 10% |
| `sidebar-primary` / `sidebar-ring` | Lima / Lima | Lima / Lima |

A sidebar é **escura nos dois modos**: use sempre o logotipo do modo escuro nela e no painel de destaque do acesso.

`highlight` é o lima nos dois modos, sempre com texto/ícone em Tinta por cima: pílula do item ativo na navegação,
seleção de texto, badges de "hoje". **Lima nunca é usado como texto ou linha sobre Papel** (contraste 1,1:1).

### 2.2 Estados sem cores extras

- **Sucesso:** ícone `check`/`circle-check` + texto; no escuro pode usar Lima.
- **Atenção:** ícone `triangle-alert` + texto em `foreground`.
- **Erro / ação destrutiva:** ícone (`circle-alert`, `trash-2`) + texto, botão de variante `outline` ou
  `destructive` (Papel/Tinta) e **sempre um diálogo de confirmação**. Nunca depender de cor.
- **Valores financeiros:** positivo com `+` e seta `arrow-up-right`; negativo com `−` e `arrow-down-right`.

> Decisão de produto: o sistema não tem vermelho/verde de status. Se no futuro for indispensável (ex.: saldo
> negativo em Finanças), adicionar **uma** cor de alerta e registrar aqui.

---

## 3. Marca

| Arquivo | Uso |
|---|---|
| `organizzou-logotipo-modo-escuro.svg` | Tema escuro (nome em Papel) |
| `organizzou-logotipo-modo-claro.svg` | Tema claro (nome em Tinta) |
| `organizzou-icone.svg` | Ícone do app, favicon, PWA |

**Exceção única à paleta de 6 cores:** a marca "G" multicolorida do Google no botão "Continuar com Google" (ativo de terceiros,
seguir as diretrizes de login do Google: botão neutro, "G" sem alteração, texto "Continuar com Google"). Nenhuma outra tela,
ícone ou componente pode sair da paleta. Em código, só `GoogleMark` (`src/components/auth/auth-parts.tsx`) contém essas cores.

Respiro mínimo: altura de uma barra do zz. Logotipo mín. 96 px de largura; ícone mín. 16 px.
Não recolorir, não aplicar sombra. A Surgena existe só dentro do logo (em curvas); não usar na interface.

---

## 4. Tipografia

Geist Sans (UI) · Geist Mono (códigos/IDs) · `tabular-nums` em valores, horas, timers e calorias (classe `tabular`).

| Estilo | Tamanho/linha | Peso | Tracking | Uso |
|---|---|---|---|---|
| Display | 36/40 (mobile 30/36) | 600 | −0.02em | Número herói |
| H1 | 28/34 (mobile 26/32) | 600 | −0.02em | Título da página |
| H2 | 20/28 | 600 | −0.01em | Seção |
| H3 | 17/24 | 600 | 0 | Título de card |
| Body | 15–16/24 | 400 | 0 | Texto padrão (inputs sempre 16 no mobile) |
| Small | 13/20 | 400–500 | 0 | Metadados, datas |
| Overline | 11/16 | 600 | 0.12em, maiúsculas | Rótulo de seção ("PRÓXIMAS") |

Hierarquia por **peso e opacidade**, não por cor: título em `foreground`, apoio em `muted-foreground`.

---

## 5. Espaço, forma e superfícies

- Base 4 px. Escala: 4, 8, 12, 16, 24, 32, 40, 48, 64.
- Margem lateral: 16 px mobile · 24 tablet · 40 desktop. Conteúdo máx. 1120 px.
- Entre seções: 32 px (mobile 24). Dentro de cards: padding 20–24 px.
- **Raio** `--radius: 0.75rem` (12 px): botões e inputs 12, cards 16, sheets/modais 20, chips/avatares/toggles `full`.
- **Superfícies:** escuro = Tinta → Grafite (sem sombras). Claro = Papel + borda Tinta 10% (sem sombras;
  apenas popovers/modais com `0 12px 32px rgb(12 14 7 / 0.10)`).
- **Listas antes de cards:** itens separados por linha `border` com ícone em `muted-foreground`.
- Alvos de toque mínimos de 44 × 44 px.

### 5.1 Cartões e grade bento (layout v3)

- Conteúdo em **grade de 12 colunas**, `gap` 20 px, largura máxima 1440 px. Cada cartão escolhe suas colunas
  (`col-span-12 lg:col-span-7`, etc.); no celular tudo empilha em 1 coluna.
- **Cartão**: raio **24 px**, padding 24 px, fundo Grafite (escuro) / Papel (claro), borda 1 px a 10%, **sem sombra**.
  Cabeçalho = título (H3) + botão redondo com contorno e seta `arrow-up-right` à direita + link "Ver tudo" quando fizer sentido.
- **Um único cartão de destaque por tela**: o KPI mais importante em Lima com texto Tinta (`KpiCard tone="highlight"`).
  Os demais KPIs são neutros. Números grandes em `tabular-nums`, com uma linha de apoio/variação embaixo. Valores longos
  (moeda, kg) descem um tamanho para nunca quebrar linha.
- Listas dentro de cartões continuam limpas: linhas finas, sem caixas aninhadas. Componentes: `Bento`, `BentoCard`, `KpiCard`
  (`src/components/organizzou/Bento.tsx`).

### 5.2 Estrutura do app (sidebar e barra superior)

- **Fundo da página**: Tinta no escuro; Papel + overlay de Tinta 4% no claro.
- **Sidebar flutuante** (≥ 768 px): cartão com 16 px de margem, raio 24 px, 260 px de largura (rail de 80 px recolhida), altura total
  menos as margens, fundo Grafite (escuro) / Tinta (claro). De cima para baixo: logotipo; grupos com rótulo overline
  **MENU** (Hoje, Tarefas, Rotina, Agenda), **VIDA** (Finanças, Treinos, Dieta, Estudos), **ORGANIZAÇÃO** (Notas e lembretes, Metas,
  Diário, Cofre); cartão Lima "Conecte seu WhatsApp" (some no rail); Configurações, Ajuda, Sair.
  Item: 44 px, raio full, ícone Lucide + rótulo; ativo = pílula Lima com ícone e texto Tinta; hover = Papel 6%; contador opcional
  (círculo Papel 10%). O botão de recolher alterna entre sidebar e rail com dicas (tooltips); o estado é guardado **por usuário em cookie**.
  Em tablet (768–1023 px) a sidebar começa como rail.
- **Barra superior** (dentro da área de conteúdo, sem fundo, ~80 px): à esquerda a saudação grande ("Bom dia, Patrick", pelo horário)
  com a data embaixo; nas telas de módulo, o título da página e um subtítulo curto. À direita: pílula de busca (Ctrl K abre a paleta
  de comandos), sino com ponto Lima quando há novidades, alternância de tema, avatar com menu da conta e o botão primário
  contextual "+ Novo" (cada tela registra o seu com `usePrimaryAction`; sem registro abre a captura rápida).
- **Mobile (< 768 px)**: sem sidebar. `BottomNav` (Hoje · Tarefas · + · Finanças · Mais) e barra superior compacta (avatar, título da
  página, sino e busca). "Mais" abre um sheet com os grupos de navegação e o cartão do WhatsApp.

### 5.3 Telas de acesso (entrar, criar conta, recuperar senha)

- **Fundo**: a foto `public/images/auth-background.png` (original em `imagens/Imagem-fundo-site2.png`) cobre a tela inteira
  (`next/image`, `fill`, `priority`, `sizes="100vw"`, `object-fit: cover`, AVIF/WebP). O contêiner grande flutua sobre ela,
  com raio 28 px e borda de 1 px a 10%.
- **Desktop (≥ 1024 px)**: contêiner centralizado (máx. 1200 px, altura mínima 720 px) em duas metades.
  - **Moldura (passe-partout)**: o fundo sólido do cartão (Tinta no escuro, Papel no claro) envolve o painel com 20 px em todos os
    lados, inclusive o lado voltado ao formulário. O painel é uma "janela" de raio 20 px para a foto e desliza junto com a moldura
    (a moldura é uma sombra enorme da cor `background` presa ao painel, recortada pelo cartão).
  - **Painel de destaque transparente**: sem cor de fundo e sem brilho Lima; a foto aparece através dele. Texto em Papel.
    Só há um escurecimento sutil de Tinta (de 15% no topo a, no máximo, 40% embaixo) para garantir contraste.
  - Conteúdo: logotipo do modo escuro, selo, título grande, subtítulo e 3 passos. **Passos do login**: "Veja seu dia",
    "Fale com o assistente", "Receba lembretes no WhatsApp". **Passos do cadastro**: "Crie sua conta", "Conecte seu WhatsApp",
    "Organize seu dia". Ao trocar de tela, o conteúdo troca com fade + deslize de 8 px, escalonado de 60 ms em 60 ms.
  - **Cartões de passo de vidro**: Papel 8% + `backdrop-blur(16px)` + borda de 1 px em Papel 12%. O passo ativo é Lima com texto
    Tinta. Hover e foco do teclado: sobe 4 px, borda Lima 40%, fundo Papel 12% e círculo do número preenchido de Lima
    (o foco soma o anel). Clicar num passo o torna o ativo (apenas visual).
  - **Metade do formulário sólida**: token `background` (Tinta no escuro, Papel no claro). Alterna de lado junto com o painel.
- **Formulário**: coluna de no máx. ~420 px, centralizada na horizontal e na vertical. Título, subtítulo, divisor "ou", texto do
  botão do Google, link de troca de tela e linha legal **centralizados**; rótulos dos campos alinhados à esquerda.
  Seletor de tema no canto superior direito da metade do formulário; "Termos de uso" e "Política de privacidade" centralizados no
  rodapé da mesma metade (dentro do cartão).
- **Controles do mesmo tamanho**: campos, botão primário e "Continuar com Google" têm 52 px de altura e raio 12 px. Os botões usam
  o tamanho `xl` do `Button` (52 px, texto 16 px / 600, padding horizontal 24 px); os campos usam `authInputClass`. O cadastro não
  repete a frase legal: só os links "Termos de uso · Política de privacidade" no rodapé do cartão. Cadastro: Nome completo, E-mail, Telefone (máscara BR, +55, E.164),
  Senha com olho e checklist ao vivo. Validação com zod no cliente e no servidor.
- **Transições**: todo estado hover/foco/ativo (botões, links, campos, cartões de passo, alternância de tema, olho) usa
  `transition` de cor, fundo, borda, transform, sombra e, nos links, cor e deslocamento do sublinhado, **0,4 s**,
  `cubic-bezier(0.2, 0.8, 0.2, 1)` (`authMotion` em `auth-parts.tsx`; `transition-all` nos cartões de passo e no círculo do número).
  Links: a cor vai para `foreground` e o `underline-offset` anima de 4 para 6 px. Com `prefers-reduced-motion`, sem movimento.
- **Animação do painel**: no login o painel fica à ESQUERDA; em "Criar conta" ele desliza para a DIREITA (`translateX`, 550 ms,
  mesma curva) enquanto o formulário de cadastro aparece à esquerda; "Entrar" faz o caminho inverso (também no voltar/avançar).
  `/entrar` e `/cadastro` são rotas reais, mas a tela é um único `AuthShell` (client) no layout do grupo `(auth)`, que não remonta.
  Recuperar/redefinir senha usam o mesmo shell com o painel à esquerda. Com `prefers-reduced-motion`: só fade.
- **Mobile (< 1024 px)**: sem painel e sem cartões de passo.
  - **Hero** (~38% da altura) inserido na moldura: margem de 12 px e raio 24 px, com a foto, logotipo no canto superior esquerdo, botão redondo de tema de vidro no direito,
    título + subtítulo centralizados e, embaixo, o controle segmentado "Entrar | Criar conta" (vidro; ativo = Lima com texto Tinta).
  - **Bottom sheet**: cartão sólido (token `background`) com raio de 28 px só nos cantos de cima, sobrepondo o hero em 24 px, com
    o formulário centralizado (mesmos campos de 48 px), botão do Google, link de troca e Termos/Privacidade no fim.
  - Entrar ⇄ criar conta troca o conteúdo da sheet com fade + deslize horizontal. Respeita `env(safe-area-inset-*)`
    (`viewportFit: "cover"`) e `interactiveWidget: "resizes-content"` para o teclado não cobrir o campo ativo.


### 5.4 Aviso de cookies (LGPD)

Módulo autocontido em `src/components/organizzou/cookie-consent/` (`CookieConsent`, `ConsentGate` e `consent.ts`), pensado para ser
copiado para o site de marketing. Só depende dos componentes shadcn `Button`, `Dialog` e `Switch`.

- **Aparece uma vez por navegador.** A escolha fica no cookie próprio `organizzou_consent` = `{version, necessary: true, analytics,
  marketing, decidedAt}`, 12 meses, `SameSite=Lax`, `Secure` em produção, `Domain` vindo de `NEXT_PUBLIC_COOKIE_DOMAIN` (vazio em
  localhost; `.organizzou.com.br` no futuro, para app e site compartilharem a escolha). Aumentar `CONSENT_VERSION` mostra o aviso de novo.
- **Barra**: flutuante, no centro inferior (máx. 720 px, raio 20 px, fundo `popover`, borda 1 px a 10%), com o texto padrão e o link
  "Política de privacidade". Botões: "Aceitar todos" (primário), "Recusar opcionais" (contorno), "Personalizar" (ghost), com as
  mesmas transições de 0,4 s. No celular vira uma sheet de largura total na base, botões empilhados e respeitando as safe areas.
- **Personalizar** abre um Dialog com chaves: Essenciais (sempre ligada, desativada), Análise e Marketing, e "Salvar preferências".
  `Esc` fecha só o diálogo. A barra é `role="region"`.
- **Uso**: `hasConsent("analytics")` e `<ConsentGate category="analytics">` envolvem qualquer script futuro, que só carrega após o
  consentimento. `openCookiePreferences()` reabre o diálogo (item "Preferências de cookies" em Configurações → Segurança e dados).
  A página `/privacidade` tem a seção "Cookies" com as três categorias.
- É montado uma vez no layout raiz. Não há analytics no produto ainda.

---

## 6. Movimento

120 ms (hover/press) · 200 ms (abrir/fechar) · 300 ms (sheets, troca de tela) · 550 ms (painel das telas de acesso), curva
`cubic-bezier(0.2, 0.8, 0.2, 1)`. Micro-animações discretas: check (escala 0.9→1), progresso preenchendo,
card levantando 2 px ao arrastar. Respeitar `prefers-reduced-motion`.

---

## 7. Ícones

Lucide, traço 1.75, 20 px na UI, 24 px na navegação, 16 px inline. Cor: `foreground` (ação) ou
`muted-foreground` (decorativo). Ícone ativo dentro da pílula Lima em Tinta.

| Módulo | Ícone |
|---|---|
| Hoje / Dashboard | `layout-dashboard` |
| Tarefas | `square-kanban` |
| Rotina | `repeat` |
| Agenda | `calendar-days` |
| Finanças | `wallet` |
| Treinos | `dumbbell` |
| Dieta | `apple` |
| Estudos | `graduation-cap` |
| Notas e lembretes | `notebook-pen` |
| Cofre | `shield-check` |
| Assistente | `sparkles` · Áudio: `mic` |

---

## 8. Componentes

| Componente (shadcn) | Regra Organizzou |
|---|---|
| `button` | `default` (primário), `secondary`, `outline`, `ghost`, `link`, `destructive` (Papel/Tinta). 44 px no mobile, raio 12 px (`rounded-lg`). Um primário por tela. |
| `card` | Só quando agrupar de verdade. raio 16 px (`rounded-xl`), borda 1 px, sem sombra. |
| `badge` | `rounded-full`; `secondary` padrão; `highlight` (Lima/Tinta) só para "hoje"/"novo". |
| `input`, `textarea`, `select`, `form`, `label` | 44 px, raio 12 px (`rounded-lg`), borda `input`, foco `ring`. |
| `checkbox` | Circular para hábitos e tarefas; marcado = Lima no escuro, Tinta no claro. |
| `switch`, `radio-group` | Ligado = `primary`. |
| `progress` | Trilho `muted` 6 px; barra `chart-1` (Lima no escuro, Tinta verso no claro). |
| `tabs` | Pílula: ativo `highlight`; inativo `muted-foreground`. |
| `dialog` / `drawer` | Mobile: drawer de baixo; desktop: dialog. Confirmações destrutivas sempre aqui. |
| `command` | Busca global Ctrl/Cmd + K. |
| `calendar` | Hoje com anel `ring`; selecionado `primary`. |
| `chart` | Somente `chart-1…5`. Linhas finas, sem grade pesada. |
| `sonner` | Toasts do assistente, fundo `popover`, ícone + texto. |
| `button` | Tamanho `xl` (52 px, 16 px / 600) para os formulários de acesso. |
| `sidebar` | Variante `floating` (seção 5.2): raio 24 px, 260 px / rail de 80 px, itens de 44 px. |
| `avatar`, `separator`, `skeleton`, `tooltip`, `scroll-area`, `dropdown-menu`, `popover`, `sheet` | Padrão com os tokens. |

Componentes próprios (`src/components/organizzou/`): `Logo`, `ModuleIcon` (só ícone + nome), `Stat`
(rótulo + número herói + apoio, sem caixa), `HabitCheck`, `ListRow`, `BottomNav` (4 itens + "+" central;
ativo em pílula Lima), `AssistantFab`, `EmptyState`.

---

## 9. Acessibilidade

Texto ≥ 4,5:1 e elementos gráficos ≥ 3:1 (todas as combinações acima verificadas). Nunca comunicar só por cor.
Foco visível sempre. pt-BR em datas e moeda (`R$ 1.234,56`).

---

## 10. Tom de voz

Calmo, direto, em segunda pessoa. "Tudo certo por hoje." · "3 tarefas para hoje." · "Gasto registrado."
Erros dizem o que fazer: "Não consegui salvar. Verifique a conexão e tente de novo."
