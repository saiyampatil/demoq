# Open questions

PRD gaps and conflicts found while building. Each entry says what the prototype does in the meantime.

| # | Phase | Question | Prototype behaviour | Status |
|---|---|---|---|---|
| 1 | 0 | The audience definition has no status vocabulary. What marks it done so Module 3 can start? | Uses "Confirmed", from the PRD's "confirmed audience definition". Moderator & Guide unlocks when the audience is Confirmed. | Resolved by product |
| 2 | 0 | FOUNDER_BRIEF 4.4 lists audio, documents and external links as stimulus types; PRD Module 3 lists images, videos and concept cards. | Follows the PRD: images, videos and concept cards only. | Resolved: PRD wins |
| 3 | 0 | FOUNDER_BRIEF 4.2 uses "finished" as a session state; PRD uses "Completed". | Uses Completed. | Resolved: PRD wins |
| 4 | 0 | Screen IDs R2, R3 and R20 are missing from the inventory. | Intentional. R2 and R3 (processing and follow-ups) live inside the R1 chat. R20 (version-change flow) reuses R14–R17. | Resolved by product |
| 5 | 1 | The brief had ten sections in CLAUDE.md and PRD Module 1. The product owner has reduced it to seven: Research objective, Brand context, Category context, Target audience, Market, Sample size, Length of interview. | Builds seven sections only. Research objective is the only required section and blocks sharing. "Research question" and "Previous research context" are not shown as separate sections. Interview language is not a brief section (see #7). | Resolved by product. CLAUDE.md updated. PRD not edited: still lists the old sections, see #6 and #7. |
| 6 | 1 | PRD Module 1 (Step 2 and Step 4) still lists "Research question and objectives", and "Relevant previous research context". These no longer appear as separate brief sections. | Research question is folded into Research objective. Previous research, if given, sits in the original input panel only. | Open: PRD needs updating by the product owner |
| 7 | 1 | PRD Module 3 (Step 2) and Module 3 inputs still refer to the brief's "interview language". The seven-section brief has no interview language section. | Interview language is set in Module 3 (AI moderator config) and is not part of the brief. | Open: confirm whether interview language should come from Market or be set separately |
| 8 | 1 | Source tags are limited to Client-provided, AI-generated and Missing. What tag does a section get when the researcher fills a Missing section themselves? | It becomes Client-provided (the researcher is entering the client’s requirement). "Last edited by" shows who typed it. An AI-generated section keeps its AI-generated tag after it’s accepted or edited, but loses the dashed AI style. The same applies to a conflict where the researcher clicks "Accept assumption": the AI proposed the figure, but the section becomes Client-provided, with the assumption shown under it and in the ledger. | Open: confirm, or add a fourth tag such as "Researcher" |
| 9 | 1 | PRD Module 1 Step 5 says the researcher marks the brief approved once the client approves, but doesn’t say whether the client can approve a version that was never shared. | "Client approved" can only be recorded while the brief is In Review (after Download PDF). "Approve directly" (solo) works from Draft or In Review. Both need the research objective filled and no unsaved changes. | Prototype decision |
| 10 | 1 | "Changes requested" should create a new version. Should that be an empty reopen, or only once the researcher saves edits? | Recording "Changes requested" immediately creates the next version (a copy, noted "Reopened after … requested changes"), sets status to Draft and opens R4 with the feedback. Re-downloading sets In Review again. | Prototype decision |
| 11 | 1 | Editing an approved brief: should the Audience step lock again until the new version is approved? | Yes. Saving an edit to an approved brief sets status to Draft, and Audience locks until a new version is approved (PRD Module 1 Step 6: "Handoff is blocked unless the brief status is Approved"). A banner explains this. | Prototype decision |

## Future ideas (not built)

Recommended additions proposed in Phase 1 and deferred by product. Not PRD requirements.

| Idea | What it does | Cost |
|---|---|---|
| Section comments for the client | The client comments on individual sections through a shared review link; the researcher resolves each comment. Replaces the PDF-by-email loop. | Medium to high: needs a client-facing view and comment threads. |
| "Feeds the guide" note per section | Each section shows which discussion guide items it will shape. | Small, but only meaningful once Module 3 (R14) exists. |
