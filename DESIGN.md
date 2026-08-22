# DESIGN.md

OpenPlan AI Frontend Design System — reference for Claude Code instances building UI in this repository.

---

## Foundational Rules

1. **Tailwind utility classes** for everything structural (layout, spacing, border-radius, typography weight/size).
2. **`cn()`** from `src/lib/utils.ts` for all conditional class merging — never string concatenation.
3. **Inline `style={{}}`** only for computed/dynamic values: exact hex colors, calculated widths/heights, percentage-based positions.
4. **CSS custom properties** (`hsl(var(--token))`) for all theme-aware colors. **Hardcoded hex** for hardware-domain colors (BOM categories, module types) that are intentionally not theme-aware.
5. **Inter** is the font family (set in `tailwind.config.ts`). No other font is used.
6. **`--radius: 0.5rem`** is the base radius. Tailwind aliases: `rounded-lg` = `var(--radius)`, `rounded-md` = `calc(var(--radius) - 2px)`, `rounded-sm` = `calc(var(--radius) - 4px)`.

---

## Color System

### Theme Tokens (CSS custom properties, `src/index.css`)

All HSL, resolved via Tailwind as `hsl(var(--token))`. The `.dark` class on `<html>` switches the values; the component code never changes.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--background` | `0 0% 99%` | `220 20% 7%` | Page background |
| `--foreground` | `220 20% 10%` | `220 14% 96%` | Primary text |
| `--card` | `0 0% 100%` | `220 20% 10%` | Card surface |
| `--muted` | `220 14% 96%` | `220 14% 14%` | Subtle background fills |
| `--muted-foreground` | `220 10% 46%` | `220 10% 55%` | Secondary/hint text |
| `--border` | `220 13% 91%` | `220 14% 16%` | All borders and dividers |
| `--primary` | `220 20% 15%` | `220 14% 96%` | CTA buttons, active states |
| `--destructive` | `0 72% 51%` | `0 62% 40%` | Delete, error states |
| `--ring` | `220 20% 15%` | `220 14% 80%` | Focus ring |

**Sidebar tokens** (`--sidebar-*`) are used exclusively inside `src/components/ui/sidebar.tsx`.

### Status Colors (CSS tokens → Tailwind `status-*`)

```
status-todo         hsl(220 10% 75%)    — Gray
status-in-progress  hsl(217 91% 60%)    — Blue
status-review       hsl(280 75% 60%)    — Purple
status-done         hsl(142 71% 45%)    — Green
status-blocked      hsl(0 72% 51%)      — Red
```

Use as `text-status-done`, `bg-status-in-progress/10`, etc. **Always pair color with a text label or icon** — never rely on color alone for status meaning (WCAG accessibility).

### Priority Colors (CSS tokens → Tailwind `priority-*`)

```
priority-critical   hsl(0 72% 51%)      — Red
priority-high       hsl(25 95% 53%)     — Orange
priority-medium     hsl(45 93% 47%)     — Yellow
priority-low        hsl(220 10% 60%)    — Gray
```

### Module Type Colors (hardcoded hex, not theme-aware)

Source of truth: `src/features/projects/utils/projectUtils.ts → getModuleColor()`.

```
hardware      #3B82F6   Blue
software      #8B5CF6   Purple
firmware      #F59E0B   Amber
testing       #EC4899   Pink
design        #06B6D4   Cyan
procurement   #F97316   Orange
manufacturing #10B981   Emerald
qa            #EF4444   Red
logistics     #64748B   Slate
enclosure     #22C55E   Green
pcb           #0EA5E9   Sky
power         #A855F7   Violet
```

Always use `getModuleColor(type)` rather than hardcoding inline. For a tinted background: append `+ '22'` to the hex string (13% opacity).

> **⚠ Known inconsistency:** `src/features/projects/components/ecoData.ts` exports its own `MODULE_COLORS` map with different values for `enclosure`, `pcb`, and `manufacturing`. Use `getModuleColor()` for all new code; fix `ecoData.ts` to import from `projectUtils.ts` when touching the ECO feature.

### BOM Category Colors (hardcoded hex, `bomData.ts → BOM_CAT_META`)

```
assembly    #2563EB   Blue
power       #9333EA   Purple
control     #6366F1   Indigo
connector   #16A34A   Green
enclosure   #EA8C00   Amber/Orange
hmi         #0EA5E9   Sky
safety      #DC2626   Red
```

Access via `BOM_CAT_META[cat].tint`. Tinted background: `${meta.tint}0d` (5% opacity); diagonal stripe pattern: `${meta.tint}1f` (12%).

The `PartThumb` component (`BOMShared.tsx`) encapsulates the pattern — reuse it rather than rebuilding.

### BOM Status Pills

These use inline rgba rather than CSS tokens (intentional — needs to be legible in both themes without becoming fully transparent):

```
approved  background rgba(34,197,94,0.1)   text #16A34A   border rgba(34,197,94,0.2)
pending   background rgba(245,158,11,0.1)  text #D97706   border rgba(245,158,11,0.2)
```

Use `<BOMStatusPill status={...} />` from `BOMShared.tsx` — do not replicate inline.

### Project Stage Colors

Defined locally in `Projects.tsx` and `ProjectDetail.tsx` as `stageColors`:

```
concept     bg-muted text-muted-foreground
design      bg-chart-1/10 text-chart-1
development bg-chart-2/10 text-chart-2
testing     bg-chart-4/10 text-chart-4
production  bg-chart-3/10 text-chart-3
```

Chart color tokens: `chart-1` = blue (`217 91% 60%`), `chart-2` = purple (`280 75% 60%`), `chart-3` = green (`142 71% 45%`), `chart-4` = orange (`25 95% 53%`), `chart-5` = yellow (`45 93% 47%`).

---

## Typography Scale

| Element | Classes |
|---|---|
| Page heading | `text-2xl font-semibold tracking-tight` |
| Section heading | `text-lg font-semibold` |
| Card label | `text-sm font-medium` |
| Secondary/hint text | `text-xs text-muted-foreground` |
| Micro label (uppercase caps) | `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground` |
| Stat value | `text-[26px] font-bold leading-tight` |
| Monospace PN/code | `font-mono text-[11px] font-medium` |

---

## Component Patterns

### Cards

```tsx
<div className="bg-card rounded-lg p-4 border border-border">
  ...
