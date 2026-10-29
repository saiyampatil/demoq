# Decisions

One line per change: the decision, then the reason. Newest stage at the bottom.

## R18 / R21 redesign, stage 1: foundation

- Fieldwork and Review read one session list (`src/mock/sessions.ts`, 25 invited for a target of 24); R18, R19, R21, R22 and the stepper's "awaiting" chip all count from it. Reason: R18 (4 completed), R21 (24 completed, 18 awaiting) and R22 ("24 of 24") were built from two unrelated mocks and contradicted each other.
- A session is in Fieldwork until it is Completed, then it is in Review; the review queue is exactly the Completed sessions (14 today: 9 under review, 3 accepted, 2 excluded). Reason: one rule decides where a session lives, so no screen can count it twice.
- Session IDs are the participant IDs (P-2041 to P-2065) on every screen, replacing the S-001 fieldwork IDs. Reason: R19 and R22 must name the same session the same way.
- The prototype clock moves to Nov 11 2026, 5 PM (day 9 of the Nov 3 to Nov 17 window). Reason: completed sessions now run up to Nov 11, and no session may finish after "now".
- Every seed session carries its own technical issues, matched to its review record (P-2041's fallback Concept B card is both a resolved "Stimulus failed to load" in Fieldwork and a flag in Review). Reason: issues were handed out round-robin, so they didn't match what Review showed for the same session.
- Saved fieldwork from the old mock is rebuilt on load (`SESSION_SEED`). Reason: old browser state would otherwise keep the S-0xx sessions and the mismatch.
- R18, R19, R21 and R22 read the study through one hook (`useStudySessions`) and show the same "Sample data: this study hasn't launched" banner before launch, with a dev-only "Load the Live stage" button. Reason: R22 always loaded the same study; the "Not Ready" stepper the product owner saw was the seed after Reset seed ("New study"), where R18 said "sample data" but R21 and R22 didn't.
- The "Command center / Session" sub-stepper is hidden in Fieldwork; R19 opens with a breadcrumb "Fieldwork command center > P-2047", using the same Breadcrumb component as R22. Reason: same pattern as Review, and R19 is a drill-down, not a step.
- R19's "Review: Under review" line is now real: completed sessions show their actual review status and an "Open in review" link; unfinished ones say they are still in fieldwork. Reason: it showed "Under review" for every session, including people who had not started.
- R18's footer no longer floats (`WizardFooter sticky={false}`); it sits after the last card. Reason: the floating bar covered the cards on R18's long page. Other screens keep the floating footer.
- Fieldwork names the AI moderator "AI agent (Ava)", as Review does, instead of "AI moderator". Reason: the same session showed two moderator names on R18 and R22.
- Quota bars, the region spread and pace count completed sessions minus those Excluded in Review (12 of 24 today, not 14); R18's header says both: "14 completed, 12 of 24 count toward the target". Reason: the PRD keeps excluded sessions visible but out of quotas, and R18 was counting them.
- Fieldwork shows its times in the study's time zone (Eastern), as Review does, and R19's timeline is ordered by time. Reason: the same moment showed different clock times on R19 and R22, and mixed date formats put "Interview completed" before "Interview started".
