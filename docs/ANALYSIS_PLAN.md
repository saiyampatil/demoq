# Results Analysis: product plan

Our product decisions for the Results Analysis module. `docs/ANALYSIS_BRIEF.md` is the founder's original brief, for context. Where they differ, this plan wins.

## Principles

- AI proposes, the Researcher approves. Nothing reaches the client unless the Researcher accepted it.
- Every claim traces back to a quote, timestamp and session.
- Honest denominators: always "n of N", never a bare percentage. N can differ per question.

## Two surfaces

- **Analysis workspace (Researcher):** codes, confidence, signals, tensions, regenerate. Work in progress.
- **Client report (client):** only approved findings and outputs. A published, versioned snapshot. Never shows unapproved codes, excluded sessions' clips, or raw confidence.

## Steps (analysis sub-stepper)

The Base step was dropped (see docs/DECISIONS.md): Review already decides which sessions count.


| # | Step | What it is |
|---|---|---|
| 1 | Codebook | One screen with three tabs: Codes, Themes and Change log. Reviewed at code level, not chunk level. Codes are grouped by guide question, and new (emergent) codes are shown separately. Themes are built only from accepted codes. A line at the top says what it is built on (sessions accepted in Review, corrected transcripts), and N is per question. |
| 2 | Signals and tensions | Behaviour described, not diagnosed ("paused 2.8 s"). Analysed at key moments only, coverage always shown, never used to exclude. Facial analysis is on hold pending a consent and legal decision. |
| 3 | Findings | Structured by the guide's objectives. AI draft and Researcher draft. Every sentence cited. Weak or unanswered questions flagged. |
| 4 | Outputs | Theme cards with video (the hero output), showreel, word cloud, podcast. |
| 5 | Lenses | Re-read the coded data through a framework. |
| 6 | Publish | Report v1 snapshot. If a Review decision changes later, the workspace shows the analysis as stale. Published versions never change silently. |

**Always-on side panel:** Ask (cited answers only), Numbers (segment differences labelled "directional"), Theme map, Real-time highlights.

## Phases

1. **Core:** Codebook (with themes), Findings, Client report.
2. **Signals and tensions, theme videos, showreel.**
3. **Word cloud, podcast, lenses, compare studies, translation.**

## Demo study

Pet Food Subscription Churn (Complete, 22 completed sessions, 20 accepted). Do not fix its guide: the codebook shows its gaps as "Asked 14 of 20" on the questions that weren't always asked.
