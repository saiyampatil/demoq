# Results Analysis: product plan

Our product decisions for the Results Analysis module. `docs/ANALYSIS_BRIEF.md` is the founder's original brief, for context. Where they differ, this plan wins.

## Principles

- AI proposes, the Researcher approves. Nothing reaches the client unless the Researcher accepted it.
- Every claim traces back to a quote, timestamp and session.
- Honest denominators: always "n of N", never a bare percentage. N can differ per question.

## Two surfaces

- **Analysis workspace (Researcher):** codes, confidence, signals, tensions, regenerate. Work in progress.
- **Client report (client):** only approved findings and outputs. A published, versioned snapshot. Never shows unapproved codes, excluded sessions' clips, or raw confidence.

## Steps (analysis stepper)

Three steps, each with one question, one decision type and one finish line. The brief's longer list of steps describes the work, not the screens. The Base step was dropped (Review already decides which sessions count; see docs/DECISIONS.md).

| # | Step | The question | You decide | Done when |
|---|---|---|---|---|
| 1 | **Codebook** | What did people say? One screen, three tabs: Codes, Themes, Change log. Codes grouped by guide question, new codes apart. Themes only from accepted codes. A line at the top says what it is built on, and N is per question. | Accept, reject, rename, merge codes. Group them into themes. | Every code has a decision and there is at least one theme. |
| 2 | **Signals & tensions** | How did they say it, and where does it not add up? Behaviour described, not diagnosed ("paused 2.8 s"). Key moments only, coverage always shown, never used to exclude. Tensions: said vs behaviour, said vs survey, between segments, between stimuli. Facial analysis is on hold pending a consent and legal decision. | Accept a tension (and turn it into a theme) or dismiss it with a reason. Untick signals not to use. | Every tension has a decision. |
| 3 | **Report** | What do we tell the client? An executive summary and a finding per guide question (AI draft and Researcher draft, every sentence cited, weak or unanswered questions flagged), theme cards with video, showreel, word cloud, podcast, lenses as a switch, exports. | Edit the text, keep or remove sections and tensions, publish. | Published as version 1. |

**What step 2 hands to the Report:** signals per code, theme and key moment (n of M people, timestamps, the model's reason); accepted tensions with both sides in n of N and their quotes; the dismissed ones stay in the log with reasons and never reach the client; coverage (video, audio-only, excluded); segment comparisons that survived, labelled directional.

**Always-on side panel (all three steps):** Ask (cited answers only), Numbers (segment differences labelled "directional"), Theme map, Real-time highlights.

**Publish** is a button in the Report, not a step. If a Review decision or the codebook changes later, the later steps show as out of date. Published versions never change silently.

## Navigation: the researcher never has to look for the next thing to do

- The stepper is on every analysis screen. Each step shows Not started, In progress or Done and one line of what is left ("16 codes to review").
- Each screen has one primary action in the same place, a footer that says in plain words where things stand ("16 codes still to review, 2 themes") and one button to move on.
- Continue warns but doesn't block. With nothing to warn about it moves straight on. Only having no accepted code blocks it (nothing to analyse). Going back is always free.
- Opening Analysis lands on the first step that isn't done, so a returning Researcher resumes where they left off.
- Each screen opens with a progress strip of what needs them, and clicking a count filters to it.

## Phases

1. **Structure and navigation** (done), **Signals & tensions** (done), then **Report core** (executive summary, findings, theme cards, draft switch, regenerate, publish).
2. **Report media:** theme videos, showreel, side panel.
3. **Word cloud, podcast, lenses, compare studies, translation.** An optional Emotion band, only after the consent and legal decision.

## Demo study

Pet Food Subscription Churn (Complete, 22 completed sessions, 20 accepted). Do not fix its guide: the codebook shows its gaps as "Asked 14 of 20" on the questions that weren't always asked.
