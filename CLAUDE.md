# PulseAI Qual — Frontend Prototype

## Goal
Build a clickable frontend prototype of PulseAI Qual to understand the product screen by screen.
No backend. Mock data and simulated AI only. We build one module at a time and verify each on localhost.

## Source of truth
- `docs/PRD.md` is the primary source. Build from it.
- `docs/FOUNDER_BRIEF.md` is the original founder brief, for reference only.
- If PRD.md and FOUNDER_BRIEF.md conflict, follow PRD.md and list the conflict for me.
- If a diagram and the PRD text disagree, the text wins.
- If PRD.md marks something "Open", do not invent an answer. Use a simple placeholder and add it to `docs/OPEN_QUESTIONS.md`.
- Ignore the Results Analysis section of FOUNDER_BRIEF.md. It is out of scope.

## Known diagram errors (follow the text, not these diagrams)
- 4.5: the human-led start does NOT go through the "Hybrid enabled?" check. It goes straight to the moderator console.
- 4.3: "Ask follow-up" returns to "Participant responds", not to "Move to next plan item".
- Modules 1 and 2: where the text says "client" for the person configuring the study, it means the Researcher.

## Stack
- React + Vite + TypeScript
- Tailwind CSS
- React Router (one route per screen)
- Mock data in `src/mock/` as TypeScript files
- App state in a simple React context, persisted to localStorage so refreshes keep progress
- Simulated AI: setTimeout delays plus pre-written mock outputs, always tagged "AI-generated"

## Project structure
- `src/apps/researcher` — Researcher web app (desktop)
- `src/apps/participant` — Participant flow (mobile-first, no login)
- `src/apps/moderator` — Human moderator console (desktop)
- `src/apps/observer` — End Client backroom view (view only)
- `src/components/` — shared UI: buttons, status chips, tables, stepper, drawer, "AI-generated" tag
- `src/mock/` — seed data
- One seed study: "Moisturizer Concept Study" (skincare concept test). Use realistic content, never lorem ipsum.

## Roles
| Role | Surface | Notes |
|---|---|---|
| Researcher | Researcher app | Builds and runs studies, makes every approval |
| Participant | Participant app | Opens unique links, never chooses AI vs human |
| Human moderator | Moderator app | Runs human-led sessions |
| End Client | Observer app | Reviews briefs and guides off-platform (email), watches live from the backroom |

## Researcher study workspace
Left stepper, unlocked in order by status:
Brief → Audience → Moderator & Guide → Launch → Fieldwork → Review → Analysis (locked, out of scope)

## Screen inventory
### Researcher
| ID | Screen | Module |
|---|---|---|
| R0 | Studies dashboard | — |
| R1 | Brief intake (chat: type, upload, voice; processing and follow-ups in chat) | 1 |
| R4 | Brief editor (10 sections, source tags, original input panel, version, status) | 1 |
| R5 | Share brief and record client decision | 1 |
| R6 | Audience definition (AI-filled, editable, one screen) | 2 |
| R7 | Screener editor (max 7 questions) | 2 |
| R8 | Participant sourcing (manual add, panel IDs, link TBD) | 2 |
| R9 | Screening dashboard + R10 applicant drawer | 2 |
| R11 | Finalize pool | 2 |
| R12 | Moderator setup (AI agent config OR assign humans; surveys) | 3 |
| R13 | Stimulus library (active set, deselect never delete) | 3 |
| R14 | Discussion guide editor (draft, flags, share, approve, versions) | 3 |
| R15 | Launch readiness (entry checklist, compiled study plan) | 4.1 |
| R16 | Test runs (language × device matrix) | 4.1 |
| R17 | Preflight and authorize launch | 4.1 |
| R18 | Fieldwork command center | 4.6 |
| R19 | Session record | 4.6 / 4.7 |
| R21 | Review queue | 4.8 |
| R22 | Session review (R19 layout + scores, flags, decisions) | 4.8 |
| R23 | Study settings (roles, client access, retention) | 4.9 |

