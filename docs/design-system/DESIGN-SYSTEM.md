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

**Outfit** (Google Fonts, licença OFL; pesos 300–700 via `next/font/google`) para toda a interface · Geist Mono (códigos/IDs) · `tabular-nums` em valores, horas, timers e calorias (classe `tabular`). Corpo 400, rótulos e botões 500–600, títulos 600.


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
- **Sidebar flutuante** (≥ 768 px): cartão sólido com 16 px de margem (P), raio 24 px, 260 px de largura (rail de 80 px recolhida), altura total menos as margens,
  fundo Grafite (escuro) / Papel (claro). Quatro itens sempre visíveis (Hoje, Tarefas, Agenda, Finanças), grupos **Vida** e **Organização** que dobram, bloco fixo embaixo
  (o grupo Configurações com Perfil, Configurações, Ajuda e Sair, e, por último, o cartão Lima "Conecte seu WhatsApp"). Item: 40 px, raio full, ícone Lucide + rótulo; ativo = pílula Lima com ícone e texto Tinta; hover = Tinta/Papel 6%.
  O estado recolhido/expandido é guardado **por usuário em cookie**; em tablet (768–1023 px) a sidebar começa como rail. Detalhes, rail e grade fluida em **5.6**.
- **Barra superior** (dentro da coluna de conteúdo, sem fundo, alinhada ao topo da sidebar, ~76 px): à esquerda a saudação grande ("Bom dia, Patrick", pelo horário)
  com a data embaixo; nas telas de módulo, o título da página e um subtítulo curto. À direita: pílula de busca (Ctrl K abre a paleta
  de comandos), sino com ponto Lima quando há novidades, alternância de tema, avatar com menu da conta e o botão primário
  contextual "+ Novo" (cada tela registra o seu com `usePrimaryAction`; sem registro abre a captura rápida).
- **Mobile (< 768 px)**: sem sidebar. Cabeçalho que rola com a página (não é fixo) em 3 linhas: avatar (menu da conta, com
  "Conectar WhatsApp"), logo e sino; busca + alternador de tema; chips só de texto (Hoje, Tarefas, Agenda, Finanças, Vida ▾,
  Organização ▾), de vidro quando inativos e Lima no ativo. Depois que o cabeçalho sai da tela, entra uma barra compacta de vidro
  no topo (avatar, logo, busca e sino). `BottomNav` flutuante em pílula de vidro (Hoje · Tarefas · **+** · Agenda · Outros): o item
  ativo expande em pílula Lima com o rótulo, o "+" é um círculo Lima na mesma linha e faz o mesmo que o "+ Novo" do desktop, e
  "Outros" abre uma gaveta com Finanças, Vida e Organização. O assistente é um botão Lima de 48 px acima da ponta direita da pílula.
  O título e o subtítulo da página ficam no conteúdo, abaixo do cabeçalho.
- **Vidro no celular** (`GlassSurface`): sem `backdrop-filter`. Uma cópia muito desfocada da foto (`app-bg-mobile-frost.webp`, gerada por
  `npm run glass-bg`) é pintada dentro da superfície com `position: fixed; inset: 0`, alinhada ao pixel com a camada de fundo e
  recortada com `clip-path`, mais um tom (`bg-background/60`) e borda de 1 px. Nenhum ancestral pode ter `transform`/`contain`/`filter`.

### 5.3 Telas de acesso (entrar, criar conta, recuperar senha)

- **Fundo**: a foto `public/images/auth-background.png` (original em `imagens/Imagem-fundo-site2.png`) cobre a tela inteira
  (`next/image`, `fill`, `priority`, `sizes="100vw"`, `object-fit: cover`, AVIF/WebP). Abaixo de 768 px usa `public/images/auth-background-mobile.png`
  (direção de arte com `<picture>` + `getImageProps`: o celular só baixa a imagem mobile). O contêiner grande flutua sobre ela,
  com raio 28 px e borda de 1 px a 10%.
