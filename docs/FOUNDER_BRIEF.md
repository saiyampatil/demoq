## Qual Product Brief : Setup & Interview Workflow

## 1. Study setup and clear workflow available to navigate and intervene

The workflow begins with a written brief, which is developed into a research plan using brand context, audience needs and previous research. The AI or human defines the target audience, creates a recruitment screener and verifies eligible respondents. AI moderator is selected based on each agents training and expertise area, and the discussion guide is created and approved manually before interviews begin. Interviews can use stimuli and short surveys; moderator feedback then determines whether each session is complete, rescheduled or continued.

Reference flow derived from the workshop whiteboard

## PulseAl Qual | Research setup and interview flow

ur

uct specication.

## 1. Brief Module

Accept a written business brief received from the client or upload a recorded brief discussion with the client or take a voice input from the researcher to get the first basic brief into the system. Produce an editable final researcher brief with the research question, objectives, brand and category context (if not a part of the input, then the AI should do a web scan and create its own synthesis), target audience (if not a part of the input brief, then the AI creates a suggested one), and relevant previous research context (from input only). Keep the original input brief alongside the generated version. The generated version should be well formatted and downloadable for it to be shared with the end client and get a final approval/sign-off.

## 2. Audience Recruitment & Screening Module

Turn the approved audience definition into an editable recruitment questionnaire (don't allow more than 7 questions). Set quotas and exclusion rules as the broader boundary conditions for the recruitment module. Create a dashboard for


one to see all the participating audience with their status of screening and a view of answers to recruitment questions, if any. As a part of the screening process, create a video verification flow where, on camera, we are taking basic consent on things like they allow us to record the conversation, and someone verifies their language ability for the respective language of the interview. With this our system should be able to identify the respondent as a real human, not a bot. Allow proof uploads or checks when a study requires them; keep the evidence with the screening record.

## 3. Moderator Selection & Discussion Guide Preparation

The researcher selects an AI moderator or assigns one or more human moderators. For AI-led interviews, the researcher sets the language, moderation style, and target duration and creates any short surveys to run during the session.

The researcher can upload images, videos, and concept cards to a study to a Stimulus Library, then select which items the moderator will use. Until launch, they can add new items or deselect existing ones without deleting them—for example, add two concept cards and remove one of the original three from the active interview set.

Discussion guide. The system creates an editable draft from the approved research brief, audience definition, and research questions. The researcher can add, remove, and reorder questions, probes, and stimuli. The guide can be downloaded and shared with the client for review. The researcher incorporates the client’s final feedback in the platform.

The guide remains in draft until the researcher manually approves a specific final version. Only that approved version is passed to the AI moderator agents for preparation and testing. Any subsequent edit creates a new version that requires fresh approval before the agents can use it. The study record shows who approved the guide, when, and which version was used in each interview.

## 4. Run and manage interviews

Design a unified interview execution environment supporting both automated agents and human moderators. The system must enforce an approved discussion guide, present stimuli and interactive exercises, preserve the respondent journey, and provide researchers complete fieldwork oversight without unapproved methodological shifts.

This section elaborates on the interview execution phase. It activates upon guide approval and terminates once every session is accepted, flagged, restarted, or replaced, with all evidence routed to analysis. The requirements integrate recent US qualitative market research trends and platform standards cited below.

## 4.1 Entry contract and launch gate

Required inputs. Project and participant identifiers; locked discussion guide version; moderator assignments (AI config or human); targeted duration and language; screener profile; consent parameters; active stimuli roster; task structure; quotas and fieldwork timeframe. Launching against an unapproved guide draft is strictly prohibited.

Compile the approved guide into an executable study plan containing core questions, secondary themes, permitted probes, banned phrasing, stimulus timing, branching rules, survey items, time allocations, and wrap-up conditions. This represents project-level agent configuration rather than base model retraining.

Researchers execute full test runs across all supported languages and device profiles. Preflight checks validate media rendering, translations, links, quota settings, consent language, and question coverage before the researcher explicitly authorizes study launch.

Lock the guide, agent parameters, and active stimuli under a specific release version. Mid-fieldwork modifications require pausing the study, creating a new version, and obtaining researcher approval. Completed sessions remain tied to their original version, with findings reported accordingly.

## 4.2 Session creation and respondent entry

Delivery. AI-led sessions operate asynchronously within an open invitation window; human-led sessions rely on scheduled slots. Unique participant links map directly to screening records and can be invalidated or reissued by the researcher. Track status across invited, opened, consented, active, paused, finished, and no-show states.


The entry screen explicitly discloses moderator type (AI or human), research objectives, estimated length, incentives, recording protocols, and data usage terms. Provide an optional recontact consent toggle alongside a standard exit pathway.

Perform pre-session checks for language, device capability, camera/microphone permissions, connectivity, and audio output. When supported by study protocol, offer alternative access modes, logging any mode changes without substituting unapproved formats silently.

Display active progress alongside controls to replay questions, request clarification, skip non-mandatory items, pause, or withdraw. Participants must never be penalized for declining sensitive questions.

## 4.3 Interview runtime and AI moderation

Operating rule. Guide a semi-structured flow: introductory context → actual behaviors → primary research themes → stimuli/exercises → reflection → wrap-up. The AI may adapt phrasing and sequence to maintain flow but must never introduce unapproved topics, stimuli, promises, or eligibility criteria.

At each turn, combine the master plan with prior responses and screener background. Determine whether to probe deeper, request examples, resolve contradictions, or advance topics, recording the underlying objective or rule behind each prompt.

Researchers configure mandatory coverage boundaries, probing depth, maximum follow-ups, topic limits, tone, time targets, and hard stops. The moderator skips redundant topics but records rationale for any omitted mandatory item. Prevent repetitive probing loops, leading questions, long monologues, and ungrounded emotional assumptions.

Ensure comparability across concept or segment evaluations through consistent core phrasing, controlled question ordering or randomization, fixed stimulus exposure, and standardized scales. Capture unprompted reactions before displaying explanatory copy or structured choices.

When a participant appears confused, idle, off-topic, or uncomfortable, clarify once, suggest skipping, or initiate a safe exit/escalation path. Automated moderators must refrain from offering expert advice or probing unapproved sensitive areas.

## 4.4 In-session activities and stimuli

The stimulus repository supports images, videos, audio, documents, concept cards, and external links. Researchers configure active sets, ordering, language variants, and presentation triggers. Every session logs asset IDs, exact versions, display timestamps, and load status.

At exposure points, display single assets or comparison sets, collecting unprompted feedback prior to guided probes. Provide zoom or replay capabilities. If assets fail to load, retry, apply an approved fallback, or mark the task incomplete without allowing the AI to treat unviewed content as seen.

Interactive modules include markups, card sorting, ranking, gamified trade-offs, and embedded survey questions (single-choice, multi-choice, and rating scales). Store raw interaction data independently from text transcripts. Deploy exercises only when aligned with study goals and supported by mobile fallbacks.

Survey items utilize fixed wording, predefined options, set sequencing, and missing-data rules. Qualitative follow-up probes may expand on quantitative answers without altering the original quantitative response data.

## 4.5 Human-led and hybrid operation

Human-led modes utilize identical participant profiles, guide versions, stimulus controls, and evidence structures. Equip moderators with a control console containing timeline markers and session tools, alongside an observer view featuring a private backroom for client viewing. AI agents may suggest probes privately for human approval. Optional AI-to-human escalation creates linked sessions requiring explicit consent and handoff context, ensuring moderator changes are fully transparent to participants.

## 4.6 Fieldwork command center

The live management dashboard tracks quotas by segment and region; invite/start/completion metrics; dropouts; average duration; technical issues; consent logs; core objective coverage; session validation status; and replacement requirements. Drill down directly from summary metrics to individual session records while isolating operational alerts from research insights.


Controls. Researchers can pause invitations, close quotas, reassign links, approve replacements, schedule human follow-ups, or terminate studies. Guide or stimulus updates trigger the version approval workflow. Emerging insights may prompt researcher adjustments but cannot retroactively alter active field interviews.

## 4.7 Continuity and session outcomes

Autosave every turn, audio segment, and interaction event. Upon disconnection, resume from the last saved state while displaying previously recorded data. Never restart an interview without preserving existing responses.

Session statuses include completed, incomplete (resumable), rescheduled, withdrawn, technical error, under review, excluded, and accepted. "Completed" indicates final wrap-up execution, whereas "accepted" confirms passing all data integrity, coverage, and quality checks. These metrics must be tracked independently.

Resuming sessions links prior responses, stimulus exposures, and completed themes while adhering to data retention rules. Avoid repeating completed exercises and flag necessary re-questions. Rescheduling updates appointment records while preserving historical attendance logs.

Upon conclusion, present closing acknowledgments, incentive details, and contact info. The moderator logs post-session notes covering key takeaways, guide friction, missing coverage, and recontact recommendations to inform replacement decisions.

## 4.8 Quality checks and review

Two separate scores. Evaluate participant integrity (eligibility and engagement) independently from interview quality (moderator thoroughness and objectivity). High participant integrity does not guarantee a valid interview, and vice versa.

Flag identity mismatches, screener contradictions, suspicious completion speed, repetitive or canned responses, extended silences, technical errors, and duplicate entries. Collect diagnostic signals strictly for decision support without automatic disqualification.

Flag missed core themes, repetitive AI prompts, insufficient probing, incorrect stimulus presentation, guide deviation, audio-transcript mismatches, and unsupported completion flags. Pinpoint the exact timestamp, turn, and rationale for every alert.

Researchers review flagged sessions to accept with notes, exclude, request clarification, or order replacements. Excluded sessions remain visible for auditing but are omitted from analysis and quotas by default. Record reviewer identity and decision rationale.

## 4.9 Evidence, privacy, and handoff to analysis

Maintain an immutable audit trail capturing participant and study IDs, consent logs, moderator type, launch version, turn-level question histories, stimulus events, survey choices, recordings, time-aligned transcripts, edits, activity outputs, researcher notes, quality flags, and final status. Clearly separate direct respondent quotes from AI summaries and researcher notes. Analysis tools import accepted sessions by default while retaining access to excluded records.

Role-based access controls separate personal identifiable information from research data. Manage retention, export, and deletion settings according to participant privacy requests and project policy. Restrict client access to media, clips, and transcripts based on contractual terms.

Preserve raw media and transcripts alongside complete edit histories. Corrected transcripts must not overwrite raw files. Ensure all excerpts, video clips, and analytical takeaways link directly to participant records, timestamps, guide items, and stimulus versions.

## 4.10 Acceptance scenarios

A launched study with three concept cards is paused to add two new cards and remove one. The platform mandates a new approved version release; existing sessions retain their original three-card manifest, while analysis views allow filtering by version.

A participant disconnects midway through a video task. Upon re-entry, prior inputs and display events remain intact, allowing the exercise to resume or close as incomplete without generating artificial data.


An AI probe repeats an answered topic while skipping a mandatory objective. The platform flags the specific turns, enabling the researcher to accept the session with justification or exclude it.

A human moderator reschedules a missed appointment, conducts a follow-up interview, and logs notes. All scheduling logs and interview artifacts remain linked under a single respondent history.


## PULSEAI QUAL

## Results Analysis Module Product Brief

Researcher-controlled, multi-lens, multimodal behavioral analysis

with narrative artifacts that stay fully auditable — not another black-box theme generator.

October 2026 | Draft Version

## 1. What This Module Does

After interviews are finished and quality-checked, this module turns the transcripts and media into clear, usable findings. Researchers stay in control of the structure. Every claim can be traced back to the exact moment in the interview. The output is reports, video showreels, short audio summaries, and an interactive word cloud that leadership can use.

## 2. What the Module Receives

Only sessions that passed quality review are available for analysis. For each session the system receives:

- Time-aligned transcript (original + any corrections)

- Video and/or audio file with stimulus timestamps

- Guide version used, moderator type, and any quality flags

- Clear separation between respondent words, AI notes, and researcher notes

## 3. Step-by-Step Analysis Flow

## Step 1 — Build the Codebook

The system reads every transcript and suggests short labels (codes) that describe what the respondent said.

- 1. For each meaningful chunk of transcript, propose one or more codes. Codes convert the respondent’s own words into a short plain label. Show the supporting quote and a confidence score.

- 2. Show the researcher a review screen. They can accept, reject, rename, or merge codes.

- 3. Whenever a code changes, search the rest of the transcripts and surface other matching excerpts so coding stays consistent.

- 4. Group approved codes into themes. Researchers can rename or reorganize themes. Themes only come from codes the researcher has accepted.

- 5. Keep a single living codebook that stores every code and theme, its definition, example quotes, count, and a short log of who changed it and why. Allow Excel export at any time. Optional: run a second independent coding pass and show disagreements.

## Step 2 — Add Behavioural Signals

Attach extra signals to the codes and themes so researchers can see gaps between what people say and how they behave.

- 6. Where video or audio exists, extract vocal tone, hesitation, and facial micro-expressions.

- 7. Link every signal to the exact timestamp and the model’s reason.


- 8. Surface clear examples such as “Theme is verbally positive but shows hesitation in 38% of sessions.”

## Step 4 — Find Tensions

Automatically look for contradictions.

- 9. Detect say-do gaps, differences between segments, and conflicts between stimuli.

- 10. Show each tension with the supporting clips. Researchers can turn a tension into a theme or dismiss it (with a logged reason).

## Step 5 — Create Narrative Outputs

AI Analysis Summary (With a tab also to add a new analysis summary drafted by researcher)

- 1. Produces a final comprehensive narrative structured section-by-section against the approved discussion guide.

- 2. For every guide question that required a clear answer, it writes a concise finding backed by the approved codes and themes, plus representative quotes and prevalence.

- 3. Explicitly surfaces tensions, contradictions, and behavioral signals the AI can infer beyond the spoken words (hesitation, tone shifts, facial micro-expressions, say-do gaps, stimulus-specific reactions).

- 4. Flags any guide question that remains unanswered or weakly supported.

- 5. The researcher can edit any paragraph, accept or reject suggested tensions, and regenerate the full summary. Every claim stays linked to its source quote and timestamp.

## Showreel & Thematic Videos

Build a Showreel short video that illustrates the main themes.

- 6. Select clips by theme, by emotion strength, or by stimulus.

- 7. Let the researcher reorder, replace, or remove clips before publishing.

- 8. Export as MP4, embeddable link, and a storyboard with quotes.

- 9. For each approved theme, the system selects the strongest 4–8 clips across sessions (using confidence, emotional intensity, and clarity).

- 10. Clips are stitched into one continuous 45–90 second video per theme, with optional lower-third captions.

- 11. The theme card now contains the playable stitched video, short AI summary, prevalence count, and a “Read more” link to the detailed AI Analysis Summary.

- 12. A simple theme-wise chart sits below the video so stakeholders see both the story and the numbers.

- 13. Researcher controls: Detailed Input from the researcher basis which we can regenerate the stitch. Previous versions stay as an undo feature. Allow max 3 versions to stay in the tool with an option to select default for display.

- 14. Export: single-theme stitched video in MP4, Showreel alone, full-study showreel (all themes in sequence), and embeddable link.

## Interactive Word Cloud

Generate a word cloud only from the codes and themes the researcher has approved.

- 1. Font size shows how often the code or theme appears (frequency).

- 2. Color shows the average confidence score of that code or theme.

- 3. When the researcher clicks a word, a panel opens on the right showing the exact respondent verbatims that support it, including session ID, timestamp, and user details.


- 4. On each verbatim the researcher can choose Ignore, Delete, or Add. Ignore hides it for the current view only. Delete permanently removes that statement from the word-cloud display. Add lets the researcher search the full transcript and insert an additional verbatim segment.

- 5. After any Ignore, Delete, or Add action, the researcher can regenerate the word cloud. Deleted statements stay removed from the display window.

## Podcast-Style Audio Summary

Generate an 8–12 minute spoken summary of the study.

- 6. Write the script from the approved themes and tensions. Cite the exact respondent turns for every main claim.

- 7. Let the researcher edit individual lines and regenerate only those parts.

- 8. Produce audio with a professional or brand voice. Regenerate when the analysis changes.

## Multi-Lens Custom Analysis ( With Save/Edit Feature for each Analysis)

A lens is a fixed way of looking at the same interviews (for example Brand Equity, Jobs-to-be-Done, or Barriers).

- 1. Provide a possible suggestion of lenses to analyse the data further.

- 2. When a researcher inputs or selects a lens with its own rules/descriptors, re-analyze the coded data using that lens’s rules and produce a separate report ( Showreel, Podcast Audio, Word Cloud) along with a custom AI analysis Summary

- 3. Allow researchers to save custom lenses for reuse. Free-form questions are allowed but do not replace a locked lens.

## Step 6 — Chat, Numbers & Visuals

- 4. Chat: Researcher types a question. Return only answers that include the exact quote, timestamp, and media link. Clicking jumps to that moment.

- 5. Numbers: From the coded data, calculate how often each theme appears, differences by segment, and simple statistical tests. Every number links back to the quotes.

- 6. Theme map: Show themes as a visual map. Size and color show how common or how emotional each theme is. Click a theme to see its quotes.

## Step 7 — Real-Time Highlights

Show a side panel with the current codes. If the researcher types a new idea or question, scan the transcripts immediately and propose matching codes with quotes. Accepted codes update the codebook right away.

## 4. Extra Controls ( Optional)

- Quality flags stay visible and can be filtered out.

- Researchers can compare the current study with past studies stored in Lens.

- Translate transcripts on demand while keeping the original. Flag cultural phrases that may not translate cleanly.

## 5. What the Module Produces

- Video showreels

- Interactive word cloud (confidence-colored, frequency-sized, with editable verbatims)

- Audio summary

- Lens-specific reports


PulseAI Qual — Results Analysis Product Brief

- PowerPoint and memo

- Excel codebook

- Theme map and charts
