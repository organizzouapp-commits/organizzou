# Organizzou — Design System (v2 · clean)

Fonte da verdade visual do app. Todo componente, tela e PR deve seguir este documento.
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
| `background` | Tinta | Papel |
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

---

## 6. Movimento

120 ms (hover/press) · 200 ms (abrir/fechar) · 300 ms (sheets, troca de tela), curva
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
| `sidebar`, `avatar`, `separator`, `skeleton`, `tooltip`, `scroll-area`, `dropdown-menu`, `popover`, `sheet` | Padrão com os tokens. |

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