- **Desktop (≥ 1024 px)**: contêiner centralizado (máx. 1200 px, altura mínima 720 px) em duas metades.
  - **Espaçamento uniforme P = 24 px (desktop)**: o padding do cartão é P nos quatro lados; o painel fica recuado P das bordas do cartão, com P de
    espaço até a área do formulário, e os dois têm exatamente a mesma altura (topo e base alinhados). O fundo sólido do cartão
    (Tinta no escuro, Papel no claro) é o passe-partout: o painel é uma "janela" de raio 20 px para a foto e desliza junto com a
    moldura (sombra enorme da cor `background` presa ao painel, recortada pelo cartão). Vale nas duas posições e durante a animação.
  - **Padding interno 28 px** no painel e na área do formulário: a linha do logotipo e o topo do formulário alinham; a base dos
    cartões de passo fica 28 px acima da base do painel. O formulário fica centralizado na vertical no espaço restante.
  - **Termos/Privacidade** ficam sem padding inferior, centralizados, com a base exatamente na base do painel (a linha da moldura).
    No cadastro o ritmo é compacto (rótulo a 8 px do campo, 16 px entre campos, checklist de senha compacto) em vez de aumentar paddings.
  - **Seletor de tema flutuante**: botão redondo de 48 px fixo no canto superior direito da *viewport* (24 px; 16 px no celular, com
    safe areas), fora do cartão. Sólido para ser visto sobre a foto, nos dois temas: fundo Tinta, ícone Lima (sol/lua de 20 px, traço 2),
    borda 1 px Papel 12% e sombra `0 8px 24px` de Tinta a 35% (exceção permitida: o botão flutua sobre uma foto). Hover (0,4 s): fundo
    Lima, ícone Tinta, escala 1,05. Foco com anel visível. Tooltip "Modo claro" / "Modo escuro".
  - **Painel de destaque transparente**: sem cor de fundo e sem brilho Lima; a foto aparece através dele. Texto em Papel.
    Só há um escurecimento sutil de Tinta (de 15% no topo a, no máximo, 40% embaixo) para garantir contraste.
  - Conteúdo: logotipo por tema, 40 px de altura (`h-10`, também na tela de boas-vindas e acima da sheet no mobile), só nas telas de acesso: tema escuro `public/brand/logo-preta.png`, tema
    claro `public/brand/logo-branca.png` (as duas imagens ficam no DOM e alternam pela classe `dark`: sem flash nem hydration mismatch), selo, título grande, subtítulo e 3 passos. **Passos do login**: "Veja seu dia",
    "Fale com o assistente", "Receba lembretes". **Passos do cadastro**: "Crie sua conta", "Conecte seu WhatsApp",
    "Organize seu dia". Ao trocar de tela, o conteúdo troca com fade + deslize de 8 px, escalonado de 60 ms em 60 ms.
  - **Cartões de passo de vidro**: Papel 8% + `backdrop-blur(16px)` + borda de 1 px em Papel 12%. O passo ativo é Lima com texto
    Tinta. Hover e foco do teclado: sobe 4 px, borda Lima 40%, fundo Papel 12% e círculo do número preenchido de Lima
    (o foco soma o anel). Clicar num passo o torna o ativo (apenas visual).
  - **Metade do formulário sólida**: token `background` (Tinta no escuro, Papel no claro). Alterna de lado junto com o painel.
- **Formulário**: coluna de no máx. ~420 px, centralizada na horizontal e na vertical. Título, subtítulo, divisor "ou", texto do
  botão do Google, link de troca de tela e linha legal **centralizados**; rótulos dos campos alinhados à esquerda.
  O seletor de tema fica fora do cartão (flutuante na viewport); "Termos de uso" e "Política de privacidade" ficam centralizados no
  rodapé da metade do formulário.
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
  `/login` e `/cadastro` são rotas reais, mas a tela é um único `AuthShell` (client) no layout do grupo `(auth)`, que não remonta.
  Recuperar/redefinir senha usam o mesmo shell com o painel à esquerda. Com `prefers-reduced-motion`: só fade.
