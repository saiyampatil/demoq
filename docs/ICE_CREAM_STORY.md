# Ice Cream Flavour Concept Test: the story every file must agree on

Study ID `ice-cream-flavours`. Client Scoop & Co (contact Leah Brandt, Head of Product Development). Researcher Maya Ortiz.
AI-led, English (US), 25 minutes, target 20. Fieldwork Oct 5 to 19, 2026 (Eastern daylight time), closed Oct 20.
Codebook drafted Oct 22, 2026 10:00 ET by PulseAI; Maya's decisions are Oct 22 to 23.
Built in `src/mock/iceCream.ts` (documents, sessions, review pack) and `src/mock/sessions.ts` (`ICE_SEED_SESSIONS`), surveys in `src/mock/surveys.ts` (`ICE_SURVEYS`, `ICE_ANSWERS`).

The question the client asked: **which of three new tub flavours should we launch first in spring, and what would hold shoppers back?**
Their own sales data: new flavours sell well for a month, then drop by half. They don't know if people stopped liking them or went back to their usual.

## The three flavours (stimuli; `st-a`, `st-b`, `st-c`)

| Letter | Name | Moment ID | Short |
|---|---|---|---|
| A | Salted Caramel Swirl | `m-concept-a` | the familiar, safe one |
| B | Mango Lassi | `m-concept-b` | the different one; people don't know what a lassi is |
| C | Cookie Dough Crunch | `m-concept-c` | the family one |

`Stimulus` names are exactly `Concept A: Salted Caramel Swirl`, `Concept B: Mango Lassi`, `Concept C: Cookie Dough Crunch`.

## The headline (what the numbers must add up to)

1. **Salted Caramel Swirl is the safest first pick**: 8 of 20 would buy it first. It is the familiar flavour, but 3 of those 8 then said in the locked survey they probably wouldn't buy it. It is "the safe choice", not a favourite.
2. **Cookie Dough Crunch is the parents' flavour**: 6 of 9 parents chose it, because the whole family will eat it. Only 1 adult without children did.
3. **Mango Lassi is the adults' flavour, and the risky one**: 5 of 11 adults without children chose it, 0 of 9 parents. Parents ruled it out because "the kids won't eat it". Several people didn't know what a lassi is and hesitated when first shown it, even those who chose it in the end.
4. **Most people go back to their usual flavour** (11 of 20 said they do). This answers the client's sales question: the new flavour is liked, and then the usual wins the next shop.
5. **Sweetness and price are the two limits**: 6 people worry or would change something about sweetness; about $5 to $6 a tub is what most expect to pay; above $6 five people would wait for a sale.

## The 20 people (accepted); Parent = children at home, Adult = no children at home

`Seg` is the segment (group). `Pick` is the flavour they would buy first (A caramel, B mango, C cookie). `Video` no = audio-only (no face reading).
Survey = the locked "Flavour reaction" answers (about the flavour they liked best). Occasion = the locked main time they would eat it.
The survey answers are already in `ICE_ANSWERS` and must not change.