</div>
```

Hover state: add `card-hover` utility class (`transition-all duration-200 hover:shadow-md hover:border-border/80`). Accent border variant: `border-primary/25`.

### Stat Cards (BOM / Dashboard)

```tsx
<div className="bg-card rounded-lg p-4 flex-1 min-w-0 border border-border">
  <div className="flex justify-between items-start mb-2">
    <span className="text-xs text-muted-foreground">{label}</span>
    <Icon className="w-4 h-4" style={{ color: iconColor }} />
  </div>
  <div className="text-[26px] font-bold leading-tight mb-0.5">{value}</div>
  <div className="text-[11px] text-muted-foreground">{sub}</div>
</div>
```

### Dialogs / Modals

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="sm:max-w-[540px] p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]">
    <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
      <DialogTitle className="text-base font-semibold flex items-center gap-2">
        <SomeIcon className="w-4 h-4 text-primary" />
        Title
      </DialogTitle>
      <DialogDescription className="text-xs text-muted-foreground">Subtitle</DialogDescription>
    </DialogHeader>
    {/* Scrollable body */}
    <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
      ...
    </div>
    {/* Sticky footer */}
    <div className="px-5 py-4 border-t border-border shrink-0 flex justify-end gap-2">
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={handleSave}>Save</Button>
    </div>
  </DialogContent>
</Dialog>
```

`p-0 gap-0 overflow-hidden flex flex-col max-h-[85vh]` is the standard content wrapper. The `flex-1 overflow-y-auto min-h-0` pattern is required for the scrollable body to work correctly inside a flex column with a fixed-height constraint.

### Filter Chips (toggle pills)

```tsx
<button
  onClick={onClick}
  className={cn(
    'px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
    active
      ? 'bg-primary text-primary-foreground border-primary'
      : 'bg-muted text-muted-foreground border-transparent hover:border-border'
  )}
>
  {children}
</button>
```

### View Toggle (Kanban ↔ List ↔ Grid)

```tsx
<div className="flex items-center gap-0.5 bg-muted/50 p-1 rounded-lg shrink-0">
  <Button
    variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
    size="sm"
    onClick={() => onViewModeChange('kanban')}
    className={cn("h-8 w-8 p-0", viewMode === 'kanban' && "bg-background shadow-sm")}
  >
    <LayoutGrid className="h-4 w-4" />
  </Button>
  ...
</div>
```

### Toolbar Pattern (search + filters + view toggle)

Left side: search `Input` with `Search` icon at `pl-9`, clear button at right. Right side: `Filter` button with active-count `Badge`, view toggle group. Row: `flex items-center gap-2 w-full justify-between`.

### Filter Drawer (slide-in panel)

Slides in from the right over the content area (absolutely positioned, not a Sheet). Opens with `open` prop; sections divided by `border-b border-border`; section labels use the micro-label style.

