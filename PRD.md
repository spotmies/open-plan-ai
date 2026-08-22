# OpenPlan AI — Product Requirements Document

> **Version:** 3.0
> **Status:** In Review
> **Classification:** Confidential
> **Document Owner:** Head of Product
> **Created:** 2026-06-05
> **Last Updated:** 2026-06-05
> **Next Review:** 2026-07-05

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Target Users, Personas & Roles](#4-target-users-personas--roles)
5. [Market & Business Context](#5-market--business-context)
6. [Scope](#6-scope)
7. [User Stories](#7-user-stories)
8. [Feature Requirements](#8-feature-requirements)
9. [User Flows](#9-user-flows)
10. [Authentication & Authorization](#10-authentication--authorization)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Integrations](#12-integrations)
13. [Data Requirements](#13-data-requirements)
14. [Tech Stack & Architecture](#14-tech-stack--architecture)
15. [API & Services Layer](#15-api--services-layer)
16. [State Management](#16-state-management)
17. [UI/UX Patterns & Design System](#17-uiux-patterns--design-system)
18. [Performance Optimizations](#18-performance-optimizations)
19. [Testing Infrastructure](#19-testing-infrastructure)
20. [Milestones & Timeline](#20-milestones--timeline)
21. [Open Questions](#21-open-questions)
22. [Risks & Mitigations](#22-risks--mitigations)
23. [Appendix](#23-appendix)

---

## 1. Executive Summary

### What is OpenPlan AI?

OpenPlan AI is a **hardware-native project-management platform** for the teams that ship physical products — hardware and firmware engineers, program managers, QA, procurement, and manufacturing. Where generic tools (Jira, Asana, Trello) model only tasks and tickets, OpenPlan models the things hardware programs actually run on:

- **Multi-level Bills of Materials** with requirement traceability, where-used, and procurement signals
- **Engineering Change Lifecycle** (ECR → ECO → ECN) with class-based approval pipelines
- **Phase-Gate Milestone Reviews** (Concept → PDR → CDR → MRR → Pilot → Mass Production)
- **Quantified Risk Register** with 5×5 probability × impact heatmap
- **Tasks, Modules & Dependencies** — the daily execution layer tied to hardware subsystems
- **Real-Time Team Chat** — in-context communication per project
- **AI Task Generation** — Claude-powered milestone decomposition

Tasks still exist — Kanban, dependencies, assignees — but they are tied to modules, parts, milestones, and issues of a real build, giving every role one authoritative picture of program state.

### Current Project Status

| Phase | Completion | Description |
|---|---|---|
| Foundation — Auth, RBAC, org shell | 100% | JWT auth, email OTP, RBAC, org/member model |
| Core Execution — Tasks, Projects | 95% | Kanban, dependencies, milestones, issues |
| Hardware Core — BOM, ECO | 60% | BOM CRUD implemented; ECO pipeline in progress |
| Program Governance — Gates, Risk | 30% | Frontend scaffolded; backend routes pending |
| Chat & Notifications | 90% | Socket.IO real-time, DMs, groups, presence |
| AI Task Generation | 85% | Claude-powered, BullMQ-queued, Zod-validated |
| **Overall** | **~70%** | **Production-capable core; hardware modules in active development** |

---

## 2. Problem Statement

### 2.1 The Problem

Hardware teams manage physical-product realities inside software-oriented tools that do not model them. The true state of a build — which BOM revision is released, which change orders are in the approval pipeline, whether a gate's exit criteria are met, which long-lead parts are at risk — lives fragmented across spreadsheets, email threads, PLM exports, and engineers' heads. There is no single object model connecting a requirement to the part that satisfies it, the change that revised it, the task that implements it, and the gate that approves it.

**The cost is concrete:** BOM/ERP drift causes wrong-part builds and scrap; change orders run over email with no enforced approval pipeline, so the wrong revision reaches the line; gate packages are assembled manually and are stale on arrival; and supply risk (a 16-week MCU lead time, an EOL PMIC) is discovered too late to re-spin without slipping the program.

### 2.2 Current Workarounds & Why They Fail

| Workaround | What It Is | Why It Fails |
|---|---|---|
| Spreadsheet BOMs | Excel/Google Sheets per assembly, emailed between teams | No single source; revisions fork; no where-used or requirement links; silent drift from CAD & ERP |
| Email/PDF change orders | ECOs circulated as documents for sign-off | No enforced pipeline, no audit trail, no effectivity control — wrong revision reaches manufacturing |
| Manual gate decks | Slides rebuilt before each phase-gate review | Stale by the meeting; exit criteria not tied to live task/issue status |
| Standalone PLM (Arena, Windchill) | Heavy, IT-owned change & document control | Engineer-hostile, slow to adopt, weak day-to-day task management; enterprise-priced |
| Generic PM (Jira, Asana, Monday) | Task trackers retrofitted onto hardware | No BOM, ECO, gate, or risk model; hardware concepts forced into custom fields no one maintains |

### 2.3 The Opportunity

Connecting requirements, BOMs, changes, tasks, milestones, and risk in one traceable model makes program state **computable rather than assembled by hand**. Gate readiness, change impact, and supply risk become live views instead of stale documents. The AI layer can reason over this connected graph — surfacing the blocking risk, the change that moves a milestone, or the part that should be second-sourced before it becomes a crisis.

---

## 3. Goals & Success Metrics

### 3.1 Product Goals

| ID | Goal | Type | Description |
|---|---|---|---|
| G-01 | Single source of program truth | User | One connected model of projects, modules, milestones/gates, tasks, issues, BOMs, changes and risks — no parallel spreadsheets |
| G-02 | Traceable engineering change | User | Every ECO runs an enforced approval pipeline with class-based rigor, effectivity cut-in, dispositions, and an append-only history |
| G-03 | Gate readiness at a glance | User | Phase-gate status, exit criteria, open issues and percent-complete are live, never manually assembled |
| G-04 | Land hardware teams | Business | Convert hardware programs off spreadsheets/generic PM into paid workspaces |
| G-05 | Audit-ready by default | Quality | Change, gate, and access actions are logged immutably and exportable for quality and customer audits |
| G-06 | Protect customer IP | Compliance | Tenant-isolated data, role-based access, encryption, and export-control-aware handling of design data |

### 3.2 Key Results & Success Metrics

| Metric | Target | Timeframe |
|---|---|---|
| Workspace activation (project + BOM/gate created) | ≥ 60% of new workspaces | 14 days post-signup |
| BOM under management vs. spreadsheet | ≥ 70% of a program's parts in-app | 90 days |
| ECO cycle time (Draft → Released) | −40% vs. email baseline (~3 weeks) | Per change, 6 months |
| Gate reviews run from live data | ≥ 80% of gates opened from app | 6 months |
| Weekly active engineers per paid seat | ≥ 4 sessions/week | Monthly |
| Net revenue retention | ≥ 115% | 12 months |

### 3.3 Non-Goals (v1)

| Non-Goal | Rationale | Planned For |
|---|---|---|
| Native CAD/EDA authoring | OpenPlan references and links design data; it is not a CAD/EDA tool | Never |
| Full MRP/ERP execution (POs, inventory transactions) | Procurement signals add value without becoming a system of record for finance | v2+ integration |
| Replacing regulated QMS / eQMS | v1 provides audit trails and traceability, not validated 21 CFR Part 11 / ISO 13485 workflows | Future tier |
| Native mobile apps | Primary use is desk-based, dense, multi-pane. Responsive web first | v2 (read/notify) |

---

## 4. Target Users, Personas & Roles

### 4.1 User Types

| User Type | Who | Primary Goal | Technical Level | Volume/Workspace |
|---|---|---|---|---|
| Program / Project Manager | Owns schedule, gates, cross-functional coordination | Hit gate dates; see risk and change impact early | Medium | 1–4 |
| Hardware / Mechanical Engineer | Owns modules, BOMs, design tasks & changes | Keep BOM and changes correct and released | High | 5–30 |
| Firmware / Software Engineer | Owns firmware modules and dependent tasks | Track changes that force firmware retarget | High | 3–15 |
| QA / Test Engineer | Owns test, compliance, gate exit criteria | Approve changes; close issues; sign off gates | High | 2–8 |
| Procurement / Supply-chain | Owns sourcing, lead time, supplier changes | De-risk long-lead & EOL parts; manage supplier ECOs | Medium | 1–5 |
| Engineering Executive (VP/Dir) | Portfolio oversight, final gate authority | Trust program status across the portfolio | Medium | 1–3 |
| System / API actor | Integrations (PLM, ERP, distributor, CI) | Sync BOMs, lead times, status automatically | — | — |

### 4.2 Personas

**Persona 1 — Priya, Program Manager (Primary)**
> "I don't need another task board. I need to walk into a gate review knowing exactly what's done, what's blocked, and what's going to bite us in eight weeks."

- Runs the EV Charging Station program; 30-person cross-functional team
- Lives in the gate tracker, dashboard, and risk register; preps Gate 3 (MRR)
- **Core frustration:** Status is always stale — assembled by hand from engineers, spreadsheets and email the night before a review
- **Success:** Opens OpenPlan and the gate package is already true; surprises are surfaced as risks weeks early

**Persona 2 — Sarah, Mechanical Engineer**
> "When I change the housing material, I need to know every part, assembly, and certification that just changed with it — before it ships to the line."

- Owns the enclosure module; originates ECOs (e.g. cast aluminum → die-cast magnesium)
- Daily use: BOM tree, ECO authoring, change diff & where-used, her task queue
- **Core frustration:** No reliable where-used or effectivity control; revision errors reach manufacturing and cause scrap
- **Success:** Files an ECO, sees impacted parts/assemblies and recert needs, routes it through an enforced pipeline

**Persona 3 — Marcus, QA Manager (Approver / Power User)**
> "I'm the gate. If the corrosion data isn't attached, the change doesn't pass — and I need that decision on the record."

- Quality authority in the change pipeline and gate exit criteria
- Daily use: ECO approvals, issue/risk closure, gate sign-off, audit export
- **Core frustration:** Approvals over email leave no defensible trail; reject/rework reasons get lost
- **Success:** Approves or returns changes with a recorded reason; every decision is auditable

### 4.3 Roles, Permissions & Access Control

Roles are scoped to a **workspace (organization)**; project membership further gates visibility.

| Role | Resource | Create | Read | Update | Delete | Notes |
|---|---|---|---|---|---|---|
| **Owner / Admin** | All workspace data | ✓ | ✓ | ✓ | ✓ | Billing, members, org settings, integrations |
| **Program Manager** | Projects, milestones/gates, tasks, risks | ✓ | ✓ | ✓ | Own | Manages members on owned projects; runs gates |
| **Engineer (Member)** | Tasks, modules, BOM, ECOs | ✓ | ✓ | Own / assigned | ✗ | Originates ECOs; edits parts on permitted modules |
| **QA / Approver** | ECO approvals, issues, gate sign-off | Issues | ✓ | Approve/reject | ✗ | Pipeline-step authority; cannot edit others' designs |
| **Procurement** | Suppliers, lead time, supplier ECOs | Supplier ECOs | ✓ | Sourcing fields | ✗ | Procurement module & cost/lead-time fields |
| **Viewer** | Assigned projects | ✗ | ✓ | ✗ | ✗ | Read-only stakeholder / exec |
| **Guest** | Shared link target | ✗ | ✓ (scoped) | ✗ | ✗ | Time-boxed external (supplier/customer) access |

**Permission Rules:**
- Members see only projects they are explicitly added to; workspace-wide visibility is an Admin/PM grant
- ECO pipeline authority is by **assigned step**, not role alone — an approver can only act on their stage
- Final Approval requires VP-Engineering authority (Admin or explicitly designated role)
- A released ECO and its ECN are **immutable**; corrections require a new change order (no in-place edits)
- Project-level role overrides workspace default (an Engineer can be Viewer on a project they're not staffed to)
- Destructive actions (delete project, remove member, revoke access) are Admin-only and always audit-logged

---

## 5. Market & Business Context

### 5.1 Target Market

| Dimension | Description |
|---|---|
| Geography | Global, English-first at v1; North America & EU hardware hubs as beachhead |
| Industry | Electromechanical & electronics — EV/energy, robotics, IoT, medical devices, industrial, consumer hardware |
| Company size | Hardware startups through mid-market OEMs (≈10–500 engineers); enterprise via design partners |
| Buyer vs. user | Buyer: VP Engineering / Head of Program Mgmt. Users: engineers, PMs, QA, procurement |

### 5.2 Competitive Landscape

| Competitor | Primary Strength | Primary Weakness | Our Differentiation |
|---|---|---|---|
| Jira / Asana / Monday | Ubiquitous, flexible task tracking | No hardware model — BOM/ECO/gates faked in custom fields | Native hardware objects, not retrofitted tickets |
| Arena / Duro (PLM) | Real BOM & change control | Heavy, IT-owned, weak daily PM, costly | Engineer-friendly PM + change in one, fast to adopt |
| Windchill / Teamcenter | Deep enterprise PLM | Implementation-heavy, slow | Lightweight, opinionated, traceability without the rollout |
| Spreadsheets + email | Free, flexible, universal | No source of truth, no audit trail, error-prone | Replaces the workaround with a connected model |

**Competitive Moat:** The connected graph. Requirements ↔ parts ↔ changes ↔ tasks ↔ milestones ↔ risk are one model, so impact and readiness are **computed, not assembled** — and that graph is what an AI assistant reasons over.

### 5.3 Monetization Model

| Model | Description | Free/Paid Boundary | Phase |
|---|---|---|---|
| Per-seat subscription | Tiered by role mix; engineers & approvers are paid seats | Viewer seats free/low-cost; editor seats paid | Launch |
| Free / Starter | 1 project, capped BOM lines & members | Gate on projects, members, integrations | Launch |
| Business / Enterprise | SSO/SAML, audit export, advanced permissions, support SLA | Security & governance features per tier | Launch / v2 |
| Usage add-ons | Premium integrations (PLM/ERP), AI assistant credits | Metered above included allowance | v2 |

---

## 6. Scope

### 6.1 In Scope — This Version

| ID | Item | Rationale |
|---|---|---|
| IS-01 | Workspace shell — org switcher, sidebar nav, dashboard, global search, light/dark | Multi-tenant foundation |
| IS-02 | Projects & project detail — stages, grid/list, members | Top-level container |
| IS-03 | Tasks — Kanban & list, status, priority, module type, dependencies, checklists, linked issues | Daily execution layer |
| IS-04 | BOM management — multi-level tree, revisions, suppliers, status, requirement traceability, where-used, lead time | Core hardware object; the wedge |
| IS-05 | Engineering changes — ECR→ECO→ECN, class I/II/III pipeline, dispositions, effectivity, change diff | Controlled, auditable change |
| IS-06 | Milestones & phase gates — timeline, gate detail, exit criteria, open-issue rollup | Program governance |
| IS-07 | Risk & issue register — 5×5 probability×impact, scoring, categories, status | Quantified program risk |
| IS-08 | Reports — KPI cards, module & task-distribution charts; export | Roll-up for leadership |
| IS-09 | Auth, roles & audit log — RBAC, SSO-ready, append-only history | Security & compliance baseline |
| IS-10 | Real-time chat — DMs, group conversations, typing indicators, online presence | In-context team communication |
| IS-11 | AI task generation — Claude-powered milestone task decomposition via BullMQ | AI-assisted planning |
| IS-12 | Notifications — in-app and email; real-time via Socket.IO | Workflow continuity |

### 6.2 Out of Scope — This Version

| Feature | Reason Deferred | Planned For |
|---|---|---|
| Native CAD/EDA viewer & authoring | Integrate/link, don't rebuild design tools | Integration (v2) |
| Full procurement execution (PO issuance, inventory) | ERP territory; v1 surfaces signals only | v2 / integrate |
| Validated eQMS (21 CFR Part 11, ISO 13485) | Regulated-QMS depth needs validation program | Future tier |
| Native mobile apps | Dense desk-based workflows first | v2 |
| Configurable/branching ECO workflow designer | v1 ships standard template with optional-step waivers | v2 |
| Monte-Carlo / quantitative schedule-risk simulation | Quantitative risk is a future capability | v2 |

---

## 7. User Stories

Priority: **P0** launch-blocking · **P1** high value, ships with v1 · **P2** nice-to-have · **P3** v2+

### 7.1 Workspace & Access

| ID | User Story | Priority |
|---|---|---|
| US-001 | As a new admin, I want to create a workspace and invite my team so we share one program space | P0 |
| US-002 | As a returning user, I want to sign in with email/password and verify via OTP so my account is secure | P0 |
| US-003 | As an admin, I want role-based permissions so people only change what they own | P0 |
| US-004 | As a PM, I want a dashboard of active projects, milestones and issues so I see program state on login | P1 |
| US-005 | As a user, I want to join an organization via invitation link so onboarding is frictionless | P0 |

### 7.2 Tasks & Execution

| ID | User Story | Priority |
|---|---|---|
| US-010 | As an engineer, I want a Kanban board with status columns so I can move my work across To Do → Done | P0 |
| US-011 | As an engineer, I want to mark a task blocked by another so dependencies are explicit | P0 |
| US-012 | As an engineer, I want priority, module type, assignees and checklists on a task so it carries real context | P1 |
| US-013 | As a PM, I want to link a task to an issue so blockers are traceable | P1 |
| US-014 | As an engineer, I want to see all my tasks across projects in My Day so I manage my day from one place | P1 |

### 7.3 BOM & Engineering Changes

| ID | User Story | Priority |
|---|---|---|
| US-020 | As an engineer, I want a multi-level BOM tree with part numbers, revisions, suppliers and status | P0 |
| US-021 | As an engineer, I want each part linked to requirements it satisfies so I can prove coverage | P1 |
| US-022 | As an engineer, I want where-used (every assembly a part rolls into) so I see change blast radius | P1 |
| US-023 | As an engineer, I want to raise an ECO and route it through an approval pipeline so changes are controlled | P0 |
| US-024 | As a QA approver, I want to approve or return a change with a recorded reason so decisions are auditable | P0 |
| US-025 | As an engineer, I want a change diff and per-part dispositions with an effectivity cut-in | P1 |
| US-026 | As procurement, I want lead time and lifecycle (EOL) signals on parts so I de-risk long-lead items early | P2 |

### 7.4 Gates & Risk

| ID | User Story | Priority |
|---|---|---|
| US-030 | As a PM, I want a phase-gate timeline (Concept→Mass Prod.) with gate status and percent-complete | P0 |
| US-031 | As a PM, I want a gate's exit criteria, tasks and open issues rolled up so readiness is computed | P1 |
| US-032 | As a PM, I want a 5×5 risk heatmap and register so I can prioritize by probability×impact | P1 |
| US-033 | As an exec, I want to export a gate or risk view so I can brief stakeholders | P2 |

---

## 8. Feature Requirements

> Requirement language is strict: **must** = P0, **shall** = P1, **will** = P2.

---

### F-001: Bill of Materials (BOM) Management — P0

A multi-level, revision-controlled part tree with supplier, status, requirement traceability, where-used, and procurement signals — the hardware system of record.

**Status:** In Development | **Stories:** US-020–026 | **Owner:** Hardware Platform

#### 8.1.1 Functional Requirements

| REQ | Requirement | P |
|---|---|---|
| F-001-R01 | The system must represent a BOM as an unbounded multi-level tree; each node carries part number, description, quantity, unit of measure, supplier/manufacturer, revision, and status | P0 |
| F-001-R02 | The system must support part status of at least `approved` and `pending`, surfaced as a badge and filterable | P0 |
| F-001-R03 | The system must provide list and tree/grid views with expand/collapse, search, and filter by status, supplier, category, and level | P0 |
| F-001-R04 | The system shall link each part to the requirement IDs it satisfies and show requirement coverage on the part detail | P1 |
| F-001-R05 | The system shall compute and display where-used — every parent path and top-level assembly a part rolls into | P1 |
| F-001-R06 | The system shall maintain per-part revision history and indicate the current released revision | P1 |
| F-001-R07 | The system will enrich parts with lead time, distributor, unit price, and lifecycle (e.g. EOL) where a data source is connected | P2 |
| F-001-R08 | The system will import/export BOMs (CSV and PLM connector) preserving hierarchy, references, and revisions | P2 |

#### 8.1.2 Acceptance Criteria

- A user can build a ≥3-level BOM (e.g. Top Assembly → Power Module → IGBT Bridge) and each level renders with PN, qty, UoM, supplier, rev, status
- Expanding a parent reveals children; collapsing hides them; state persists during the session
- Filtering by `status = pending` returns only pending parts across all levels
- Opening a part shows its requirement links and a where-used list of every assembly it belongs to

**Error & edge states:**
- An empty BOM shows a first-action empty state ("No parts yet — add the top assembly")
- A part referenced in multiple assemblies appears once in the register with multiple where-used paths — never duplicated
- A circular parent/child reference is rejected at save with a clear message
- A part with no supplier renders "—"; internal parts are labeled `Internal`

**Performance:**
- A 500-line BOM renders the collapsed root in < 1s and expands a node in < 150ms
- BOM data is tenant-isolated; a user cannot read parts from a workspace they lack access to

#### 8.1.3 Edge Cases

| Scenario | Trigger | System Behaviour |
|---|---|---|
| Shared sub-component | Same part under two assemblies | Single register entry, multiple where-used paths; quantity rolled per parent |
| Pending child under approved parent | Mixed-status subtree | Parent shows roll-up indicator that descendants are not fully approved |
| Deep nesting | 4+ levels | Tree virtualizes; indentation and level badges stay legible |
| Import collision | Imported PN already exists at a different rev | Flag conflict; require resolve (keep / new rev / merge) before commit |

#### 8.1.4 Business Rules

- **BR-001-01:** A part's released revision may only change through an approved ECO — never by in-place edit
- **BR-001-02:** Part numbers are unique within a workspace; revision is a property of the part, not a new PN
- **BR-001-03:** Quantity is expressed per immediate parent; effective quantity is computed up the tree

#### 8.1.5 Audit & Logging

| Event | Level | Captured | Retention |
|---|---|---|---|
| Part created / edited | INFO | actor, PN, fields changed, timestamp | 12 months |
| Revision changed (via ECO) | AUDIT | actor, PN, rev from→to, ECO id | 7 years |
| BOM import/export | INFO | actor, source, line count, conflicts | 12 months |

---

### F-002: Engineering Change Management (ECR → ECO → ECN) — P0

A controlled change lifecycle: a request is raised, a solution is developed, the ECO runs an approval pipeline scaled by change class, then an ECN releases it with an effectivity cut-in and dispositions.

**Status:** In Development | **Stories:** US-023–025 | **Owner:** Change & Quality

**Lifecycle & Vocabulary:**
- **Statuses:** Draft → In Review → Rework → Approved → Released → Verified → Closed | On Hold
- **Change classes:** I (Safety/Regulatory) · II (Form-Fit-Function) · III (Documentation)
- **Dispositions:** Use As-Is · Rework · Scrap · Return to Supplier · Use Up Then Change
- **Effectivity:** Date · Serial-number break · Lot break

#### 8.2.1 Functional Requirements

| REQ | Requirement | P |
|---|---|---|
| F-002-R01 | The system must let an originator create an ECO (optionally from an ECR), classify it (type, reason, change class I/II/III, priority), and attach affected parts and documents | P0 |
| F-002-R02 | The system must route the ECO through an ordered approval pipeline (Originator → Engineering → QA → Final Approval) where each step is an assigned approver who can approve or reject with a recorded reason | P0 |
| F-002-R03 | The system must scale pipeline rigor by change class — Class I requires QA + final sign-off; lower classes may waive steps with a recorded justification | P0 |
| F-002-R04 | On rejection the system must set status `Rework` and return artifacts to the originator, resetting the pipeline; the rejection reason is retained in history | P0 |
| F-002-R05 | On full approval the system shall generate an ECN with a distribution list and a defined effectivity cut-in, transitioning the ECO to `Released` | P1 |
| F-002-R06 | The system shall capture a per-parameter change diff (from → to) and per-part dispositions with affected quantities | P1 |
| F-002-R07 | The system shall record schedule/cost/recertification/firmware impact and link affected milestones & modules | P1 |
| F-002-R08 | The system shall generate ECN implementation tasks (assignee, due date) and mark the change `Verified` then `Closed` when the cut-in is confirmed | P1 |
| F-002-R09 | The system must maintain an append-only activity history of every state change, decision, field edit, and comment | P0 |

#### 8.2.2 Acceptance Criteria

**Happy path:**
- An originator creates ECO-2026-047, classifies it Class II, attaches 6 affected parts, and submits — status moves Draft → In Review and the pipeline shows the active step
- Each approver sees only their step as actionable; approving advances to the next; the final approval flips status to Approved
- Approval generates an ECN with a distribution list, effectivity date, and implementation tasks; status becomes Released
- Confirming the cut-in moves the change to Verified, then Closed; affected part revisions advance (Rev A → B)

**Error / rework / edge:**
- A QA rejection ("salt-spray data missing") sets status Rework, returns artifacts to the originator with reason; resubmission restarts the pipeline
- A Class I change cannot reach Approved with the QA step waived — the waiver control is disabled and blocked server-side
- A released ECO/ECN is immutable — edits are blocked; a correction requires a new ECO

**Security:**
- Only the assigned approver (or an Admin) can act on a pipeline step; attempts by others are rejected and logged
- Final Approval requires VP-Engineering authority

#### 8.2.3 Edge Cases

| Scenario | Trigger | System Behaviour |
|---|---|---|
| Rework bounce | Approver rejects mid-pipeline | Status→Rework, pipeline resets to originator, reason appended to history |
| Optional step waiver | Low-risk FFF change | Step marked optional with a required justification; recorded on the ECO |
| Effectivity not a date | Serial/lot break needed | Effectivity supports From S/N and From Lot, not only calendar date |
| Cross-impact | Change forces firmware retarget | Firmware-impact flag set; dependent firmware tasks/issues linked |
| Concurrent decisions | Two approvers act at once | Step decision is atomic; later write sees resolved state, no double-advance |

#### 8.2.4 Business Rules

- **BR-002-01:** A solution is developed before approval — the only review-again loop is the pre-approval Reject → Rework bounce
- **BR-002-02:** Change class governs mandatory pipeline steps; Class I steps cannot be waived
- **BR-002-03:** An ECN exists only for an Approved ECO and is the artifact that authorizes manufacturing cut-in
- **BR-002-04:** History is append-only; no event may be edited or deleted

#### 8.2.5 Audit & Logging

| Event | Level | Captured | Retention |
|---|---|---|---|
| ECO created / submitted | INFO | actor, eco id, ecr, class, parts | 7 years |
| Approve / reject decision | AUDIT | actor, step, decision, reason, timestamp | 7 years |
| ECN released | AUDIT | ecn id, distribution, effectivity | 7 years |
| Verified / Closed | AUDIT | actor, cut-in confirmation, rev changes | 7 years |

---

### F-003: Milestones & Phase-Gate Reviews — P0

A program timeline of phases and gates (Concept → PDR → CDR → MRR → Pilot → Mass Production) with per-gate owner, due date, percent-complete, task count, and open-issue rollup.

**Stories:** US-030–031 | **Owner:** Program Management

#### 8.3.1 Functional Requirements

| REQ | Requirement | P |
|---|---|---|
| F-003-R01 | The system must render a Gantt-style program timeline of phases with a "today" marker and a gate diamond at each phase boundary | P0 |
| F-003-R02 | The system must track gate status (Completed / In Progress / Upcoming) with owner, due date, and percent-complete | P0 |
| F-003-R03 | The system shall roll up each gate's task count and open-issue count from linked tasks/issues — not manual entry | P1 |
| F-003-R04 | The system shall open a gate detail with exit criteria and a readiness summary, and support gate sign-off by an authorized owner | P1 |
| F-003-R05 | The system will export a gate package (status, criteria, issues) to PDF/CSV | P2 |

#### 8.3.2 Acceptance Criteria

- The timeline shows 6 phases with the active phase highlighted and "Days to Gate N" computed from due date
- A gate's open-issue count matches the live issue register; closing an issue decrements it without a refresh
- Gate summary cards (Gates Complete, Current Phase, Days to Gate, Open Issues) reflect live program state
- A gate cannot be signed off by a user without gate authority; the action is blocked and logged

#### 8.3.3 Edge Cases

| Scenario | Behaviour |
|---|---|
| Unassigned future gate (owner TBD) | Renders "TBD"; excluded from "days to gate" urgency math |
| Gate with open critical issues at due date | Readiness flagged not-ready; sign-off requires explicit override + reason |
| Percent-complete with zero tasks | Shows 0% with "no tasks linked" hint, not a divide error |

#### 8.3.4 Business Rules & Audit

- **BR-003-01:** Gate readiness is computed from linked tasks & open issues; it is never typed in
- **BR-003-02:** Gate sign-off is an AUDIT event (actor, gate, decision, override reason) retained 7 years

---

### F-004: Risk & Issue Register — P1

A 5×5 probability×impact heatmap and register: each risk scored (prob × impact), categorized, owned, and tracked through Open → Monitoring → Mitigated.

**Stories:** US-032 | **Owner:** Program Management

#### 8.4.1 Functional Requirements

| REQ | Requirement | P |
|---|---|---|
| F-004-R01 | The system shall store risks with probability (1–5), impact (1–5), computed score, owner, category, status, and description | P1 |
| F-004-R02 | The system shall render a 5×5 heatmap (probability × impact) with risk dots placed by cell and severity color bands | P1 |
| F-004-R03 | The system shall present a sortable register (by score) with status badges and summary counts (Total, Critical, Mitigated, Open) | P1 |
| F-004-R04 | Categories shall include at least: Supply Chain, Regulatory, Cost, Safety, Software, Quality, Schedule, Hardware | P1 |
| F-004-R05 | The system will let a risk be linked to the milestone/gate or part it threatens | P2 |

#### 8.4.2 Acceptance Criteria

- Score = probability × impact; severity color matches the band (≥20 red, 10–19 amber, 5–9 blue, <5 green)
- A risk at prob 5 × impact 5 lands in the top-right cell and counts toward "Critical"
- Changing status to Mitigated updates summary counts and the dot styling

#### 8.4.3 Business Rules

- **BR-004-01:** Score is always derived (prob × impact), never hand-entered
- **BR-004-02:** Unowned risks are allowed but flagged; "unowned risk" surfaced in summary

---

### F-005: Tasks — Kanban, Dependencies & Detail — P0

The execution layer: tasks with canonical status, priority, hardware module type, dependencies, assignees, checklists, and linked issues.

**Stories:** US-010–013 | **Owner:** Core App

#### 8.5.1 Functional Requirements

| REQ | Requirement | P |
|---|---|---|
| F-005-R01 | The system must support task statuses `To Do · In Progress · Review · Done · Blocked` and priorities `Critical · High · Medium · Low` (canonical — no synonyms) | P0 |
| F-005-R02 | The system must provide a drag-and-drop Kanban board (status columns) and an equivalent list view | P0 |
| F-005-R03 | The system must support dependencies — a task blocked by one or more others — and surface block state on the card | P0 |
| F-005-R04 | A task shall carry a hardware module type, assignees, checklist, and linked issues | P1 |
| F-005-R05 | The system shall open a task detail modal showing all fields, dependencies, checklist progress, and activity | P1 |

#### 8.5.2 Acceptance Criteria

- Dragging a card to "In Progress" persists status and is reflected in list view and counts
- A task whose blocker is open shows a Blocked indicator and a dependency tooltip
- Completing all checklist items advances checklist progress indicator
- Dragging a Kanban card adds a subtle lift (shadow); reduced-motion users see no animation

#### 8.5.3 Edge Cases & Business Rules

| Scenario | Behaviour |
|---|---|
| Circular dependency | Rejected at save with explanation |
| Move to Done while blocked | Warn; require unblock or explicit override |
| Assignee removed from project | Task flagged unassigned; not silently orphaned |

- **BR-005-01:** Status/priority/module vocabularies are fixed enumerations; custom values are not allowed at v1

---

### F-006: Reports — P2

KPI cards plus a module bar chart and task-distribution view over live project data, with export.

- Charts match underlying counts; export reflects current filters
- Audit: export logged (actor, scope)

---

### F-007: Authentication, Roles & Audit Log — P0

See **Section 10** for the complete authentication specification. Summary:

- OAuth/OIDC (Google) and SSO/SAML (enterprise); JWT with refresh rotation; optional MFA (enterprise)
- Server-side RBAC per §4.3; tenant isolation enforced on every query
- Append-only audit log; every destructive/approval action appears in audit export
- Security events retained 12 months; change/gate/access AUDIT events retained 7 years

---

### F-008: Dashboard & Workspace Shell — P1

- Org switcher, collapsible sidebar, frosted header, global search
- Dashboard of active projects, upcoming milestones, and issues needing attention
- Switching org swaps all scoped data; dashboard reflects live counts
- Empty states show one headline + one sentence + one action
- Light/dark theme with functional colors identical across both

---

### F-009: Real-Time Chat — P1

In-context team communication via Socket.IO.

| REQ | Requirement |
|---|---|
| F-009-R01 | The system must support direct messages (DMs) between any two workspace members |
| F-009-R02 | The system must support group conversations linked to projects |
| F-009-R03 | The system shall show typing indicators and online/offline presence for workspace members |
| F-009-R04 | The system shall support file messages (images, attachments) |
| F-009-R05 | The system shall display unread message counts and mark-as-read on open |

---

### F-010: AI Task Generation — P1

Claude-powered milestone decomposition via BullMQ queue.

| REQ | Requirement |
|---|---|
| F-010-R01 | The system must allow a PM/Engineer to trigger AI task generation for a milestone |
| F-010-R02 | The system must queue generation jobs asynchronously (BullMQ) so the HTTP response is immediate |
| F-010-R03 | The system must validate Claude's JSON response against a Zod schema before any DB write |
| F-010-R04 | The system must deduplicate generation requests per milestone (BullMQ jobId deduplication) |
| F-010-R05 | The system must notify the requesting user via in-app notification when generation completes |
| F-010-R06 | Generated tasks must be reviewable/editable before being treated as authoritative |

---

## 9. User Flows

### UF-001: Raise & Release an Engineering Change (ECO)

**Actors:** Originator (Engineer), Approvers (Eng/QA/VP), System
**Pre:** Part exists in a BOM
**Post:** Change released via ECN with effectivity cut-in
**Related:** F-002, F-001, F-003

```
1. Originator opens a part / ECR and creates an ECO
   → System: Draft created; pre-fills affected part, suggests change class

2. Originator classifies (type, reason, class I/II/III), adds affected parts,
   change diff, documents, and submits
   → Validation fail (no affected parts / missing class): inline errors, not submitted
   → Pass → status In Review; pipeline activated

3. Engineering review
   → Approve → advance to next step
   → Reject → status Rework, artifacts returned to originator with reason; pipeline resets

4. QA review (mandatory for Class I; waivable with justification for lower classes)
   → Approve → advance
   → Reject (e.g. "salt-spray data missing") → Rework bounce

5. Final Approval (VP-Engineering authority)
   → Approve → status Approved

6. System generates ECN
   → Distribution list set, effectivity cut-in defined (date / serial / lot)
   → Implementation tasks created; status Released

7. Team executes ECN tasks; cut-in confirmed
   → Status Verified → affected part revisions advance

8. Status Closed; full append-only history retained for audit
```

**Critical failure states:** rework bounce (steps 3–4), waiver attempted on a Class I step (blocked server-side), concurrent approver decisions (atomic resolution).

---

### UF-002: Prepare & Run a Phase-Gate Review

**Actors:** PM, Gate owner, System
**Pre:** Project has phases & linked tasks/issues
**Post:** Gate signed off or returned
**Related:** F-003, F-005, F-004

```
1. PM opens the Phase Gate Tracker
   → System: timeline with today marker, gate diamonds, summary cards
     (Gates Complete, Current Phase, Days to Gate, Open Issues)

2. PM opens the active gate (e.g. Gate 3 — MRR)
   → System rolls up percent-complete, task count, and open issues live from linked records

3. PM reviews exit criteria & open critical issues
   → Open critical issues at due date → readiness flagged not-ready

4. Gate owner signs off
   → Not-ready → sign-off requires explicit override + reason (audit-logged)
   → Ready → gate marked Completed; program advances to next phase
```

---

### UF-003: Build a BOM & Trace Change Impact

**Actors:** Engineer, System | **Related:** F-001, F-002

```
1. Engineer adds top assembly, then nests modules and components (PN, qty, UoM, supplier, rev, status)
   → System builds multi-level tree; internal vs. sourced parts labeled

2. Engineer links parts to requirement IDs
   → Requirement coverage shown on part detail

3. Engineer opens a part to see where-used
   → System lists every parent path & top assembly — the change blast radius

4. Engineer raises an ECO from the part
   → Flow continues into UF-001 with affected parts pre-populated
```

---

### UF-004: User Registration & Email Verification

```
1. User visits /signup, enters name, email, password, and optionally org name
2. System creates account (password bcrypt-hashed, 12 rounds)
3. System sends 6-digit OTP to email (expires 10 minutes)
4. User enters OTP at /verify-email
5. System marks email verified, issues JWT access token (in-memory) + refresh token (httpOnly cookie)
6. User lands on dashboard
```

**Error states:**
- Invalid OTP → "Invalid verification code" (OTP not revealed)
- Expired OTP → "Code has expired — request a new one" + resend link
- Duplicate email → "Email already registered" (no account state revealed)
- Unverified login attempt → new OTP auto-sent; user redirected to verify-email with email pre-filled

---

### UF-005: Token Refresh Flow

```
1. Frontend Axios interceptor detects 401 response
2. Checks: is this a refresh/login/auth endpoint? → if yes, redirect to login
3. If multiple parallel requests 401 → queue them; only one refresh call goes out
4. POST /auth/refresh sends httpOnly cookie automatically (sameSite: none, secure: true in production)
5. Backend validates refresh token hash, rotates (revokes old, issues new), returns new access token
6. Frontend updates in-memory token, replays all queued requests with new token
7. If refresh fails → clear tokens, redirect to /login
```

---

## 10. Authentication & Authorization

### 10.1 Authentication Mechanism

| Aspect | Implementation |
|---|---|
| **Primary auth** | Email/password with bcrypt (12 rounds) |
| **Email verification** | 6-digit OTP, SHA-256 hashed in DB, 10-minute TTL |
| **Access token** | JWT signed with `JWT_SECRET` (≥32 chars), 15-minute TTL, stored **in-memory only** (never localStorage) |
| **Refresh token** | 48-byte cryptographically secure random token, bcrypt-hashed in DB, 7-day TTL |
| **Refresh cookie** | httpOnly, `sameSite: none`, `secure: true` in production; `sameSite: lax`, `secure: false` in dev |
| **Token rotation** | Refresh token rotated on every use; old token revoked immediately |
| **Session revocation** | All sessions revoked on password change; single session revoked on logout |
| **Future: SSO/SAML** | OAuth/OIDC (Google), SAML for enterprise; provisions on first login |
| **Future: MFA** | TOTP-based MFA for enterprise tier |

### 10.2 Auth Flow Details

**Register:**
1. `POST /auth/register` — creates user + profile + optionally org; sends OTP email
2. Returns `{ message, email }` — no tokens until email verified

**Login:**
1. `POST /auth/login` — validates password; if unverified, auto-sends new OTP, returns `EMAIL_NOT_VERIFIED`
2. On success: access token in response body; refresh token in httpOnly cookie

**OTP Verify:**
1. `POST /auth/verify-otp` — validates OTP, marks email verified, issues tokens
2. Rate-limited: `authRateLimiter` (30/15min) + `sensitiveActionLimiter` (5/hour)

**Forgot Password:**
1. `POST /auth/forgot-password` — always returns 200 (anti-enumeration)
2. Generates SHA-256-hashed reset token, sends email link, 1-hour TTL

**Reset Password:**
1. `POST /auth/reset-password` — validates token, sets new password, revokes all sessions

**Refresh:**
1. `POST /auth/refresh` — reads refresh token from httpOnly cookie, rotates token pair

**Logout:**
1. `POST /auth/logout` — revokes current refresh token, clears cookie

### 10.3 Authorization — RBAC Enforcement

**Middleware chain per route:**
```
Request → authenticate() → resolveOrgMembership() → requireOrgRole('member') → handler
```

- `authenticate()` — verifies JWT, single DB query (`SELECT id, email, deleted_at`), attaches `req.user`
- `resolveOrgMembership()` — looks up org membership from route param, attaches `req.orgMember`
- `requireOrgRole(minRole)` — compares `req.orgMember.role` against ROLE_HIERARCHY
- `requireProjectRole(minRole)` — same but for project-level membership (`req.projectMember`)
- `requireOwnership(getOwnerId)` — verifies resource belongs to requesting user; Admin bypasses

**ROLE_HIERARCHY:** `viewer(0) < member(1) < manager(2) < admin(3)`

### 10.4 Rate Limiting

| Limiter | Endpoints | Limit |
|---|---|---|
| `apiRateLimiter` | All `/api/*` routes | 100 req / 15 min per IP |
| `authRateLimiter` | `/auth/login`, `/auth/register`, `/auth/send-otp`, `/auth/verify-otp` | 30 req / 15 min per IP |
| `sensitiveActionLimiter` | `/auth/forgot-password`, `/auth/reset-password`, `/auth/send-otp`, `/auth/verify-otp` | 5 req / hour per IP |

### 10.5 Audit Logging

Every security-relevant action writes an immutable audit record:

| Event | Level | Retention |
|---|---|---|
| Login / logout | INFO | 12 months |
| Failed login attempts | WARN | 12 months |
| Password change / reset | AUDIT | 12 months |
| Permission denied | WARN | 12 months |
| ECO approve / reject | AUDIT | 7 years |
| Gate sign-off | AUDIT | 7 years |
| Member added / removed | AUDIT | 7 years |
| Destructive actions (delete project, etc.) | AUDIT | 7 years |

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Requirement | Target | Method |
|---|---|---|
| Initial app load | < 2.0s | Lighthouse / RUM |
| API response p50 / p95 | < 200ms / < 500ms | APM (Sentry) |
| 500-line BOM render (collapsed root) | < 1.0s | Synthetic test |
| Kanban drag persist | < 250ms perceived | Optimistic UI |
| Uptime SLA | 99.9% | Uptime monitor |
| RTO / RPO | < 1h / < 15min | DR & backup testing |

### 11.2 Security

| Requirement | Standard / Implementation |
|---|---|
| Authentication | Email/password + OTP; JWT in-memory; httpOnly refresh cookie; SAML SSO (enterprise) |
| Authorization | Server-side RBAC; tenant isolation enforced on every DB query |
| Data in transit | TLS 1.2+ everywhere |
| Data at rest | AES-256 for customer design data & PII |
| Input handling | Server-side Zod validation on all endpoints; ORM parameterized queries; output encoding + CSP |
| Rate limiting | Auth/sensitive endpoints rate-limited (§10.4) |
| Secrets management | All secrets in environment variables (never in code); validated at startup via Zod |
| Immutability | Released ECO/ECN and audit log are append-only / immutable |
| Supply-chain security | Automated CVE scanning in CI; OWASP Top 10 mitigations |
| Cookie security | httpOnly, `sameSite: none` + `secure: true` in production for cross-origin Vercel→Railway |
| Error responses | Stack traces never sent to client in production; generic 500 message only |
| Prompt injection | AI worker: user content wrapped in XML delimiters before Claude prompt interpolation |

### 11.3 Accessibility

| Standard | Requirement |
|---|---|
| WCAG 2.1 AA | All user-facing screens; keyboard-operable; visible focus ring (2px + offset) |
| Color is not the only signal | Status/priority carry a label or icon in addition to color |
| Contrast | ≥ 4.5:1 normal text, ≥ 3:1 large text — verified in light & dark |
| Motion | `prefers-reduced-motion` honored (no Kanban rotate, no entrance transforms) |

### 11.4 Browser Compatibility

| Dimension | Requirement |
|---|---|
| Desktop browsers | Chrome, Firefox, Safari, Edge — latest 2 major versions |
| Minimum viewport | Optimized ≥ 1280px; usable to 1024px; mobile read-only is v2 |
| Offline / i18n / RTL | None / English-only / not required at v1 |

### 11.5 Compliance & Legal

**GDPR:**

| Requirement | Implementation |
|---|---|
| Lawful basis & privacy policy at signup | Consent + linked policy |
| Right to access / erasure | Export + account deletion (hard delete ≤ 30 days; audit log retained per legal basis) |
| Breach notification (72h) | Incident-response process |

**Other Regimes:**

| Regime | Status | Note |
|---|---|---|
| Export control (ITAR/EAR) | TBD — flagged | Customer BOMs may be controlled technical data; tenant isolation, access control, US-person handling under review (Q-02) |
| SOC 2 Type II | Future | Required to close enterprise deals |
| ISO 27001 | Future | Follows SOC 2 |
| PCI-DSS | N/A | No cardholder data; billing via Stripe (SAQ-A) |
| HIPAA | N/A | No PHI collected |

**Data Retention:**

| Data Type | Retention | Basis |
|---|---|---|
| User account data | Active + ≤ 30 days post-deletion | GDPR Art. 17 |
| Change / gate / access AUDIT events | 7 years | Quality & audit obligation |
| Operational logs | 90 days | Legitimate interest |
| Customer design data (BOM/ECO) | Life of contract + agreed wind-down | Contract / DPA |

---

## 12. Integrations

### 12.1 Integration Map

| Integration | Purpose | Direction | Required | Failure Impact |
|---|---|---|---|---|
| Email (Resend) | Invites, OTP, notifications, digests | Outbound | Required | High |
| Object storage (S3-compatible) | Attachments, drawings, exports | Outbound | Required | High |
| AI (Anthropic Claude) | Milestone task generation | Outbound | Required | Medium |
| Redis (Railway) | Queue, Socket.IO adapter, rate-limit store | Internal | Required | Critical |
| Identity (Google OAuth / SAML) | Authentication | Inbound | Future | Critical |
| Component data (Octopart/distributor) | Lead time, price, lifecycle/EOL | Inbound | Optional | Medium |
| PLM / PDM (Arena, Windchill, Duro) | BOM import/export, doc links | Bi-directional | Optional | Medium |
| ERP (NetSuite, SAP) | Part master, on-hand, POs (signals) | Inbound | Optional | Low |
| Notifications (Slack / Teams) | Approvals, mentions, gate alerts | Outbound | Optional | Low |
| Billing (Stripe) | Subscription & seats | Outbound + webhook | Required | High |
| Observability (Sentry) | Errors, APM, performance | Outbound | Required | Low |

### 12.2 Integration Detail — PLM / PDM (BOM Sync)

| Trigger | Action | Failure Handling |
|---|---|---|
| Import BOM | Map hierarchy, PN, rev, supplier, refs into the tree | Conflicts queued for manual resolve; partial import never silently overwrites |
| Released ECN | Optionally push rev change back to PLM | Retry w/ exponential backoff (3×); failures to dead-letter queue; idempotent by ECN id |

### 12.3 S3 Storage Configuration

Required environment variables (server refuses to start without these in production):

```
S3_ENDPOINT      # Provider endpoint (Cloudflare R2, AWS S3, etc.)
S3_REGION        # 'auto' for R2, region code for AWS
S3_BUCKET        # Bucket name (must exist)
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
```

---

## 13. Data Requirements

### 13.1 Core Entities

| Entity | Key Attributes | Relationships | PII |
|---|---|---|---|
| Organization (tenant) | id, name, plan, settings, slug | has many Users, Projects | No |
| User | id, name, email, role, status, passwordHash | belongs to Org; assigned Tasks/ECOs | Yes |
| Profile | userId, name, avatarUrl, initials, jobTitle, timezone | 1:1 with User | Yes |
| Project | id, name, stage, status, progress, startDate, targetDate | has Modules, Milestones, Tasks, Issues, BOM, ECOs, Risks | No |
| Module (Hardware) | id, type (hw/sw/fw/test/pcb/enclosure/...), name | belongs to Project; groups Tasks/Parts | No |
| Milestone / Gate | id, phase, gate, owner, dueDate, progress, status | rolls up Tasks & Issues | No |
| Task | id, status, priority, moduleId, blockedBy[], checklist | belongs to Project; links Issues; has Assignees | No |
| Issue / Risk | id, category, severity, prob, impact, score, status, owner | blocks Tasks/Milestones; links Parts | No |
| Part (BOM item) | pn, description, qty, uom, supplier, rev, status, req[] | tree parent/child; where-used; affected by ECOs | No |
| ECO / ECN | id, type, class, status, effectivity, dispositions[], diff[] | affects Parts; pipeline of Approvers; ECN tasks | No |
| Conversation | id, type (DM/group), members | has Messages | No |
| Message | id, content, senderId, conversationId | belongs to Conversation | No |
| Activity / Audit event | actor, action, target, timestamp, payload | append-only; references any entity | Actor only |
| Notification | userId, type, title, content, actionUrl, readAt | belongs to User | No |
| OTP | email, codeHash, expiresAt, usedAt | belongs to User | Hashed only |
| RefreshToken | userId, tokenHash, userAgent, ipAddress, expiresAt, revokedAt | belongs to User | No |

### 13.2 Data Classification

| Data | Classification | Handling |
|---|---|---|
| Email / name | PII | Encrypted at rest; never logged in plaintext |
| BOM / ECO / design data | Confidential — customer IP (possibly export-controlled) | Tenant-isolated, encrypted, access-controlled |
| Audit events | Restricted | Immutable, retained 7 yrs, export gated to Admin/Compliance |
| Passwords | Secret | bcrypt (12 rounds); never stored or logged in plaintext |
| Tokens (refresh) | Secret | bcrypt-hashed in DB; plain value never persisted |
| Usage analytics | Anonymized / aggregated | No individual tracking of design content |

### 13.3 Data Flow

```
[Browser]
  → HTTPS (TLS 1.2+)
  → [Railway — Express API + Socket.IO]
      → [PostgreSQL — tenant-isolated, encrypted: projects, BOM, ECO, audit]
      → [Redis — queue, Socket.IO pub/sub, rate-limit counters]
      → [S3 — attachments/drawings, encrypted, private]
  ← [BullMQ Workers]
      → [Anthropic Claude API — AI task generation]
      → [Resend — email notifications]
  [PLM/ERP/Distributor] ⇄ [Sync workers — idempotent, dead-letter on fail]
  [Stripe] → webhook → [Billing]
```

### 13.4 Backup & Recovery

| Requirement | Specification |
|---|---|
| DB backup frequency | ≤ 6 hours; PITR up to 7 days |
| Backup encryption / region | AES-256, stored cross-region |
| Recovery test cadence | Monthly; RTO < 1h, RPO < 15min |

---

## 14. Tech Stack & Architecture

### 14.1 Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18.3.x | UI library |
| TypeScript | 5.8.x | Type safety |
| Vite | 5.4.x | Build tool & dev server |
| React Router DOM | 6.30.x | Client-side routing (lazy-loaded) |
| Tailwind CSS | 3.4.x | Utility-first CSS |
| shadcn/ui (Radix UI) | Latest | Accessible component primitives |
| Lucide React | 0.462.x | Icon library |
| TanStack React Query | 5.x | Server state & caching |
| Zustand | 5.x | Global UI state |
| React Hook Form + Zod | 7.x / 3.x | Forms & validation |
| Recharts | 2.x | Charts and graphs |
| @hello-pangea/dnd | 18.x | Drag and drop (Kanban) |
| @tanstack/react-virtual | 3.x | Virtual scrolling (1000+ items) |
| Axios | 1.x | HTTP client with interceptors |
| Socket.IO Client | 4.x | Real-time chat & presence |
| date-fns | 3.x | Date manipulation |
| Sentry | Latest | Frontend error tracking |

### 14.2 Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js + Express | 18.x / 4.x | HTTP server |
| TypeScript | 5.x | Type safety |
| Drizzle ORM | Latest | Type-safe PostgreSQL queries |
| PostgreSQL | 15+ | Primary database (Railway) |
| Redis | 7+ | Queue, Socket.IO adapter, rate limiting (Railway) |
| Socket.IO | 4.x | Real-time WebSocket layer |
| BullMQ | 5.x | Job queues (email, AI) |
| Anthropic SDK | Latest | Claude AI integration |
| Resend | Latest | Transactional email |
| AWS SDK v3 (S3) | Latest | Object storage |
| bcryptjs | Latest | Password & token hashing |
| jsonwebtoken | Latest | JWT signing & verification |
| Zod | 3.x | Schema validation (config + API inputs + AI responses) |
| Helmet | Latest | Security headers |
| express-rate-limit | Latest | Rate limiting |
| Sentry | Latest | Backend error tracking & APM |
| Swagger UI | Latest | API documentation at /api-docs |

### 14.3 Deployment & Infrastructure

| Service | Provider | Notes |
|---|---|---|
| Frontend | Vercel | Auto-deploys from `version4` branch |
| Backend | Railway | Docker-based; PostgreSQL + Redis also on Railway |
| Object Storage | S3-compatible (Cloudflare R2 or AWS S3) | Attachments, avatars, exports |
| Email | Resend | Transactional; domain must be verified |
| Error Monitoring | Sentry | Both frontend and backend |
| CI/CD | GitHub Actions | Lint, type-check, test on every push |

### 14.4 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────────┐  │
│  │  Features   │  │  Components │  │  Layout (Header/       │  │
│  │  (Pages)    │  │  (Shared)   │  │  Sidebar/Shell)        │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬───────────┘  │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     State Layer                                  │
│  ┌─────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │   Zustand   │  │  React Query    │  │   Local State    │   │
│  │  (UI State) │  │  (Server Cache) │  │   (useState)     │   │
│  └──────┬──────┘  └────────┬────────┘  └──────────────────┘   │
└─────────┼──────────────────┼───────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Service Layer                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  ApiClient  │  │  *.service.ts│  │  Socket.IO Transport  │  │
│  │  (Axios +   │  │  (Business   │  │  (Real-time Chat)    │  │
│  │  interceptor)│  │  Logic)      │  │                      │  │
│  └──────┬──────┘  └──────┬───────┘  └──────────────────────┘  │
└─────────┼────────────────┼───────────────────────────────────── ┘
          │                │
          ▼ HTTPS/WSS      ▼
┌─────────────────────────────────────────────────────────────────┐
│               Backend (Express + Railway)                        │
│  Routes → Middleware → Controllers → Services → Repositories     │
│  Auth: JWT + httpOnly cookie (sameSite: none in production)      │
│  RBAC: org-level + project-level role enforcement                │
│  ┌────────┐  ┌─────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Drizzle│  │  Redis  │  │  BullMQ  │  │   Socket.IO      │  │
│  │  (PG)  │  │  Cache  │  │  Workers │  │   (Redis adapter)│  │
│  └────────┘  └─────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 14.5 Navigation & Route Structure

```
Sidebar Navigation:
├── Main
│   ├── My Day           /my-day
│   ├── Dashboard        /
│   └── Projects         /projects
│       ├── [Project]    /projects/:id
│       │   ├── Tasks    (tab)
│       │   ├── Modules  (tab)
│       │   ├── Milestones (tab)
│       │   └── Issues   (tab)
│       ├── New Project  /projects/new
│       └── Issue Detail /projects/:projectId/issues/:issueId
├── Hardware
│   ├── BOM              /bom (or /projects/:id?section=bom)
│   ├── Eng. Changes     /engineering-changes
│   ├── Gate Reviews     /gate-reviews
│   └── Risk & Issues    /risks
├── Cross-Functional
│   ├── Calendar         /calendar
│   ├── Reports          /reports
│   └── Chat             /chat, /chat/:conversationId
└── Organization
    ├── Team             /team
    └── Settings         /settings
```

---

## 15. API & Services Layer

### 15.1 API Structure

All routes are served at `/api/v1/*`. Base URL configured via `VITE_API_BASE_URL`.

### 15.2 Endpoint Catalogue

```
AUTH           POST /auth/register, /login, /logout, /refresh
               POST /auth/forgot-password, /reset-password, /change-password
               POST /auth/send-otp, /verify-otp
               GET  /auth/me

USERS          GET  /users/me, /users/search, /users/:id
               GET  /users/:id/organizations

ORGANIZATIONS  GET/POST /organizations
               GET/PATCH/DELETE /organizations/:id
               GET/POST /organizations/:orgId/members
               PATCH/DELETE /organizations/:orgId/members/:userId/role
               POST /organizations/:orgId/invitations
               GET  /organizations/:orgId/activities
               GET  /organizations/:orgId/reports/overview
               GET  /organizations/:orgId/tasks (all tasks, cross-project)
               GET  /organizations/:orgId/issues (all issues, cross-project)

PROJECTS       GET/POST /organizations/:orgId/projects
               GET/PATCH/DELETE /projects/:id
               GET/POST /projects/:id/members
               GET  /projects/:id/team, /activities, /links
               GET  /projects/:id/reports/* (overview, velocity, burndown, team-workload)

TASKS          GET/POST /projects/:projectId/tasks
               GET/PATCH/DELETE /tasks/:id
               PATCH /tasks/:id/status
               POST/DELETE /tasks/:id/assignees/:userId
               POST/DELETE /tasks/:id/dependencies/:depId
               GET/POST /tasks/:id/comments
               GET  /tasks/me/all

HARDWARE       GET/POST /projects/:projectId/hardware-modules
MODULES        GET/PATCH/DELETE /hardware-modules/:id

MILESTONES     GET/POST /projects/:projectId/milestones
               GET/PATCH/DELETE /milestones/:id
               POST /milestones/:id/complete
               POST/DELETE /milestones/:id/tasks/:taskId
               POST /milestones/:id/generate-tasks  ← AI endpoint

ISSUES         GET/POST /projects/:projectId/issues
               GET/PATCH/DELETE /issues/:id
               PATCH /issues/:id/status
               POST/DELETE /issues/:id/assignees/:userId
               POST/DELETE /issues/:id/task-links/:taskId
               GET/POST /issues/:id/comments

BOM            GET/POST /projects/:projectId/bom
               GET /projects/:projectId/bom/summary
               GET /projects/:projectId/bom/export
               GET/PATCH/DELETE /bom/:id

NOTIFICATIONS  GET /notifications, /notifications/count
               POST /notifications/read-all
               PATCH /notifications/:id/read
               DELETE /notifications/:id

CHAT           GET/POST /conversations
               GET/PATCH /conversations/:id
               GET/POST /conversations/:id/messages
               POST /conversations/:id/messages/file
               POST /conversations/:id/read
               GET/POST/DELETE /conversations/:id/members/:userId

REPORTS        GET /organizations/:orgId/reports/overview
               GET /projects/:id/reports/velocity, /burndown, /task-distribution, /team-workload

UPLOADS        POST /uploads/avatar
               POST /uploads/attachments
               DELETE /uploads/attachments/:id
               GET /uploads/attachments/:entityType/:entityId
```

### 15.3 API Client (Frontend)

- **Axios instance** with `baseURL`, 15s timeout, `withCredentials: true` (sends cookies cross-origin)
- **Request interceptor:** Attaches `Authorization: Bearer {accessToken}` from memory
- **Response interceptor (401 handling):**
  - Queues all parallel failing requests
  - Sends single `POST /auth/refresh` (cookie-based, no body)
  - On success: retries all queued requests with new token
  - On failure: clears tokens, redirects to `/login`
- **Error extraction:** Parses `error.details[0].message` → `error.message` → `error` → generic fallback

### 15.4 Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "UNPROCESSABLE",
    "message": "Validation failed",
    "details": [{ "field": "email", "message": "Invalid email address" }]
  },
  "requestId": "req_abc123"
}
```

### 15.5 Error Handling Policy

| Scenario | HTTP Status | Code |
|---|---|---|
| Validation failure (Zod) | 422 | `UNPROCESSABLE` |
| Unauthenticated | 401 | `UNAUTHORIZED` |
| Forbidden (wrong role/ownership) | 403 | `FORBIDDEN` |
| Resource not found | 404 | `NOT_FOUND` |
| Duplicate resource | 409 | `CONFLICT` |
| Rate limit exceeded | 429 | `RATE_LIMIT_EXCEEDED` |
| Unhandled server error | 500 | `INTERNAL_ERROR` |

Stack traces are **never** sent to the client in production.

---

## 16. State Management

### 16.1 Zustand Stores (UI State)

**useProjectStore** — Project & task state:
```typescript
interface ProjectState {
  projects: Project[];
  selectedProject: Project | null;
  setProjects / setSelectedProject / addProject / updateProject / deleteProject
  addTask / updateTask / deleteTask
}
```

**useFilterStore** — Filter preferences:
```typescript
interface FilterState {
  taskFilters: TaskFilter;
  issueFilters: IssueFilter;
  calendarFilters: CalendarFilter;
  setTaskFilters / clearTaskFilters / setIssueFilters
}
```

**useUserStore** — User state & preferences:
```typescript
interface UserState {
  currentUser: BackendUser | null;
  preferences: { theme: 'light' | 'dark' | 'system'; sidebarCollapsed: boolean }
  setCurrentUser / updatePreferences
}
```

### 16.2 React Query Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 minutes
      gcTime: 30 * 60 * 1000,      // 30 minutes cache
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});
```

### 16.3 State Sourcing Rules

| Data Type | Store |
|---|---|
| Server data (projects, tasks, issues, BOM) | React Query |
| UI-only global state (filters, sidebar collapsed) | Zustand |
| Component-local state (modal open, view mode) | `useState` |
| Derived / computed state | `useMemo` |

---

## 17. UI/UX Patterns & Design System

### 17.1 Color Tokens

```css
/* Status */
--status-todo:        220 13% 60%;   /* Gray */
--status-in-progress: 217 91% 60%;   /* Blue */
--status-review:      262 83% 58%;   /* Purple */
--status-done:        142 71% 45%;   /* Green */
--status-blocked:     0   72% 51%;   /* Red */

/* Priority */
--priority-low:      220 13% 60%;
--priority-medium:    38 92% 50%;
--priority-high:      25 95% 53%;
--priority-critical:   0 72% 51%;

/* Risk severity (heatmap) */
--risk-critical: ≥20 score → Red
--risk-high:     10–19    → Amber
--risk-medium:   5–9      → Blue
--risk-low:      <5       → Green
```

### 17.2 Module Color Mapping

| Type | Color | Hex |
|---|---|---|
| PCB | Blue | #3B82F6 |
| Enclosure | Green | #10B981 |
| Firmware | Purple | #8B5CF6 |
| Procurement | Amber | #F59E0B |
| Software | Pink | #EC4899 |
| QA | Red | #EF4444 |
| Hardware | Sky | #0EA5E9 |
| Design | Cyan | #06B6D4 |
| Manufacturing | Emerald | #22C55E |
| Testing | Orange | #F97316 |
| Logistics | Slate | #64748B |
| Power | Violet | #A855F7 |

### 17.3 Core Component Patterns

**Modal pattern** — all detail views:
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-3xl max-h-[90vh]">
    <DialogHeader><DialogTitle>Title</DialogTitle></DialogHeader>
    <ScrollArea>{/* Content */}</ScrollArea>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={handleSave}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Empty states:** One headline + one sentence + one primary action. Never blank screens.

**View toggles:** Kanban ↔ List (tasks, modules), Grid ↔ List ↔ Map (BOM)

**Filter pattern:** Filter button with active count badge → dropdown with category filters → active filter chips below toolbar → Clear all button

**Status badges:** Always label + color (never color alone) for accessibility compliance

### 17.4 Sidebar Navigation Structure

```
Main
  My Day / Dashboard / Projects
Hardware
  BOM / Eng. Changes / Gate Reviews / Risk & Issues
Cross-Functional
  Calendar / Reports / Chat
Organization
  Team / Settings
```

---

## 18. Performance Optimizations

### 18.1 Code Splitting

All feature routes are lazy-loaded via `React.lazy()` + `<Suspense>`:
- Results in ~70% reduction in initial bundle size
- Skeleton loading states per route variant (dashboard, list, project-detail, calendar, chat)

### 18.2 Virtual Scrolling

Large lists (BOM trees, task lists) use `@tanstack/react-virtual`:
- Handles 1000+ items smoothly
- Fixed item height with 5-item overscan

### 18.3 Memoization Strategy

```typescript
// Component memoization
export const TaskCard = memo(function TaskCard({ task }) { ... });

// Callback memoization  
const handleUpdate = useCallback((task) => updateTask(id, task), [id]);

// Expensive computations
const filtered = useMemo(() => applyFilters(tasks, filters), [tasks, filters]);
```

### 18.4 Web Workers

Heavy report calculations offloaded to `workers/reportCalculations.worker.ts`:
- KPI computation, velocity trends, burndown curves run off the main thread
- `useReportWorker()` hook provides a clean async interface

### 18.5 Optimistic UI

Kanban drag-and-drop persists status optimistically (< 250ms perceived), with rollback on API error.

---

## 19. Testing Infrastructure

### 19.1 Test Statistics (Current)

- **Test Files:** 12 (frontend) + 7 (backend)
- **Frontend Tests:** 257 (unit + component)
- **Pass Rate:** 99.6%
- **Coverage:** ~65%

### 19.2 Test Structure

```
Frontend (Vitest + React Testing Library):
  src/services/__tests__/     # Service layer tests
  src/stores/__tests__/       # Zustand store tests
  src/features/*/__tests__/   # Feature-level utility tests

Backend (Jest):
  src/modules/auth/__tests__/
  src/modules/tasks/__tests__/
  src/modules/projects/__tests__/
  src/modules/milestones/__tests__/
```

### 19.3 Test Gaps (Priority)

| Gap | Priority | Reason |
|---|---|---|
| Integration tests (backend + real DB) | High | Unit tests mock repositories; runtime bugs go undetected |
| E2E auth flow (login → refresh → logout) | Critical | The SameSite cookie bug was undetected without E2E |
| BOM tree CRUD integration | High | Complex hierarchy with circular-reference detection |
| ECO pipeline state machine | High | Multi-step approval flow with class-based branching |
| AI worker Zod validation | Medium | Worker now has Zod; tests verify schema coverage |

### 19.4 Running Tests

```bash
# Frontend
npm test               # Run all tests once
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report

# Backend
npm test               # Jest
npm run test:watch     # Jest --watch
```

---

## 20. Milestones & Timeline

Product delivery plan (distinct from a customer program's phase gates).

| ID | Milestone | Description | Dependencies |
|---|---|---|---|
| M1 | Foundation | Auth/RBAC (F-007), tenant model, workspace shell (F-008) | — |
| M2 | Execution Core | Projects, Tasks/Kanban (F-005), Dashboard | M1 |
| M3 | Hardware Core | BOM (F-001), Engineering Change (F-002) | M2 |
| M4 | Program Governance | Gates (F-003), Risk (F-004), Reports (F-006) | M3 |
| M5 | Hardening & Integrations | SSO, audit export, PLM/distributor connectors, security review | M4 |
| M6 | Beta → GA v1.0 | Design-partner beta, then general availability | M5 |

**Feature Priority by Phase:**

| Feature | Priority | M1 | M2 | M3 | M4 | M5 |
|---|---|---|---|---|---|---|
| F-007 Auth/RBAC | P0 | ✓ | | | | |
| F-008 Shell/Dashboard | P1 | ✓ | | | | |
| F-005 Tasks | P0 | | ✓ | | | |
| F-001 BOM | P0 | | | ✓ | | |
| F-002 ECO | P0 | | | ✓ | | |
| F-003 Gates | P0 | | | | ✓ | |
| F-004 Risk | P1 | | | | ✓ | |
| F-006 Reports | P2 | | | | ✓ | |
| F-009 Chat | P1 | | ✓ | | | |
| F-010 AI Tasks | P1 | | ✓ | | | |

---

## 21. Open Questions

| ID | Question | Impact If Unresolved | Owner | Status |
|---|---|---|---|---|
| Q-01 | Is the standard 4-step ECO pipeline enough for v1, or is a configurable workflow needed at launch? | Re-architecture risk if configurability is late | Product | Open |
| Q-02 | Do target customers' BOMs/designs constitute export-controlled technical data (ITAR/EAR)? | Blocks regulated/defense customers; legal exposure | Legal / Security | Open |
| Q-03 | Is data residency (EU/US region pinning) required for v1, or acceptable as a fast-follow? | Blocks EU enterprise deals | Eng / Legal | Open |
| Q-04 | What is the committed SOC 2 Type II timeline? | Gates enterprise procurement | Security | Open |
| Q-05 | Which PLM/ERP/distributor connectors are launch-critical vs. design-partner-driven? | Scope & sequencing of M5 | Product / Partnerships | Open |
| Q-06 | Team size/composition and hard launch date? | Milestone dates & spec depth | Eng leadership | Open |
| Q-07 | Scope & surfaces for the AI assistant in v1 (read-only insights vs. actions)? | Shapes data model & UX investment | Product | Open |
| Q-08 | Should `/bom`, `/engineering-changes`, `/gate-reviews`, `/risks` be global routes or always scoped to a project? | Navigation architecture | Engineering | Open |

---

## 22. Risks & Mitigations

| ID | Risk | Category | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | Teams keep parallel spreadsheet BOMs; in-app BOM doesn't become source of truth | Adoption | Med | High | Frictionless import; where-used & change-impact that spreadsheets can't match; design-partner onboarding |
| R-02 | Export-controlled design data creates compliance/legal exposure | Compliance | Low | Critical | Resolve Q-02 early; tenant isolation, residency options, access controls; legal review before regulated customers |
| R-03 | Object/graph model complexity slows delivery (M1 is foundational) | Technical | Med | High | Lock data model first; vertical-slice one program (EV Charging) end-to-end before breadth |
| R-04 | PLM incumbent ships a lighter PM layer | Market | Med | Med | Win on UX & AI; deepen connectors; bottom-up engineer adoption |
| R-05 | Dense, color-coded UI fails accessibility/contrast | Quality | Low | Med | Label/icon alongside color; AA contrast audited in both themes; reduced-motion support |
| R-06 | Cross-origin cookie silently breaks auth in production | Technical | — | Critical | **Fixed (v4 branch):** `sameSite: none` + `secure: true` for Vercel → Railway cross-origin deployment |
| R-07 | AI task generation floods a milestone with duplicate tasks | Product | Med | Med | **Fixed (v4 branch):** BullMQ jobId deduplication per milestoneId |

---

## 23. Appendix

### A — Glossary

| Term | Definition |
|---|---|
| BOM | Bill of Materials — the structured list of every part and assembly that makes up a product |
| ECR / ECO / ECN | Engineering Change Request (the ask) → Order (the controlled change + approval) → Notice (the released, distributed change with cut-in) |
| Change class (I/II/III) | Severity of a change — I Safety/Regulatory, II Form-Fit-Function, III Documentation — governing approval rigor |
| Effectivity | The manufacturing cut-in point of a change — a date, a serial-number break, or a lot break |
| Disposition | What to do with existing stock affected by a change: Use As-Is, Rework, Scrap, Return to Supplier, Use Up Then Change |
| Phase gate | A formal review (PDR, CDR, MRR, etc.) a program must pass to advance to the next phase |
| Where-used | Every parent assembly a given part rolls into — the blast radius of changing it |
| Requirement traceability | Linking parts/tasks to the requirements they satisfy, to prove coverage |
| Tenant isolation | Each organization's data is logically separated; no cross-tenant data access is possible |
| RBAC | Role-Based Access Control |

### B — Acronyms

| Acronym | Expansion |
|---|---|
| PRD | Product Requirements Document |
| PDR / CDR / MRR | Preliminary / Critical Design Review · Manufacturing Readiness Review |
| DVT / PVT / EVT | Design / Production / Engineering Validation Test |
| PLM / PDM / ERP | Product Lifecycle / Product Data / Enterprise Resource Planning |
| RBAC | Role-Based Access Control |
| RTO / RPO | Recovery Time / Point Objective |
| EOL / FFF | End-of-Life · Form-Fit-Function |
| OTP | One-Time Password |
| JWT | JSON Web Token |
| ECR / ECO / ECN | Engineering Change Request / Order / Notice |

### C — Environment Variables Reference

**Backend (required):**
```
NODE_ENV, PORT, API_PREFIX, LOG_LEVEL
DATABASE_URL, DATABASE_SSL
REDIS_URL
JWT_SECRET (≥32 chars), JWT_EXPIRES_IN (15m), JWT_REFRESH_EXPIRES_IN (7d)
BCRYPT_ROUNDS (12)
CORS_ORIGIN (Vercel frontend URL, comma-separated)
RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, AUTH_RATE_LIMIT_MAX
ANTHROPIC_API_KEY
RESEND_API_KEY, EMAIL_FROM
APP_URL
S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (required in production)
SENTRY_DSN, SENTRY_ENVIRONMENT (optional)
```

**Frontend (required):**
```
VITE_API_BASE_URL (e.g. https://api.openplanai.com/api/v1)
VITE_WS_URL       (e.g. https://api.openplanai.com)
VITE_APP_NAME, VITE_APP_VERSION
VITE_ENABLE_ANALYTICS, VITE_ENABLE_ERROR_TRACKING
VITE_SENTRY_DSN, VITE_SENTRY_ENVIRONMENT (optional)
```

**Frontend (chat tuning — optional, defaults built-in):**
```
VITE_CHAT_ACCESS_STATE_CACHE_TTL_MS         (default: 5000)
VITE_CHAT_CONVERSATION_REFETCH_BASE_DELAY_MS (default: 600)
VITE_CHAT_CONVERSATION_REFETCH_MAX_RETRIES   (default: 1)
VITE_CHAT_PROJECT_ID_LOOKUP_TIMEOUT_MS       (default: 2500)
VITE_CHAT_START_PROJECT_TIMEOUT_MS           (default: 6000)
VITE_CHAT_START_PROJECT_MAX_ATTEMPTS         (default: 2)
```

### D — Revision History

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0 | 2025-01 | Product | Original PRD — frontend-only, Supabase backend, mock-data focused |
| 2.0 | 2026-01 | Product | Updated architecture; custom Express backend; added chat, notifications |
| 3.0 | 2026-06-05 | Head of Product | **Complete rewrite** — incorporates new hardware features (BOM, ECO, Gates, Risk); documents actual implementation (Express + Drizzle + Railway); adds auth flows, RBAC matrix, security requirements, error handling, all env vars; aligns with OpenPlan Design System update PRD (June 5 2026) |

### E — Related Documents

| Document | Purpose | Status |
|---|---|---|
| OpenPlan Design System PRD (June 5 2026) | Visual spec, tokens, components, UI kit — source for this rewrite | Available |
| Architecture Blueprint | Technical design derived from this PRD | To be produced |
| API Swagger Documentation | Live at `/api-docs` on the backend server | Available |
| Legal / Export-control review | Resolve Q-02 | TBD |
| SOC 2 Readiness Plan | Resolve Q-04 | TBD |

---

*OpenPlan AI — Product Requirements Document · v3.0 · Confidential*
*© 2026 OpenPlan AI*