| ID | State | Seg | Pick | Survey: buy / appeal | Occasion | Video | Notes |
|---|---|---|---|---|---|---|---|
| P-4101 | Texas | Adult | A | Probably would / 4 | Treat for myself | yes | Likes caramel, finds mango intriguing (Delight at B), wants it less sweet, $5 to $6 fine, over $6 no |
| P-4102 | California | Parent | C | Definitely would / 5 | Family at the weekend | yes | Kids decide; flags: Insufficient probing; skipped the "when would you eat it" question |
| P-4103 | New York | Adult | B | Probably would / 4 | Hot day | yes | Mango fan, hesitates at B first sight (did not know lassi), wants it explained and less sweet; likes parties |
| P-4104 | Illinois | Parent | C | Definitely would / 5 | Family at the weekend | yes | Kids decide; first attempt lost its connection, session 2 is the one in Review |
| P-4105 | Georgia | Parent | C | Probably would / 4 | After dinner | yes | Kids decide; buys what is on sale |
| P-4106 | Washington | Adult | A | Probably would not / 3 | Treat for myself | yes | Never saw Concept B (card failed, counted as not seen); price-sensitive, under $5 |
| P-4107 | Ohio | Parent | A | Definitely would / 5 | After dinner | **no** | Audio-only; kids won't eat mango; transcript corrected (Talenti, Ben & Jerry's) |
| P-4108 | Florida | Adult | B | Probably would / 4 | Hot day | yes | Likes trying new things; flags: Rushed response; skipped "when would you eat it" |
| P-4109 | Colorado | Parent | C | Probably would / 4 | Family at the weekend | yes | Kids decide, kids won't eat mango |
| P-4110 | North Carolina | Adult | A | Probably would / 4 | Treat for myself | **no** | Audio-only; caramel is the safe choice; over $6 no |
| P-4111 | Massachusetts | Parent | A | Might or might not / 3 | After dinner | yes | Flags: Guide deviation; skipped "when would you eat it"; did not know lassi |
| P-4113 | Arizona | Adult | B | Definitely would / 5 | Hot day | **no** | Audio-only; mango fan, hesitates at B first sight, wants lassi explained |
| P-4114 | Michigan | Parent | C | Definitely would / 5 | Family at the weekend | yes | Kids decide, wants chunks |
| P-4115 | Oregon | Adult | A | Probably would / 4 | Treat for myself | yes | Delight at B first sight but picked caramel; wants less sweet; over $6 no; likes guests |
| P-4116 | Pennsylvania | Adult | B | Might or might not / 3 | Party | yes | Flags: Missed core theme (never asked what they would pay); skipped "when would you eat it"; confused at B; wants less sweet and a dairy-free version |
| P-4117 | Virginia | Parent | C | Probably would / 4 | Family at the weekend | yes | Kids decide, confused by "lassi", kids won't eat mango |
| P-4118 | Minnesota | Adult | A | Probably would not / 3 | After dinner | yes | Caramel is the safe choice; worries about sweetness; under $5, would wait for a sale over $6 |
| P-4120 | Tennessee | Adult | B | Probably would / 4 | Hot day | **no** | Audio-only; mango fan, hesitates at B first sight, wants lassi explained; likes guests |
| P-4121 | Georgia | Parent | A | Probably would not / 3 | After dinner | yes | Invited from the reserve; skipped "when would you eat it" |
| P-4122 | New Jersey | Adult | C | Probably would / 4 | Treat for myself | yes | Invited from the reserve; the one adult who chose cookie dough; wants it less sweet |

Excluded in Review (never in the analysis): P-4112 (duplicate entry), P-4119 (leading question). Not completed: P-4104 session 1 (error), P-4123 (withdrew), P-4124 (no-show).
Segments: **Parents (9)** P-4102 4104 4105 4107 4109 4111 4114 4117 4121. **Adults without children (11)** P-4101 4103 4106 4108 4110 4113 4115 4116 4118 4120 4122.
Segment config for `registerSegments`: first `{ key: 'Parent', label: 'Parents', noun: 'parents', one: 'parent' }`, second `{ key: 'Adult', label: 'Adults without children', noun: 'adults without children', one: 'adult without children' }`.
Picks: A 8 (4101 4106 4107 4110 4111 4115 4118 4121), B 5 (4103 4108 4113 4116 4120), C 7 (4102 4104 4105 4109 4114 4117 4122).
Audio-only (no face reading): 4107 4110 4113 4120. Everyone else has video.

## Guide questions the codes sit under (`CODE_QUESTIONS`, ids start `iq-`)

| id | label | guide text | section | fraction | skipped |
|---|---|---|---|---|---|
| iq-habit | How they buy ice cream | Walk me through the last time you bought a tub of ice cream. | How they buy ice cream | 0.14 | none |
| iq-choose | How they choose a flavour | What usually makes you choose one flavour over another? | How they buy ice cream | 0.24 | none |
| iq-pick | Which flavour they would buy first | Which of these three would you buy first, and why? | Choosing | 0.66 | none |
| iq-stop | What would hold them back | What, if anything, would stop you buying it? | Choosing | 0.72 | none |
| iq-price | What they would expect to pay | What would you expect to pay for a tub of the flavour you picked? | Choosing | 0.78 | P-4116 "Never asked (flagged in Review)" |
| iq-when | When they would eat it | Picture a tub in your freezer. When would you eat it, and who with? | Choosing | 0.84 | 4102 4108 4111 4113 4116 4121 "Optional question, not asked" |
| iq-change | What they would change | If you could change one thing about the flavour you liked best, what would it be? | Reflection | 0.90 | none |

