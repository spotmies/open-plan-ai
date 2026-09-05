# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev            # Start Vite dev server (port 5173)
npm run build          # Production build → dist/
npm run preview        # Preview production build
npm run type-check     # tsc --noEmit

# Testing (Vitest)
npm test                                                  # Run once
npm run test:watch                                        # Watch mode
npm test -- --coverage
npm test -- src/features/projects/                        # Single directory
npm test -- --testNamePattern="useProjects"               # Name filter

# Code quality
npm run lint
```

Backend runs separately at `http://localhost:3001`. Set `VITE_API_BASE_URL` and `VITE_WS_URL` in `.env`.

## Architecture

### Routing & Code Splitting

`src/App.tsx` defines all routes with `React.lazy()` + `<Suspense>`. Every feature route is lazy-loaded, giving ~70% smaller initial bundle. Route-level skeleton components exist per variant (dashboard, list, project-detail, calendar, chat).

### Feature Modules (`src/features/`)

All domain logic lives here. Each feature folder contains its page component(s), sub-components, and any feature-specific hooks. New features follow the same pattern: feature folder → register route in `App.tsx`.

### Modular Monolith Migration (in progress)

`eslint.config.js` defines a target layered architecture enforced via `eslint-plugin-boundaries`: `app → module → shared → infrastructure`, with imports only allowed downward. `src/features/`, `src/services/`, `src/hooks/`, `src/stores/`, `src/pages/`, `src/contexts/`, `src/workers/`, `src/lib/`, `src/data/`, `src/utils/`, `src/types/`, `src/config/`, and `src/components/` are all classified as the unrestricted `legacy` layer until the migration completes.

Only **`src/modules/auth`** has actually been migrated — it has real `components/constants/hooks/pages/schemas/services/stores/types` subfolders and `App.tsx` imports `AuthContext`/auth pages directly from `@/modules/auth`. Every other `src/modules/<name>/` (calendar, chat, dashboard, myday, notifications, projects, reports, settings, team) is a **single `index.ts` bridge file** that just re-exports from the corresponding legacy `src/features/<name>/`, `src/hooks/`, and `src/stores/` — there's no real code there yet. `App.tsx` still lazy-loads routes from `./features/*` for everything except auth.

**Practical implication:** unless you're specifically continuing the migration, add new code to `src/features/`, `src/hooks/`, `src/stores/` as before — not to the `src/modules/<name>/index.ts` stubs. If you do move a feature into `src/modules/`, update its bridge file's re-exports and the corresponding `App.tsx` import.

**Logging convention**: `no-console` is an ESLint error (allows only `table`/`group`/`groupEnd`/`groupCollapsed`/`time`/`timeEnd`). Use `logger` from `src/services/monitoring/logger.ts` instead of `console.*`. Sentry init lives in `src/infrastructure/monitoring/sentry.ts`.

Requirements feature files: `RequirementsView.tsx` (orchestrator), `RequirementDetailScreen.tsx`, `RequirementEditor.tsx`, `RequirementImpact.tsx`, `RequirementsShared.tsx` — all in `src/features/projects/components/`. Data model + adapter/rebuild logic in `requirementsData.ts`. Hooks in `src/hooks/useRequirements.ts`. Key types: 5-tier `ReqType` hierarchy (`stakeholder-need → stakeholder-req → system-req → subsystem-req → component-req`), `ReqStatus` (`draft → reviewed → approved → verified → validated`), `ReqGroup` (9 hardware domains: SYS, PWR, CTL, CHD, ENC, HMI, SAF, SEC, STK). Requirements are cross-linked into the ECO wizard and BOM part editor for traceability.

**Status: wired to the real backend as of 2026-09-02** (`requirement-groups`/`requirements`/`requirement_links` modules — see the backend `CLAUDE.md`). `requirementsData.ts` no longer hardcodes 113 mock rows — `REQS`/`BY_KEY`/`REQ_ROOTS` are still module-level mutable bindings (unchanged architecture), but now populated by `rebuildRequirementsFromApi()`, called once per render in `RequirementsView.tsx` whenever `useRequirementTree(projectId)`'s data changes. Every other consumer (`RequirementDetailScreen.tsx`, `RequirementImpact.tsx`, `ECOWizard.tsx`) reads the same shared bindings and needed no changes.