- **Entrada (ao carregar a página, uma vez)**: o cartão aparece com fade, sobe 16 px e vai de 0,98 a 1 de escala em 0,6 s
  (`cubic-bezier(0.2, 0.8, 0.2, 1)`). Depois, revelação escalonada, 80 ms entre itens, 0,5 s cada (fade + 12 px): logotipo → selo →
  título → subtítulo → cartões de passo (um a um) e, no formulário, título → subtítulo → campos → botões → link de troca → links legais.
  Implementada com a classe `.auth-reveal` + `--reveal` (índice) em `globals.css`; o `AuthShell` remove o atributo `data-intro` quando
  termina, então nada se repete ao trocar entre entrar e criar conta (que tem a própria animação). Com `prefers-reduced-motion`: só fade.
- **Placeholders**: e-mail "Seu e-mail aqui" e senha "Sua senha aqui" em entrar, cadastro e recuperação.
- **Entrar ⇄ recuperar senha**: os dois formulários ficam montados no mesmo palco dentro do `AuthShell` (desktop e sheet). Ao trocar, o atual
  some com fade deslizando 12 px para o lado e o outro entra com fade vindo de 12 px do outro lado (0,4 s); a altura do palco anima até a
  do formulário visível. A URL acompanha (`/login` ⇄ `/recuperar-senha`), inclusive no voltar/avançar do navegador, sem remontar nada.
- **Senha no cadastro**: sem checklist. Uma única mensagem de erro abaixo do campo (ex.: "Use pelo menos 8 caracteres."), exibida depois
  de sair do campo ou ao enviar; a validação com zod (cliente e servidor) segue igual.
- **Mobile (< 1024 px): duas etapas**, sem painel e sem cartões de passo.
  - **Etapa 1, boas-vindas**: a foto em tela cheia com escurecimento sutil de Tinta, e no centro o logotipo do tema (`logo-preta` no escuro,
    `logo-branca` no claro), "Sua vida, organizada." e "Tudo do seu dia em um só lugar.". Embaixo, uma barra de ~72 px (+ safe area) com
    dois botões lado a lado: "Entrar" (transparente, Papel, 600) e "Criar conta" em bloco sólido (Papel com texto Tinta no escuro; Tinta
    com texto Papel no claro), com raio de 28 px no canto superior esquerdo, ocupando a metade direita até a borda. Transições de 0,4 s.
    O seletor de tema flutuante continua no canto superior direito.
  - **Etapa 2, sheet com o formulário**: tocar em "Entrar" ou "Criar conta" abre uma sheet que sobe de baixo (`translateY` 100% → 0, 0,5 s),
    cobrindo ~72% da altura (até 92%, com rolagem interna) sobre a foto. Fundo `background`, raio de 32 px nos cantos de cima, padding de
    24 px e alça de arrastar. Conteúdo centralizado: título grande, campos de 52 px, botão principal, "ou", Google, link de troca (a troca
    faz crossfade dentro da sheet) e "Termos de uso · Política de privacidade" no fim. Não há botão "Voltar": o logotipo (tema atual, 40 px) aparece centralizado
    na foto visível acima da sheet, com fade + escala ao subir, e é o botão "Voltar para o início". Fecham a sheet (descendo em 0,5 s): tocar
    no logotipo, tocar na foto fora da sheet, arrastar a sheet ou a alça para baixo (acompanha o dedo; fecha após 100 px ou num gesto
    rápido), Esc ou o botão Voltar do navegador.
  - **Rotas**: visita direta mostra a etapa 1. `/cadastro`, `/recuperar-senha`, `/recuperar-senha/nova-senha`, `?next=`, `?erro=` e `?saiu=1` (redirecionamento
    do logout) abrem a sheet direto no modo certo. Abrir a sheet adiciona uma entrada ao histórico; trocar de modo dentro dela usa `replace`.
  - **Teclado e safe areas**: `viewportFit: "cover"`, `interactiveWidget: "resizes-content"` e rolagem interna da sheet mantêm o campo
    focado visível; margens e padding usam `env(safe-area-inset-*)`.
  - **Aviso de cookies**: na etapa 1 fica acima da barra inferior (`--cookie-bar-offset`); enquanto a sheet está aberta fica oculto
    (`data-cookie-bar="hidden"` no `<html>`) e volta ao fechar.