Moments (signals): the seven questions above plus first reactions `m-concept-a` 0.38, `m-concept-b` 0.46, `m-concept-c` 0.54, labelled "First reaction: Concept A, Salted Caramel Swirl", etc.
(The stimuli are shown at about 30% to 70% of each interview; the review mock already places them.)

## The codes (ids start `ic-`; members are who says it, one quote each, quotes in plain spoken English)

Accepted (Maya decided Oct 22 to 23): the codes she is confident in. Suggested: PulseAI's, waiting. Names are what people actually said.

**iq-habit**
- `ic-weekly-tub` "Buys a tub every week" Accepted 0.90, definition "Ice cream is a regular part of the weekly shop." members 4101 4102 4104 4105 4107 4109 4110 4114 4117
- `ic-kids-decide` "The kids pick the flavour" Accepted 0.87 "Children at home have the deciding say." members 4102 4104 4105 4109 4114 4117
- `ic-on-sale` "Buys whatever is on sale" Suggested 0.74 members 4105 4106 4107 4111 4118 4121
- `ic-treat-myself` "Eats it as a treat for themselves" Suggested 0.80 members 4101 4103 4106 4110 4115 4122

**iq-choose**
- `ic-stick-usual` "Goes back to the usual flavour" Accepted 0.90 "Tries something new, then returns to vanilla or chocolate chip." members 4101 4102 4105 4107 4109 4110 4111 4114 4117 4118 4121 (11)
- `ic-try-new` "Likes to try something new" Accepted 0.83 members 4103 4106 4108 4113 4115 4116 4120 4122
- `ic-tired-same` "Bored of the same flavours" Merged into `ic-try-new` (no quotes of its own; why "Same thing as liking to try something new, said another way.")
- `ic-mixins` "Wants chunks and mix-ins" Suggested 0.78 members 4102 4104 4109 4114 4117 4122

**iq-pick** (the core)
- `ic-pick-caramel` "Would buy Salted Caramel Swirl first" Accepted 0.88, members the 8 A picks
- `ic-pick-mango` "Would buy Mango Lassi first" Accepted 0.85, members the 5 B picks
- `ic-pick-cookie` "Would buy Cookie Dough Crunch first" Accepted 0.87, members the 7 C picks
- `ic-caramel-safe` "Caramel feels like the safe choice" Suggested 0.80 members 4101 4107 4110 4111 4118 4121
- `ic-mango-different` "Mango is the one that’s different" Suggested 0.82 members 4101 4103 4108 4113 4116 4120
- `ic-cookie-family` "Cookie dough is one everyone will eat" Suggested 0.86 members 4102 4104 4105 4109 4114 4117
- `ic-lassi-unclear` "Didn’t know what a lassi is" Suggested 0.70 members 4103 4111 4113 4116 4117 4118 4120 (low-confidence extras fine)

**iq-stop**
- `ic-kids-wont` "The kids wouldn’t eat it" Accepted 0.84 "Parents ruled out mango because the children would refuse it." members 4105 4107 4109 4111 4114 4117
- `ic-sweet-worry` "Worried it would be too sweet" Accepted 0.76 members 4101 4103 4115 4116 4118 4121
- `ic-price-limit` "A high price would stop them" Suggested 0.76 "Over about six dollars a tub they would skip it or wait for a sale." members 4101 4106 4110 4115 4118
- `ic-pay-wait-sale` "Would wait for a sale" Merged into `ic-price-limit` (why "Same thing as a high price stopping them.")
- `ic-nothing-stop` "Nothing would stop them" Accepted 0.80 members 4102 4104 4113 4122

**iq-price**
- `ic-pay-five-six` "Expects to pay about five to six dollars" Accepted 0.90 members 4101 4102 4104 4105 4107 4109 4110 4114 4117 4121 4122
- `ic-pay-more-new` "Would pay a little more for something different" Suggested 0.78 members 4103 4108 4113 4120
- `ic-pay-under-five` "Expects to pay under five dollars" Suggested 0.74 members 4106 4111 4118