### Participant (mobile-first)
| ID | Screen | Module |
|---|---|---|
| P1 | Welcome, data consent, 18+ check | 2 |
| P2 | Screener (one question per screen) | 2 |
| P3 | Screening result | 2 |
| P4 | Verification intro and permissions | 2 |
| P5 | Video verification | 2 |
| P6 | Proof upload (if required) | 2 |
| P7 | Verification result | 2 |
| P8 | Link unavailable | 4.2 |
| P9 | Entry disclosure and consent (+ recontact toggle) | 4.2 |
| P10 | Slot booking and confirmation (human-led only) | 4.2 |
| P12 | Pre-session checks (+ alternative access mode) | 4.2 |
| P13 | Waiting room (human-led only) | 4.2 |
| P14 | Interview screen — modes: conversation, stimulus, exercise, survey | 4.3 / 4.4 / 4.5 |
| P15 | Resume (shows prior answers) | 4.7 |
| P16 | Escalation consent (hybrid only, behind a flag, default off) | 4.5 |
| P17 | Closing (thanks, incentive, contact) | 4.7 |
| P18 | Technical issue, retry or reschedule | 4.2 / 4.7 |

### Moderator and Observer
| ID | Screen | Module |
|---|---|---|
| M1 | My sessions (upcoming slots) | 4.5 |
| M2 | Moderator console (guide, stimuli, AI suggested probes, timeline, notes) | 4.5 |
| M3 | Post-session notes | 4.5 / 4.7 |
| O1 | Backroom view (view only, invisible to participant) | 4.5 |

## Status vocabularies (use these names exactly)
- Brief and guide: Draft, In Review, Approved
- Applicant screening outcome: Eligible, Ineligible, Needs Review, Reserve
- Applicant verification: Not started, Pending, Passed, Failed (separate column from screening outcome)
- Study: Not Ready, Ready to Launch, Live, Paused, Terminated, Complete
- Access track: Invited, Opened, Consented, No-show
- Session track: Active, Paused, Incomplete (resumable), Rescheduled, Withdrawn, Technical Error, Completed
- Review track: Under review, Accepted, Excluded
- Task (4.4): Completed, Completed with fallback, Skipped, Incomplete

## Product rules the UI must respect
- AI suggests; the Researcher (or human moderator) decides. Nothing AI-generated is final until accepted.
- Every approval records who, when and which version.
- Editing anything approved creates a new version that needs fresh approval.
- The participant never sees eligibility logic, AI suggestions to moderators, or observers.
- Unprompted reaction is captured before any explanation or answer options.
- Survey answers are locked once recorded; follow-up probes never change them.
- A failed stimulus is treated as not seen.
- "Completed" (session) and "Accepted" (review) are different statuses.
- Excluded sessions stay visible but are marked out of analysis and quotas.

## How we work
- Build ONLY the module or phase I ask for. Do not change other modules unless I ask.
- Before coding, show a short plan: screens, routes, components, mock data. Wait for my OK.
- Every screen has empty, loading and error states where relevant.
- Participant screens must work at mobile width (375px).
- Add a dev-only "Screen jump" menu listing every built screen by ID.
- Add a dev toggle to switch the seed study between AI-led and human-led (from Phase 5).
- After each phase: list the routes to open and a checklist for me to verify on localhost.
- Commit to git at the end of each phase with the message "Phase N done".
- Log any PRD gaps you hit in `docs/OPEN_QUESTIONS.md` instead of guessing.

## Build phases
0. Shell and foundations: app shell, R0, study workspace stepper, shared components, seed data, route placeholders, screen-jump menu
1. Module 1 — Brief: R1, R4, R5
2. Module 2 — Audience and screening: R6–R11, P1–P7
3. Module 3 — Moderator and guide: R12–R14
4. 4.1 — Launch: R15–R17
5. Participant interview (4.2, 4.3, 4.4, 4.7): P8–P18 except P16
6. Moderator and observer (4.5): M1–M3, O1, P16 behind a flag
7. Fieldwork (4.6, 4.7): R18, R19
8. Review (4.8): R21, R22
9. Settings and end-to-end walkthrough: R23, then fix links and statuses across the whole flow
