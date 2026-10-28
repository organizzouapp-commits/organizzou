# Layout primitives

Shared building blocks for dashboard screens, in `src/components/organizzou/layout/`. They react to the width of their
container (Tailwind v4 container queries: `@min-[…]`), not to the viewport, so a screen looks right next to the expanded
sidebar, the collapsed rail and on phones without extra breakpoints.

Rules every screen follows (from the UX review):

- At 1280 px and wider nothing leaves a big blank area: use a fluid grid, a main column plus a side column, or stretched cards.
- Text inside wide cards stays at most ~72ch (`max-w-[72ch]`).
- Tabs and segmented controls that do not fit scroll horizontally, snap, and scroll the active item into view; never truncate a label.
- Lists before cards, hairline dividers, 44 px touch targets, 0.4 s `cubic-bezier(0.2,0.8,0.2,1)` transitions.

```tsx
import { PageGrid, PageShell, SettingsLayout, SplitLayout, StatRow } from "@/components/organizzou/layout"
```

## PageShell

Consistent rhythm: optional heading, actions row, then the content with a 24 px gap. The app shell already renders each
page's title and subtitle (from `shell/nav.ts`), so only pass `title`/`subtitle` for screens outside that pattern.

```tsx
<PageShell actions={<Button>Nova tarefa</Button>}>
  <StatRow>…</StatRow>
  <PageGrid>…</PageGrid>
</PageShell>
```

## PageGrid

12 columns, 16 px gap (20 px from 1040 px of container width). Children choose a span with `PageGrid.Item` (`full`,
`half`, `third`, `quarter`, `two-thirds`, `three-fifths`, `two-fifths`) or with `col-span-*` classes.

```tsx
<PageGrid>
  <PageGrid.Item span="three-fifths"><TasksCard /></PageGrid.Item>
  <PageGrid.Item span="two-fifths"><RoutineCard /></PageGrid.Item>
</PageGrid>
```

## SplitLayout

Main column + contextual aside (300–360 px, sticky) from 1000 px of container width (about 1280 px viewport with the expanded
sidebar), stacked below. `asideFirst` puts the aside on top when stacked.

```tsx
<SplitLayout aside={<><SummaryCard /><UpgradeHint … /></>}>
  <TransactionsList />
</SplitLayout>
```

## SettingsLayout

Vertical nav on the left from 1024 px; below that, horizontally scrollable tabs (snap, active tab scrolled into view).
Content in a `max-w-5xl` column.

```tsx
const [tab, setTab] = useState("perfil")
<SettingsLayout sections={[{ id: "perfil", label: "Perfil", icon: UserIcon }, …]} active={tab} onChange={setTab}>
  {tab === "perfil" ? <ProfileForm /> : …}
</SettingsLayout>
```

## StatRow

Auto-fit grid of stat cards (`repeat(auto-fit, minmax(min(200px, 100%), 1fr))`), equal heights. `min` changes the minimum
card width. Use at most one `tone="highlight"` card (one Lima KPI per screen).

```tsx
<StatRow min={220}>
  <KpiCard tone="highlight" label="Tarefas hoje" value="4" />
  <KpiCard label="Hábitos" value="1/5" />
  <KpiCard label="Água" value="1,25 L" />
</StatRow>
```