- **`dataVersion` pattern**: because `REQS`/`BY_KEY` are mutated in place (never reassigned), no `useMemo` dependency array can naturally detect "the data changed." Every memo across `RequirementsView.tsx` that derives from `REQS` (`stats`, `rows`, `filterSet`, plus internals of `CoverageDashboard`/`ReadinessView`/`TraceabilityView`/`RequirementsMapView`) lists `dataVersion` — aliased directly to the `apiTree` reference from `useRequirementTree` — in its deps. **Do not** reintroduce a `ref`-based "already rebuilt this apiTree" guard to gate the rebuild call — that pattern is unsafe under React 18 StrictMode's double-render (the ref's mutation persists across both invocations, so a conditional `setState` made only on the first invocation gets silently dropped). Just call `rebuildRequirementsFromApi(apiTree)` unconditionally when `apiTree` is defined; it's idempotent and cheap.
- **Create/edit form**: `RequirementEditor.tsx` gained a Title field, a Group picker, and a Parent picker (none existed against the mock — parent/group were always pre-authored in hardcoded data tables). Parent options are filtered by tier (`REQ_TYPE[type].tier`) to match the backend's own validation — this also means no separate cycle-check is needed client-side either.
- **Known gaps**: owner shows unresolved (`?`/`—`) since there's no project-member name lookup wired to the real `ownerId` UUID; `depends`/`conflicts`/`alloc` always render empty (no `requirement_links` project-wide listing or BOM linkage in the UI yet); `vmethod`/`vstatus` are fixed placeholders (`test`/`not-verified`) since those don't exist on the backend until Test & Verification lands; `RequirementImpact.tsx`'s "Raise ECO" button is still a mocked stub.

Integrations feature: `src/features/integrations/` — showcase UI for planned connectors (CAD, PLM, spreadsheets, AI tools, git). All items show "Coming Soon"; no backend connectors exist yet.

BOM feature files: `BOMView.tsx` (orchestrator), `BOMDetailScreen.tsx`, `BOMMapView.tsx`, `BOMShared.tsx`, `bomData.ts` (type definitions, adapter functions `fromApiNode()`/`fromApiRevision()`, and all tree utilities — no mock data). Hooks in `src/hooks/useBom.ts`, `useParts.ts`, `useBomDocuments.ts`.

ECO (Engineering Changes) feature files: `ECOView.tsx` (orchestrator — receives `projectId: string` from `ProjectDetail`), `ECOListView.tsx` (KPI cards + list + preview panel), `ECODetailView.tsx` (full detail + approval pipeline + ECN release), `ECOWizard.tsx` (5-step create wizard), `ECOShared.tsx` (shared pills/avatars), `ecoData.ts` (TypeScript types, enums, adapter functions, helper utilities). Hooks in `src/hooks/useECOs.ts`.

### Data Flow

```
Component → custom hook (src/hooks/) → React Query → Axios client → Backend API
                                                    ↑
                                          Zustand (UI-only state)
```

**React Query** (`src/lib/queryClient.ts`): `staleTime: 1min`, `gcTime: 5min`, `refetchOnWindowFocus: false`. All server data goes through React Query hooks in `src/hooks/`.

**Zustand stores** (`src/stores/`): Three stores — `useProjectStore` (projects + tasks local cache), `useFilterStore` (filter preferences), `useUserStore` (current user + preferences). Only for UI-only global state; don't duplicate React Query data here.

### Auth & API Client (`src/services/api/client.ts`)

Backend uses **httpOnly cookie auth** — the frontend never reads or stores tokens. `withCredentials: true` on the Axios instance sends cookies automatically.

The 401 response interceptor implements a **refresh queue**: all parallel failing requests are queued, a single `POST /auth/refresh` fires, then all queued requests retry. Skip-refresh URLs (login, register, etc.) are enumerated in the interceptor to prevent loops.

All API endpoint strings are constants in `src/services/api/endpoints.ts` — use these rather than inline strings.

### Socket.IO

The socket connection is established once (see the chat feature socket setup). Auth uses the same httpOnly cookie — the backend reads it from the handshake headers. Rooms: `user:{userId}` (auto-joined), `conversation:{id}` (joined via `join-conversation` event), `project:{id}` (for BOM and future real-time features).

### Types