### Empty States

One headline (`text-sm font-medium`) + one sentence (`text-xs text-muted-foreground`) + one primary action `Button`. Icon centered above, `opacity-30`. Never show a blank screen.

### Skeleton Loading

Feature-specific skeleton components (e.g. `ProjectDetailSkeleton`) using `<Skeleton className="...">` from shadcn. Route-level fallbacks via `AppLayoutSkeleton` with named `variant` props (`dashboard`, `list`, `project-detail`, `calendar`, `chat`).

### Tabs (ProjectDetail pattern)

```tsx
<Tabs defaultValue="tasks">
  <TabsList className="grid w-full grid-cols-5">   {/* update cols count when adding tabs */}
    <TabsTrigger value="tasks"><ListTodo className="w-4 h-4 mr-1.5" />Tasks</TabsTrigger>
    ...
  </TabsList>
  <TabsContent value="tasks" className="mt-4">...</TabsContent>
</Tabs>
```

BOM tab uses full bleed height: `className="mt-0 -mx-6"` with `style={{ height: 'calc(100vh - 280px)' }}`.

### Badges

```tsx
<Badge variant="secondary" className={cn(stageColors[stage])}>Concept</Badge>
```

Status/priority badges always include text, never color alone.

---

## Animations & Motion

Defined in `tailwind.config.ts`:

| Class | Duration | Usage |
|---|---|---|
| `animate-fade-in` | 200ms ease-out | Panel/card entrance (translateY 4px → 0, opacity 0 → 1) |
| `animate-fade-out` | 200ms ease-out | Exit |
| `animate-slide-in-right` | 300ms ease-out | Side panel/drawer entrance |
| `animate-accordion-down/up` | 200ms ease-out | shadcn Accordion (internal) |

**Global transition utility:** `.transition-base` = `transition-all duration-200 ease-out`. Use on interactive elements.

**Reduced motion:** All transform-based entrance animations must be wrapped with `@media (prefers-reduced-motion: no-preference)` or conditionally disabled when `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. Kanban drag rotation and card lift must not animate under reduced motion.

---

## Icons

`lucide-react` exclusively. Standard sizes: `w-4 h-4` (inline/toolbar), `w-5 h-5` (larger UI elements), `w-6 h-6` (empty state hero). Color via Tailwind class or inline `style={{ color: hex }}` for domain-specific tints.

Icon + label pattern: `flex items-center gap-1.5` with icon at `w-4 h-4` and label in the appropriate text class.

---

## Scrollbars

Apply `.custom-scrollbar` (from `index.css`) to any overflowing container that needs a styled scrollbar: 4px width, transparent track, border-colored thumb. Uses the CSS `scrollbar-width: thin` fallback for Firefox.

---

## Layout Structure

```
AppLayoutOutlet
└── AppSidebar (collapsible, sidebar tokens)
└── main content area
    └── Feature page
        └── ProjectDetail → Tabs
            └── Tab content (full-bleed for BOM/Requirements)
```

Sidebar collapsed state via `useSidebar()` hook from `src/components/ui/sidebar.tsx`. `state === 'collapsed'` drives icon-only mode.

The BOM Map view (`BOMMapView.tsx`) persists node positions and collapsed state in `localStorage` under keys `bom_map_pos` and `bom_map_collapsed`. It uses an SVG layer for curved connectors and a React layer for draggable node cards — both absolutely positioned in the same container.

---

## Virtual Scrolling

Large lists (BOM tree rows, task lists with 1000+ items) use `@tanstack/react-virtual` with a fixed item height and 5-item overscan. Apply when a list may exceed ~100 items.

---

## Owner Avatar Pattern

Consistent across features:

```tsx
function ownerInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}
const OWNER_COLORS = ['#7C3AED','#2563EB','#059669','#D97706','#DC2626','#0891B2','#EA580C','#4F46E5'];
function ownerColor(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return OWNER_COLORS[Math.abs(h) % OWNER_COLORS.length];
}
```

This produces a deterministic color per name. `BOMView.tsx` and `BOMDetailScreen.tsx` both implement this inline. When adding a new feature that needs owner avatars, extract to a shared util rather than reimplementing.

---

## Toasts / Notifications

Two toast providers co-exist in `App.tsx`: `<Toaster />` (shadcn) and `<Sonner />` (sonner). Use `import { toast } from 'sonner'` for user-facing feedback messages throughout the app.

---

## Compact Mode

The `.compact` class on a parent element shrinks padding and header height (defined in `index.css`). Used in the Settings page density toggle — applies `compact` to `document.body`.