**iq-when** (optional question; nobody on the skipped list says these)
- `ic-when-weekend` "A weekend treat for the family" Accepted 0.86 members 4104 4105 4109 4114 4117
- `ic-when-hot-day` "On a hot day" Suggested 0.78 members 4103 4110 4120
- `ic-when-after-dinner` "After dinner at home" Suggested 0.80 members 4101 4105 4107 4118
- `ic-when-guests` "When friends come over" Suggested 0.66 members 4103 4115 4120

**iq-change**
- `ic-less-sweet` "Make it less sweet" Accepted 0.84 members 4101 4103 4115 4116 4118 4122
- `ic-more-best-part` "More of the best part" Suggested 0.78 "More caramel ribbon, more dough, more cookie pieces." members 4101 4102 4104 4106 4107 4110 4114
- `ic-explain-lassi` "Explain what a lassi is on the tub" Suggested 0.80 members 4103 4111 4113 4120
- `ic-kid-size` "A smaller kid-size tub or cup" Suggested 0.62 members 4105 4109 4117
- `ic-dairy-free` "Wants a dairy-free version" **Rejected** 0.50 members 4116 only. Maya's why: "Only one person asked, and it is a different product from the three being tested."

Two to four low-confidence excerpts (confidence 0.45 to 0.59) in different codes give the word cloud a Low band. A few `extra` ("more") excerpts on codes so the "more like this" prompt has something.

## Themes

Created by Maya: `t-familiar` "The safe choice wins the shelf" (codes ic-stick-usual, ic-weekly-tub, ic-pick-caramel; "People like the idea of something new, but most reach for the familiar flavour when they shop."), `t-family` "Parents choose for the whole family" (ic-kids-decide, ic-pick-cookie, ic-kids-wont, ic-when-weekend; "With children at home the flavour has to be one everyone will eat."), and the approved tension theme `t-tn-mango` "Mango: a slow first reaction" (tension `tn-mango-concept`, code ic-pick-mango).
Suggested by PulseAI (appear once two of their codes are accepted and unthemed): `ts-different` "Adults want something different" (ic-try-new, ic-pick-mango, ic-pay-more-new, ic-mango-different, ic-when-hot-day); `ts-sweet` "Sweetness is the limit" (ic-less-sweet, ic-sweet-worry); `ts-price` "Around five dollars is the line" (ic-pay-five-six, ic-price-limit, ic-pay-under-five).
A suggestion only appears once two of its codes are Accepted and not yet in a theme. So `ts-different` and `ts-sweet` show (ic-try-new and ic-pick-mango are Accepted and free; ic-less-sweet and ic-sweet-worry are Accepted and free), and `ts-price` stays hidden until Maya accepts `ic-price-limit` (the behaviour Pet Food shows).

## Tensions (`TENSION_DEFS`; the four kinds in `src/mock/signals.ts`)

| id | kind | title | codes | moment |
|---|---|---|---|---|
| `tn-caramel-survey` | Said vs survey | Called Salted Caramel the one they would buy first, but some then said they probably wouldn’t buy it | ic-pick-caramel | none |
| `tn-caramel-mango-face` | Said vs emotion | Picked caramel in words, but their faces lit up most at Mango Lassi | ic-pick-caramel | m-concept-b |
| `tn-segments` | Between segments | Parents lean to Cookie Dough; adults without children lean to Mango Lassi | ic-pick-cookie, ic-pick-mango | none |
| `tn-mango-concept` | Between concepts | Chose Mango Lassi in the end, but hesitated when first shown it | ic-pick-mango | m-concept-b |
| `tn-price-survey` | Said vs survey | Said a high price would stop them, but answered “probably would” in the survey | ic-price-limit | none |