`src/types/index.ts` is the authoritative source for domain types shared across features (`Task`, `Module`, `Milestone`, `TeamMember`, etc.). `ProjectSection` union controls which tabs appear in `ProjectDetail` — add new sections there and in `ProjectDetail.tsx`.

### Testing

Vitest + React Testing Library. Test setup at `src/test/setup.ts`. Path alias `@/` resolves to `src/`. shadcn/ui components are excluded from coverage. Tests live alongside source as `ComponentName.test.tsx` or in `__tests__/` subdirectories.

## Key Conventions

- **Styling**: Tailwind utility classes throughout; `cn()` from `src/lib/utils.ts` for conditional classes. Inline `style={}` only for computed/dynamic values (e.g. exact hex colors, percentage widths). Never use raw hex colors in Tailwind className — use inline styles.
- **Icons**: `lucide-react` exclusively.
- **Components**: shadcn/ui primitives (`Button`, `Dialog`, `Badge`, `Tabs`, `ScrollArea`, etc.) from `src/components/ui/`.
- **BOM category colors** use inline hex (not Tailwind theme-aware) — intentional for the hardware domain color coding.
- **PRD.md** is the authoritative product spec. `src/types/index.ts` is the authoritative type source.
- **New shadcn components**: `npx shadcn-ui@latest add <component>` — outputs to `src/components/ui/`.
- Module type vocabulary and status enumerations are fixed (`TASK_STATUSES`, `PRIORITIES`, `MODULE_TYPES`). Custom values are not supported at v1.
- **Enum case convention**: Backend API returns enum values in lowercase (`in_review`, `design_change`). Frontend TypeScript types use UPPERCASE (`IN_REVIEW`, `DESIGN_CHANGE`). Convert inbound with `.toUpperCase()` in adapter functions; outbound with `.toLowerCase()` in mutation payloads. See `ecoData.ts` adapters for the established pattern.

## Custom Columns & Tags

- **Task columns**: `useProjectTaskColumns` hook + `projectTaskColumns.service.ts` — per-project Kanban column definitions (key, label, color, position, isSpecial). Backed by `/projects/:projectId/task-columns` endpoints.
- **Issue columns**: `useIssueColumns` hook + `issueColumns.service.ts` — same pattern for issue boards.
- **Tags**: `useProjectTags` hook + `projectTags.service.ts` — project-scoped tag master (name + color). Tasks/issues store tag names as text arrays; the tags API is the canonical color source.

## ECO — Key Integration Notes

- `useECOs.ts` exports 14 React Query hooks: `useECOList`, `useECOStats`, `useECODetail`, `useCreateECO`, `useUpdateECO`, `useDeleteECO`, `useSubmitECO`, `useECODecision`, `useReleaseECO`, `useVerifyECO`, `useCloseECO`, `useHoldECO`, `useResumeECO`, `useGetECN`. All invalidate relevant `queryKeys.ecos.*` entries on success.
- `useECOList` uses `apiClient.raw.get` (not the wrapper) to access the paginated response shape `{ data: r.data.data, meta: r.data.meta }`.
- `ecoData.ts` adapter functions: `fromApiEcoListItem(raw: ApiEcoListItem): ECOListItem` and `fromApiEcoDetail(raw: ApiEcoDetail): ECODetail`. These handle the UPPERCASE conversion and map nested objects (parts, steps, diff rows, activities, ECN).
- `ECODetailView` falls back to `buildDetail(eco)` (synthetic pipeline steps) while the live `useECODetail` query loads — avoids a loading spinner for the preview-to-detail transition.
- `ECOListView` preview panel uses `buildDetail(eco)` for pipeline steps — avoids N+1 API calls for each list item.
- **ECN null-check**: `detail.ecn` is `null` for ECOs in `APPROVED` state (ECN doesn't exist until `releaseEco()` is called). Always guard ECN sections with `{ecn && ...}` before rendering distribution list or implementation tasks.
- **`modules` field**: List API returns only `moduleIds: string[]` (UUIDs); `fromApiEcoListItem` sets `modules: []`. The detail API returns full module objects with names — `fromApiEcoDetail` maps them to `raw.modules.map(m => m.name)`.
- Stats route: `/projects/:projectId/ecos/stats` — must be registered before `/:ecoId` on the backend to prevent Express matching `"stats"` as an ecoId.