### 5.4 Aviso de cookies (LGPD)

Módulo autocontido em `src/components/organizzou/cookie-consent/` (`CookieConsent`, `ConsentGate` e `consent.ts`), pensado para ser
copiado para o site de marketing. Só depende dos componentes shadcn `Button`, `Dialog` e `Switch`.

- **Aparece uma vez por navegador.** A escolha fica no cookie próprio `organizzou_consent` = `{version, necessary: true, analytics,
  marketing, decidedAt}`, 12 meses, `SameSite=Lax`, `Secure` em produção, `Domain` vindo de `NEXT_PUBLIC_COOKIE_DOMAIN` (vazio em
  localhost; `.organizzou.com.br` no futuro, para app e site compartilharem a escolha). Aumentar `CONSENT_VERSION` mostra o aviso de novo.
- **Barra**: fixa no canto inferior ESQUERDO, a 24 px das bordas (16 px no celular, largura total menos as margens), máx. 440 px,
  raio 20 px, padding 28 px, fundo `popover`, borda 1 px a 10%, acima do cartão de acesso. De cima para baixo, alinhado à esquerda:
  título "Antes de continuar…" (20 px / 600), texto de 15 px em `muted` com o link **Política de privacidade.** (600, foreground,
  sublinhado no hover) na linha seguinte, e dois botões `xl` lado a lado de mesma largura: "Não, obrigado" (contorno = recusa os
  opcionais) e "Aceitar cookies" (primário, com seta). No celular os botões empilham, primário em cima.
  Entrada: sobe + fade em 0,4 s; saída: o inverso. A barra é `role="region"`.
- **Preferências por categoria**: a barra não tem "Personalizar". O Dialog com chaves (Essenciais sempre ligada e desativada, Análise e
  Marketing, "Salvar preferências") abre só por `openCookiePreferences()`, a partir de Configurações. `Esc` fecha só o diálogo.
- **Uso**: `hasConsent("analytics")` e `<ConsentGate category="analytics">` envolvem qualquer script futuro, que só carrega após o
  consentimento. `openCookiePreferences()` reabre o diálogo (item "Preferências de cookies" em Configurações → Segurança e dados).
  A página `/politicas#privacidade` tem a seção "Cookies" com as três categorias.
- É montado uma vez no layout raiz. Não há analytics no produto ainda.

### 5.5 Glass surfaces (fundo e moldura do app)

Só o aparelho do app (`/dashboard/**`) tem esse visual. A foto e a moldura são translúcidas; **sidebar, cards, barras e botões redondos são sólidos**.
**Não há `backdrop-filter` nem `filter: blur()` em tempo de execução**: o vidro fosco da moldura é *falso*, feito com uma cópia da foto já desfocada.
Nenhuma cor nova: tudo é Papel, Grafite ou Tinta, com ou sem transparência. Tokens em `globals.css` (`--glass-frame-*`, `--app-bg-tint`).

| Camada | O que é | Receita |
|---|---|---|
| 0 | Foto de fundo **levemente desfocada**, fixa | A foto de `/login` **pré-desfocada de leve** (~7 px; `app-bg.webp` ≥ 768 px, `app-bg-mobile.webp` abaixo; o login continua com as originais nítidas), gerada por `npm run glass-bg`, com art direction (`<picture>`): o celular baixa só a imagem mobile. Camada `fixed inset-0 -z-10`, `contain: strict`, `translateZ(0)`, renderizada **uma vez** no layout `(app)` (componente de servidor). Tinta de tema por cima (`--app-bg-tint`): escuro Tinta 35 %, claro Papel 40 %; no celular, 68 % / 62 % (sem moldura, os cards ficam direto sobre a foto) |
| 1 | Moldura (md+) com **vidro fosco falso** | `fixed inset-5` (20 px), raio 32, `overflow-hidden`, borda 1 px (Papel 14 % escuro / 60 % claro). **Dentro** dela, `FrameGlass` pinta, abaixo do conteúdo: (1) a cópia **muito desfocada** da foto (`public/images/app-bg-frost.webp`, desfoque ~88 px, exportada em 960 px de largura e ampliada com `object-fit: cover`; gerada a partir da foto original nítida por `npm run glass-bg` com sharp; as intensidades ficam no topo do script), (2) a tinta da moldura (escuro Tinta 30 % / claro Papel 35 %) com o brilho interno do topo e um reforço de tinta sob o cabeçalho da página, que some em ~230 px |
| 2 | Sidebar | Sólida: `--sidebar` (Grafite / Papel), borda 1 px a 10 %, raio 24 |
| 2 | Cards, top bar, botões redondos, BottomNav | Sólidos: `--card` (Grafite / Papel), borda 1 px `--border`, raio 24, sem sombras pesadas. O card de destaque (Lima) continua sólido |