Expected numbers (they must come out of the data, not be typed): caramel-survey 3 of 8 (4106 4118 4121 "Probably would not"); caramel-mango-face 3 of the 5 caramel pickers who have a face reading at Concept B warm (Delight or Interest: 4101 Delight, 4111 Interest, 4115 Delight; 4118 Neutral, 4121 Doubt; 4106 never saw B; 4107 and 4110 are audio-only); segments: parents cookie 6 of 9 / mango 0 of 9, adults cookie 1 of 11 / mango 5 of 11; mango-concept 3 of the 5 mango pickers show marked hesitation at first sight of Concept B (4103 4113 4120); price-survey 3 of the 5 who said a high price would stop them locked "Probably would".
Maya's decisions at the start: `tn-mango-concept` "Added as a tension theme" (theme `t-tn-mango`, Oct 23 10:05); `tn-price-survey` "Dismissed" with why "The survey asked about the flavour they liked best, with no price shown. Wanting the flavour and a limit on price don’t clash."

## Hesitation and faces (signals and emotion)

Hesitation at the first sight of each concept (marked / some; the rest steady; 4106 never saw B):
- A: marked 4116 4120; some 4108 4113
- B: marked 4103 4113 4120 4111 4117 4105; some 4108 4107 4114 4118 4101
- C: marked 4118; some 4101 4115 4116
Hand-set faces at first reaction (everyone with video; Emotion, Intensity):
- A: 4101 Interest Low; 4102 Neutral; 4103 Neutral; 4104 Interest Medium; 4105 Neutral; 4106 Interest Medium; 4108 Neutral; 4109 Delight Medium; 4111 Delight Medium; 4114 Interest Low; 4115 Delight Medium; 4116 Neutral; 4117 Neutral; 4118 Interest Low; 4121 Delight Medium; 4122 Neutral
- B: 4101 Delight Medium; 4102 Doubt Medium; 4103 Delight High; 4104 Doubt High; 4105 Doubt Medium; 4108 Interest Medium; 4109 Doubt Low; 4111 Interest Medium; 4114 Doubt Medium; 4115 Delight Low; 4116 Confusion Medium; 4117 Confusion Medium; 4118 Neutral Low; 4121 Doubt Low; 4122 Interest Low
- C: 4101 Neutral; 4102 Delight High; 4103 Doubt Low; 4104 Delight High; 4105 Delight Medium; 4106 Neutral; 4108 Neutral; 4109 Delight High; 4111 Neutral; 4114 Delight High; 4115 Doubt Low; 4116 Doubt Medium; 4117 Delight Medium; 4118 Doubt Medium; 4121 Interest Low; 4122 Delight Medium
The face story: A is liked quietly (familiar), B splits the room (delight from some adults, doubt or confusion from parents), C lights up the parents.
Hesitation per code ([marked, some] among the people who say it): ic-pick-mango [3,1], ic-lassi-unclear [2,1], ic-pick-caramel [0,2], ic-pick-cookie [0,1], ic-sweet-worry [1,1], ic-price-limit [0,1], ic-explain-lassi [1,1], ic-stick-usual [0,2], ic-kids-wont [1,1]; everything else steady or one "some". Words and voice: a complaint said with a frown is consistent; a code stated with delight but said hesitantly is the interesting case (mango choosers).
Stance of each code's words: Positive for the pick codes, ic-try-new, ic-weekly-tub, ic-pay-more-new, ic-when-*; Negative for ic-kids-wont, ic-sweet-worry, ic-price-limit, ic-lassi-unclear, ic-pay-under-five, ic-less-sweet; the rest describe a fact.

## Report and outputs

The brief has one objective, so the report is one answer: **launch Salted Caramel Swirl as the safe first pick, with Cookie Dough Crunch next for families, and treat Mango Lassi as a limited run that needs a clear explanation on the tub.** Findings are written from accepted codes only, one claim per sentence, numbers from the data ("8 of 20 …"). Caveats: P-4106 never saw Concept B (not seen), P-4116 was never asked about price, 4 people are audio-only (no face reading), parents (9) and adults (11) are small groups so the comparison is directional.
Showreel and theme videos: clips come from accepted codes' excerpts; audio-only people have no video.
Audio summary, word cloud, theme map and highlights read the same codebook, so they follow once the codebook and signals are registered.

## Rules for the content

- Everything reads like real people: short, spoken, specific, a little imperfect. No lorem ipsum, no jargon, no repeated filler.
- Codes and themes are named in the words people used and must be understandable at a glance by someone who never saw the study.
- Numbers on screen are always computed from the data. Never type a count into prose.
- Pet Food Subscription Churn must behave exactly as before.