**Técnica do alinhamento (vidro falso).** A foto nítida ocupa a janela (`fixed inset-0`, `object-fit: cover`, centro). A camada desfocada é uma caixa do **tamanho da janela**
(`100vw × 100vh`, mesma proporção, `object-fit: cover`, mesmo ponto focal) deslocada para trás pela distância da moldura até a janela (20 px de margem + 1 px de borda = `-21px`
em cima e à esquerda), e recortada pelo raio da moldura. Cada pixel cai exatamente sobre o pixel correspondente da foto nítida: ao redor da moldura a foto é nítida, dentro dela é fosca,
como um vidro de verdade. Como o tamanho usa unidades de janela, o alinhamento sobrevive a redimensionar; e a moldura é fixa à janela, então **não se mexe** quando a sidebar recolhe (só o conteúdo muda).
`tests/e2e/account-menu.mjs` confere a geometria nos dois sentidos e que nenhum elemento tem `backdrop-filter`/`filter`.

**Fica sólido (token `popover`)**: popovers, menus, dialogs, sheets, drawers e a paleta de comandos.

**Regras de desempenho**

- Nada de `backdrop-filter`, `filter: blur()`, `will-change` nem animação contínua dentro do app. O desfoque é feito antes (WebP de ~10 KB), não em tempo de execução.
- Nada pinta de novo na rolagem: a foto e a camada da moldura são estáticas, em camadas próprias.
- Medido em `/dashboard` (rolagem do conteúdo e recolher/expandir a sidebar, CPU 4× mais lenta, Chromium sem GPU, `tests/e2e/perf-scroll.mjs`): rolagem a 60 fps (16,7 ms por quadro).

**Contraste**: texto ≥ 4,5:1 (3:1 para texto grande) medido nos pixels renderizados (`tests/e2e/glass-contrast.mjs`). Se algo reprovar, aumente a opacidade da tinta daquela superfície; não crie cor nova.
Por isso `--muted-foreground` é Papel 68 % (escuro) e Tinta 72 % (claro), os rótulos de abas usam `text-foreground/85`, e o cabeçalho da página tem o reforço de tinta descrito acima.
Com `prefers-reduced-transparency: reduce`, a moldura vira sólida e a tinta cobre a foto. Rótulos de eixo de gráficos usam `fill-muted-foreground` (o Recharts 3 mudou o markup).

### 5.6 Estrutura do shell do app (sidebar, moldura, grade fluida)

**Moldura e padding único P = 16 px.** A moldura fica a 20 px da janela. A sidebar flutuante fica a **P = 16 px** das bordas da moldura, e a coluna
de conteúdo (top bar + página) usa o **mesmo P**: começa na altura do topo da sidebar, termina na altura da base dela e mantém P da borda direita.
Só a caixa de conteúdo rola (`data-app-scroll`): `overscroll-behavior: contain`, recortada com raio 24, nada encosta nas bordas da moldura.
**Sem barra de rolagem visível** na sidebar e no conteúdo (`no-scrollbar`: `scrollbar-width: none`); a rolagem continua com mouse, toque e teclado.

**Sidebar expandida (260 px).** Sempre visíveis: Hoje, Tarefas, Agenda, Finanças. Grupos que dobram (`Collapsible`, chevron que gira, altura animada em
0,4 s): **Vida** (Rotina, Treinos, Dieta, Estudos) e **Organização** (Notas e lembretes, Metas, Diário, Cofre). O estado de cada grupo é lembrado por usuário
(`localStorage`, chave derivada do cookie da sidebar) e o grupo da página ativa abre sozinho ao navegar. Bloco fixo embaixo, nesta ordem: o grupo **Configurações** (mesmo `Collapsible`, mesma animação de 0,4 s; ao abrir, o bloco cresce para cima e só a lista de navegação encolhe) e, **por último**, o card Lima "Conecte seu WhatsApp".
O grupo **Configurações** tem Perfil (`/dashboard/perfil`), Configurações (`/dashboard/configuracoes`), Ajuda (`/dashboard/ajuda`) e Sair; **Sair sempre pede confirmação** (`AlertDialog` "Deseja sair da sua conta?"). Os mesmos itens aparecem no menu do avatar da barra superior e no cabeçalho do celular (que também lista "Conectar WhatsApp"). Se a tela for baixa, só a lista de navegação rola (sem barra); o bloco de baixo nunca. Em telas até
900 px de altura o card dispensa o ícone e a descrição. Contador (ex.: Tarefas 15) à direita do rótulo; num grupo fechado aparece a soma dos itens.

**Rail (recolhida, 80 px).** Todo controle é um quadrado de 44 px no **mesmo eixo vertical** (logo, botão de recolher, itens, item ativo Lima, itens de baixo e o ícone do
WhatsApp). Cada grupo vira um ícone (Vida = coração com pulso, Organização = pasta, Configurações = engrenagem) que abre um *flyout* (Popover à direita; o de Configurações alinha pela base e abre para cima) com os itens. Contador: bolinha Lima com número Tinta no canto
superior direito do ícone (nos grupos, a soma). Tooltip com o rótulo ao passar o mouse.

**Grade fluida.** O conteúdo usa toda a largura ao lado da sidebar (sem `max-width` nem centralização). A grade de 12 colunas (gap 20 px) reflui por **container queries**
(`@container` na caixa de conteúdo), não pela janela: KPIs em 4 colunas a partir de 1040 px de conteúdo (2 abaixo; 3 KPIs: 3 colunas a partir de 560 px), seções de duas colunas
empilham abaixo de 900 px (`@min-[900px]:col-span-*`). Diálogos, sheets e popovers ficam fora do container e mantêm os breakpoints da janela.

**Regras de desempenho do shell**

- Fundo e moldura seguem a seção 5.5: foto original nítida numa camada fixa (`contain: strict`, `translateZ(0)`) renderizada **uma vez** no layout `(app)`, e o vidro fosco da moldura é uma cópia pré-desfocada da foto alinhada pixel a pixel, sem filtros em tempo de execução.
- **Nenhum** `filter: blur()` nem `backdrop-filter` no shell (o vidro é a cópia pré-desfocada); sem `will-change`; sem animação contínua. Sidebar e barra superior são `memo`, com props e contexto estáveis (abrir diálogos e sheets não re-renderiza).
- Compare sempre em produção (`npm run build && npm start`): o modo dev é bem mais lento.

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
(rótulo + número herói + apoio, sem caixa), `HabitCheck`, `ListRow`, `BottomNav` (pílula flutuante: 4 itens + "+" central elevado;
ativo em pílula Lima com rótulo), `AssistantFab`, `EmptyState`.

---

## 9. Acessibilidade

Texto ≥ 4,5:1 e elementos gráficos ≥ 3:1 (todas as combinações acima verificadas). Nunca comunicar só por cor.
Foco visível sempre. pt-BR em datas e moeda (`R$ 1.234,56`).

---

## 10. Tom de voz

Calmo, direto, em segunda pessoa. "Tudo certo por hoje." · "3 tarefas para hoje." · "Gasto registrado."
Erros dizem o que fazer: "Não consegui salvar. Verifique a conexão e tente de novo."
