// A3 Report workspace (Phase A3-1): live numbers, approval, A2 handoff, Review mode, Compare. Every check waits on state and throws when it fails.
// Run: npx vite --port 5199 --strictPort &   then   node tests/setup-flow.mjs rp report
const STUDY = '/researcher/studies/pet-food-churn/analysis'
const CB = 'pulseai-qual:codebook'
const RP = 'pulseai-qual:report'
const q = (s) => JSON.stringify(s)
const setVal = (sel, v, proto = 'HTMLInputElement') => `(()=>{const i=document.querySelector(${q(sel)});Object.getOwnPropertyDescriptor(${proto}.prototype,'value').set.call(i,${q(v)});i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`

export default async ({ b, out }) => {
  out.checks = {}
  const fail = (label) => { console.error(JSON.stringify(out, null, 1)); throw new Error(`FAILED: ${label}`) }
  const expect = async (label, expr, ms = 6000) => { const ok = await b.poll(expr, ms); out.checks[label] = !!ok; if (!ok) fail(label); return ok }
  const is = (label, cond, detail) => { out.checks[label] = !!cond; if (!cond) { if (detail !== undefined) out[`detail: ${label}`] = detail; fail(label) } }
  const click = async (sel) => { const ok = await b.poll(`(()=>{const e=document.querySelector(${q(sel)});if(!e||e.disabled)return false;e.click();return true})()`); if (!ok) fail(`nothing to click for ${sel}`); await b.sleep(250) }
  const clickText = async (sel, label, scope = 'document') => { const ok = await b.poll(`(()=>{const e=[...${scope}.querySelectorAll(${q(sel)})].find(x=>x.innerText.trim().replace(/\\s+/g,' ').startsWith(${q(label)}));if(!e||e.disabled)return false;e.click();return true})()`); if (!ok) fail(`nothing to click for ${sel} "${label}"`); await b.sleep(250) }
  const text = (sel) => b.evaluate(`document.querySelector(${q(sel)})?.innerText.replace(/\\s+/g,' ') ?? null`)
  const count = (sel) => b.evaluate(`document.querySelectorAll(${q(sel)}).length`)
  const states = () => b.evaluate(`[...document.querySelectorAll('[data-testid=sentence]')].map(e=>e.dataset.state)`)
  const report = () => b.evaluate(`JSON.parse(localStorage.getItem(${q(RP)})||'{}')['pet-food-churn']`)
  const codebook = () => b.evaluate(`JSON.parse(localStorage.getItem(${q(CB)})||'{}')['pet-food-churn']`)
  const fresh = async (path = 'report') => {
    await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
    await b.goto(`${STUDY}/${path}`); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(500)
  }
  const reload = async () => { await b.goto(`${STUDY}/report`); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(500) }
  const primary = () => text('[data-testid=primary-action]')
  // The report is prose: a sentence's controls open when it is clicked, and a finding's detail opens under Details.
  const pick = (scope) => click(`${scope} [data-testid=sentence-text]`)
  const openDetails = () => b.evaluate(`[...document.querySelectorAll('[data-testid=finding-more]')].filter(x=>x.getAttribute('aria-expanded')==='false').forEach(x=>x.click()); true`).then(() => b.sleep(250))
  const sentenceByText = (re) => `[...document.querySelectorAll('[data-testid=sentence]')].find(e=>${re}.test(e.innerText))`

  // ── A report saved by the old layout (no approvals field) must not crash the screen; it is replaced ──
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); true')
  await b.evaluate(`localStorage.setItem(${q(RP)}, JSON.stringify({'pet-food-churn':{studyId:'pet-food-churn',schema:2,createdAt:'x',updatedAt:'x',builtOn:[],execSummary:{aiDraft:[],researcherDraft:[],active:'ai',edits:[]},findings:[{questionId:'q-start',aiDraft:[{id:'q-start-1',text:'old',cites:[]}],researcherDraft:[],active:'ai',edits:[]}]}})); true`)
  await b.goto(`${STUDY}/report`); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(600)
  is('an old-shape saved report is replaced, not a crash', !(await b.evaluate(`document.body.innerText.includes('Unexpected Application Error')`)) && (await report()).schema === 3 && (await count('[data-testid=sentence]')) >= 3)

  // ── The workspace: header, tools, three columns, footer ──
  await fresh()
  is('the built-on line says sessions, excluded and release', /Built on 20 accepted sessions · 2 excluded left out · Release v1\.0/.test(await text('[data-testid=built-on]')), await text('[data-testid=built-on]'))
  is('the report status starts as Draft', /Draft/.test(await b.evaluate(`document.querySelector('h1')?.parentElement.innerText`)))
  for (const g of ['Outputs', 'Explore', 'Lenses', 'Review', 'Release']) is(`Tools has the group ${g}`, new RegExp(g).test(await text('[data-testid=tools]')))
  for (const t of ['Theme videos', 'Showreel', 'Word cloud', 'Theme map', 'Audio summary', 'Ask', 'Numbers', 'Highlights', 'Lens builder', 'Compare lenses', 'Approve sentences', 'Compare AI and mine', 'Exports', 'Publish']) is(`Tools lists ${t}`, (await text('[data-testid=tools]')).includes(t))
  is('the right column is hidden until something is selected', (await count('[data-testid=selected]')) === 0 && (await count('[data-testid=built-from]')) === 0)
  is('the stepper still says what is open in the steps before (16 codes, 5 tensions)', /16 codes to review/.test(await b.evaluate('document.body.innerText')) && /5 tensions to review/.test(await b.evaluate('document.body.innerText')))
  for (const t of ['Theme videos', 'Showreel', 'Word cloud', 'Ask', 'Lens builder', 'Exports']) is(`${t} shows no state: nothing says "Not built"`, (await count(`[data-testid=tool-state-${{ 'Theme videos': 'theme-videos', Showreel: 'showreel', 'Word cloud': 'word-cloud', Ask: 'ask', 'Lens builder': 'lens-builder', Exports: 'exports' }[t]}]`)) === 0)
  is('and the word "Not built" is nowhere in the tools', !/Not built/.test(await text('[data-testid=tools]')))
  is('a tool with a state shows it (Approve sentences: 17 to review)', /17 to review/.test(await text('[data-testid=tool-state-review]')))
  is('one primary button, "Review 17 sentences"', (await primary()) === 'Review 17 sentences', await primary())
  is('the footer says where things stand', /0 of 17 sentences approved · 17 to review/.test(await text('[data-testid=report-status]')), await text('[data-testid=report-status]'))
  is('a lens dropdown with Whole study', /Whole study/.test(await text('[data-testid=lens-select]')))
  is('the executive summary and 4 guide sections', (await count('[data-testid=exec-card]')) === 1 && (await count('[data-testid=section]')) === 4)

  // ── The summary reads as prose; every sentence has its state in view without a click ──
  is('the summary is short paragraphs of at most two sentences, five sentences in all', (await count('[data-testid=exec-card] [data-testid=prose]')) === 1 && (await count('[data-testid=exec-card] [data-testid=sentence]')) === 5 && (await b.evaluate(`[...document.querySelectorAll('[data-testid=exec-paragraph]')].every(p=>Number(p.dataset.count)<=2)`)))
  is('there is no per-sentence Approve, Edit or Delete on the page until a sentence is clicked', (await count('[data-testid=approve]')) === 0 && (await count('[data-testid=edit-sentence]')) === 0 && (await count('[data-testid=sentence-tray]')) === 0)
  is('the count stays visible under the summary: "5 sentences · 0 approved"', /5 sentences · 0 approved/.test(await text('[data-testid=exec-count]')), await text('[data-testid=exec-count]'))
  is('the summary carries the AI-generated tag', /AI-generated/.test(await text('[data-testid=exec-card] header')))
  const dots = await b.evaluate(`[...document.querySelectorAll('[data-testid=sentence]')].map(e=>({dot:e.dataset.dot,label:e.querySelector('[data-testid=state-dot]')?.getAttribute('aria-label'),under:getComputedStyle(e.querySelector('[data-testid=sentence-text]')).textDecorationLine}))`)
  is('every sentence has a visible state dot saying "Not approved"; findings underline it, the calm summary does not', dots.length >= 5 && dots.every((d) => d.dot === 'not-approved' && /^Not approved/.test(d.label ?? '')) && dots.slice(0, 5).every((d) => !/underline/.test(d.under)) && dots.slice(5).every((d) => /underline/.test(d.under)), dots.slice(0, 7))
  is('the sources are numbered marks at the end of each sentence', (await count('[data-testid=exec-card] [data-testid=cite-mark]')) >= 4)
  is('and a sentence says why it is not approved on hover (waiting for your approval)', /waiting for your approval/.test(await b.evaluate(`document.querySelector('[data-testid=sentence] [data-testid=state-dot]').getAttribute('title')`)))

  // ── Live numbers match the codebook (A1) ──
  const exec1 = await b.evaluate(`document.querySelector('[data-testid=exec-card] [data-testid=sentence]').innerText`)
  is('exec sentence 1 says 8 of 20 for price rises, as A1 does', /“Price went up”: 8 of 20 people/.test(exec1), exec1)
  is('exec sentence 2 says flexibility 7 of 20 and price 6 of 20, close to even', /close to even: 7 of 20 chose flexibility, 6 of 20 chose price/.test(await b.evaluate(`document.querySelectorAll('[data-testid=exec-card] [data-testid=sentence]')[1].innerText`)))
  const doc0 = await codebook()
  const nOf = (id) => new Set(doc0.codes.find((c) => c.id === id).excerpts.map((x) => x.split('-').slice(-2, -1)[0])).size
  is('the numbers equal the people under each code in the stored codebook', nOf('c-price-rise') === 8 && nOf('c-idea-pause') === 6 && nOf('c-flex-first') === 7, [nOf('c-price-rise'), nOf('c-idea-pause'), nOf('c-flex-first')])
  is('no percentages anywhere in the report', !/\d\s?%/.test(await text('[data-testid=report]')))

  // ── Sections collapse; strength chips; the first with work is open ──
  is('only the first section is open to begin with', (await b.evaluate(`[...document.querySelectorAll('[data-testid=section] > button')].map(x=>x.getAttribute('aria-expanded')).join()`)) === 'true,false,false,false')
  await click('[data-testid=toggle-all-sections]')
  await expect('Expand all opens every section', `document.querySelectorAll('[data-testid=finding]').length===7`)
  is('a question not asked of everyone reads "4 of the 14 people"', /4 of the 14 people/.test(await text('[data-testid=report]')))
  const strength = await b.evaluate(`Object.fromEntries([...document.querySelectorAll('[data-testid=finding]')].map(e=>[e.dataset.q,e.dataset.strength]))`)
  is('strength: not everyone asked is at most Weak (q-schedule, q-back); the rest are Strong', strength['q-schedule'] === 'Weak' && strength['q-back'] === 'Weak' && strength['q-start'] === 'Strong' && strength['q-flex'] === 'Strong', strength)
  is('a Weak finding says why, in people', /Weak: 1 person wasn’t asked|Weak: \d+ people weren’t asked this question, so it rests on/.test(await b.evaluate(`document.querySelector('[data-q=q-schedule]').innerText`)) || /Weak:/.test(await b.evaluate(`document.querySelector('[data-q=q-schedule]').innerText`)))
  await openDetails()
  is('each finding shows two representative quotes (when it has them)', (await b.evaluate(`document.querySelector('[data-q=q-cancel] [data-testid=rep-quotes]').children.length`)) === 2)
  const repAuthors = await b.evaluate(`[...document.querySelectorAll('[data-q=q-cancel] [data-testid=rep-quotes] [data-testid=quote]')].map(e=>e.dataset.participant)`)
  is('the two quotes are two different people', new Set(repAuthors).size === 2, repAuthors)

  // ── A2 handoff: signals ticked, related tension ──
  const sig = await b.evaluate(`[...document.querySelectorAll('[data-testid=signals]')].map(e=>e.closest('[data-testid=finding]').dataset.q)`)
  is('signals ticked in A2 reach the findings they belong to', sig.length >= 2, sig)
  is('a signal line is measured, not judged, and emotion/voice is marked off for the client', /marked hesitation in \d+ of \d+ people/.test(await text('[data-testid=report]')) && /off in the client version until cleared/.test(await text('[data-testid=report]')))
  is('a related tension shows with its A2 status', (await count('[data-testid=tension]')) >= 1, await count('[data-testid=tension]'))

  // ── Selected follows the selection, with real quotes ──
  await pick('[data-q=q-cancel]')
  await expect('selecting a sentence opens the right column with its sources', `!!document.querySelector('[data-testid=selected-sentence]')`)
  is('and its controls open under it', (await count('[data-testid=sentence-tray]')) === 1 && (await count('[data-testid=approve]')) === 1)
  is('only one sentence has controls open at a time', (await count('[data-testid=sentence-tray]')) === 1)
  const marks = await count('[data-q=q-cancel] [data-testid=sentence-text] ~ sup [data-testid=cite-mark]')
  await b.evaluate(`document.querySelectorAll('[data-q=q-cancel] [data-testid=cite-mark]')[0].click(); true`)
  await b.sleep(300)
  is('clicking a numbered mark opens that source in the panel, marked as on', marks >= 1 && (await b.evaluate(`document.querySelector('[data-testid=source][data-n="1"]')?.dataset.on`)) === 'true', marks)
  is('the panel numbers its sources like the marks', await b.evaluate(`[...document.querySelectorAll('[data-testid=source]')].every((e,i)=>e.dataset.n===String(i+1))`))
  is('Selected shows where the numbers come from', /Price went up: 8 of 20 people/.test(await text('[data-testid=selected-sentence]')), await text('[data-testid=selected-sentence]'))
  const selQ = await b.evaluate(`[...document.querySelectorAll('[data-testid=selected] [data-testid=quote]')].map(e=>({s:e.dataset.session,p:e.dataset.participant,a:+e.dataset.at,t:e.innerText}))`)
  is('every quote has a session, a participant and a timestamp', selQ.length >= 3 && selQ.every((x) => /^P-31\d\d-\d$/.test(x.s) && /^P-31\d\d$/.test(x.p) && x.a > 0 && /\d+:\d\d/.test(x.t)), selQ.slice(0, 2))
  await clickText('[data-testid=selected] [data-testid=quote] button', 'Play clip')
  await expect('Play opens the shared mock player right there', `!!document.querySelector('[data-testid=selected] [data-testid=clip-player]')`)
  is('and the page did not navigate away', /analysis\/report/.test(await b.evaluate('location.pathname')))
  await click('[data-testid=selected-close]')
  is('the close button hides the right column again', (await count('[data-testid=selected]')) === 0 && (await count('[data-testid=sentence-tray]')) === 0)
  await click('[data-testid=toggle-all-sections]'); await click('[data-testid=toggle-all-sections]')

  // ── Excluded and never in the report ──
  await click('[data-testid=excluded-open]')
  await expect('the excluded list opens, read-only', `/P-3112/.test(document.querySelector('[data-testid=excluded-list]')?.innerText||'')&&/P-3119/.test(document.querySelector('[data-testid=excluded-list]')?.innerText||'')`)
  await b.evaluate(`document.querySelector('[role=dialog] button[aria-label=Close]').click(); true`)
  await b.sleep(250)
  await openDetails()
  const everyone = await b.evaluate(`[...document.querySelectorAll('[data-testid=report] [data-testid=quote]')].map(e=>e.dataset.participant)`)
  is('no quote from an excluded session (P-3112, P-3119) is in the report', everyone.length >= 6 && !everyone.some((p) => p === 'P-3112' || p === 'P-3119'), everyone)

  // ── Approval: one sentence at a time, recorded with who, when and version ──
  const before = (await states()).filter((s) => s === 'To review').length
  await pick('[data-q=q-start]')
  await click('[data-q=q-start] [data-testid=approve]')
  await expect('approving a sentence makes it Approved', `document.querySelector('[data-q=q-start] [data-testid=sentence]').dataset.state==='Approved'`)
  is('its dot turns to a tick and the underline goes', (await b.evaluate(`document.querySelector('[data-q=q-start] [data-testid=sentence]').dataset.dot`)) === 'approved' && !/underline/.test(await b.evaluate(`getComputedStyle(document.querySelector('[data-q=q-start] [data-testid=sentence-text]')).textDecorationLine`)))
  is('the footer count moves', /1 of 17 sentences approved · 16 to review/.test(await text('[data-testid=report-status]')), await text('[data-testid=report-status]'))
  is('Tools shows 16 to review', /16 to review/.test(await text('[data-testid=tool-state-review]')))
  let r = await report()
  const ap = Object.values(r.approvals)[0]
  is('the approval records who, when, which version and the exact wording', ap && ap.by === 'Maya Ortiz' && /^\d{4}-/.test(ap.at) && ap.version === 1 && ap.text.includes('5 of 20') && ap.cites.length > 0, ap)
  is('the report log has an Approved entry', r.log.some((e) => e.action === 'Approved sentence'))
  await pick('[data-q=q-start]')
  await expect('Selected shows the approval record', `/Approved by Maya Ortiz/.test(document.querySelector('[data-testid=approval-record]')?.innerText||'')`)
  is('status chip now In Review', /In Review/.test(await b.evaluate(`document.querySelector('h1')?.parentElement.innerText`)))
  await reload()
  is('approval survives a refresh', (await states()).filter((s) => s === 'Approved').length === 1)

  // ── Mine: an uncited sentence blocks, a reason unblocks, and it is logged ──
  await click('[data-testid=toggle-all-sections]')
  await click('[data-q=q-start] [data-testid=finding-more]')
  await b.evaluate(`document.querySelector('[data-q=q-start] [data-testid=draft-researcher]').click(); true`)
  await expect('switching to Mine shows an empty draft', `!!document.querySelector('[data-q=q-start] [data-testid=empty-draft]')`)
  is('the finding now has no sentences, so fewer to approve', /0 of 15 sentences approved · 15 to review/.test(await text('[data-testid=report-status]')), await text('[data-testid=report-status]'))
  await clickText('[data-q=q-start] [data-testid=empty-draft] button', 'Add a sentence')
  await b.evaluate(setVal('[data-testid=sentence-editor] textarea', 'People wanted food to show up without thinking about it.', 'HTMLTextAreaElement'))
  await click('[data-testid=save-sentence]')
  await expect('a sentence with no citation shows No citation', `document.querySelector('[data-q=q-start] [data-testid=sentence]')?.dataset.state==='No citation'`)
  is('a sentence I wrote is marked Edited, and still counts as not approved', (await b.evaluate(`document.querySelector('[data-q=q-start] [data-testid=sentence]').dataset.dot`)) === 'edited' && /Edited/.test(await b.evaluate(`document.querySelector('[data-q=q-start] [data-testid=state-dot]').getAttribute('aria-label')`)))
  await pick('[data-q=q-start]')
  is('there is no plain Approve on it, only "Approve with a reason"', (await count('[data-q=q-start] [data-testid=approve]')) === 0 && (await count('[data-q=q-start] [data-testid=approve-reason]')) === 1)
  await click('[data-q=q-start] [data-testid=approve-reason]')
  is('the reason cannot be empty', await b.evaluate(`[...document.querySelectorAll('[data-testid=reason-field] button')].find(x=>x.innerText==='Approve').disabled`))
  await b.evaluate(setVal('[data-testid=reason-field] input', 'A framing line, not a finding.'))
  await clickText('[data-testid=reason-field] button', 'Approve')
  await expect('it becomes Approved without citation', `document.querySelector('[data-q=q-start] [data-testid=sentence]')?.dataset.state==='Approved without citation'`)
  r = await report()
  const reasoned = Object.values(r.approvals).find((a) => a.reason)
  is('the reason is stored with who and when', reasoned && reasoned.reason === 'A framing line, not a finding.' && reasoned.by === 'Maya Ortiz', reasoned)
  is('and logged', r.log.some((e) => /Without a citation: A framing line/.test(e.detail || '')))

  // Editing an approved sentence takes its approval away.
  await pick('[data-q=q-start]')
  await click('[data-q=q-start] [data-testid=edit-sentence]')
  await b.evaluate(setVal('[data-testid=sentence-editor] textarea', 'People wanted food to show up with no effort.', 'HTMLTextAreaElement'))
  await click('[data-testid=save-sentence]')
  await expect('editing an approved sentence puts it back to No citation (approval was of the old wording)', `document.querySelector('[data-q=q-start] [data-testid=sentence]')?.dataset.state==='No citation'`)

  // A live number in my own sentence, and an AI-vs-mine compare.
  await pick('[data-q=q-start]')
  await click('[data-q=q-start] [data-testid=edit-sentence]')
  await b.evaluate(`(()=>{const s=document.querySelector('[aria-label="Insert a live number"]');s.value='c-runout';s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
  await b.sleep(200)
  is('inserting a live number adds the token and its citation', /\{n:c-runout\} of \{of:c-runout\}/.test(await b.evaluate(`document.querySelector('[data-testid=sentence-editor] textarea').value`)) && /Code: Wanted to stop running out/.test(await text('[data-testid=sentence-editor]')))
  await click('[data-testid=save-sentence]')
  await expect('the sentence reads with the live count and is cited', `/5 of 20/.test(document.querySelector('[data-q=q-start] [data-testid=sentence]')?.innerText||'')&&document.querySelector('[data-q=q-start] [data-testid=sentence]').dataset.state==='To review'`)
  await click('[data-testid=tool-compare]')
  await expect('Compare opens as a large pop-up', `!!document.querySelector('[data-studio=compare]')`)
  is('Compare shows my draft against the AI draft with the changes', (await b.evaluate(`document.querySelector('[data-testid=compare-row][data-q=q-start]').dataset.differs`)) === 'true' && (await count('[data-q=q-start][data-testid=compare-row] [data-testid=compare-diff]')) === 1)
  is('and says which draft is in the report', /Mine in the report/.test(await text('[data-testid=compare-row][data-q=q-start]')))
  await clickText('[data-testid=compare-row][data-q=q-start] button', 'Use the AI draft')
  await expect('Use the AI draft changes which one is in the report', `/AI draft in the report/.test(document.querySelector('[data-testid=compare-row][data-q=q-start]')?.innerText||'')`)
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`)
  await expect('Escape closes the pop-up', `!document.querySelector('[data-testid=studio]')`)
  is('Tools says one differs', /1 differ/.test(await text('[data-testid=tool-state-compare]')), await text('[data-testid=tool-state-compare]'))

  // ── Live numbers change: a suggested update, never a silent rewrite ──
  await fresh()
  await click('[data-testid=primary-action]')
  await expect('Review mode opens', `!!document.querySelector('[data-studio=review]')`)
  is('Review mode starts at the first sentence with its sources', /Executive summary/.test(await text('[data-studio=review]')) && (await count('[data-studio=review] [data-testid=quote]')) >= 3)
  is('Review mode lists 17 to review', (await count('[data-testid=queue-item]')) === 17)
  await click('[data-testid=review-approve]')
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true})); true`)
  await expect('the A key approves the next cited sentence', `/^2 of 17 approved/.test(document.querySelector('[data-testid=review-progress]')?.innerText||'')`)
  for (let i = 0; i < 15; i++) { await click('[data-testid=review-approve]') }
  await expect('every sentence approved: Review mode says so', `!!document.querySelector('[data-testid=all-approved]')`)
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`)
  await expect('the primary button becomes Publish', `document.querySelector('[data-testid=primary-action]')?.innerText==='Publish'`)
  is('the status is Approved', /Approved/.test(await b.evaluate(`document.querySelector('h1')?.parentElement.innerText`)))
  await click('[data-testid=primary-action]')
  await expect('Publish opens the release checklist', `!!document.querySelector('[data-studio=release]')`)
  is('no blockers: ready', /Ready to publish/.test(await text('[data-testid=release-verdict]')), await text('[data-testid=release-verdict]'))
  is('every blocking check is ok', (await b.evaluate(`[...document.querySelectorAll('[data-testid=release-checks] li')].filter(l=>['approved','cited','numbers'].includes(l.dataset.check)).every(l=>l.dataset.ok==='true')`)))
  is('the advisory checks warn about 5 undecided tensions without blocking', /5 tensions still to decide/.test(await text('[data-testid=release-checks]')))
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`)

  // Change a number underneath an approved sentence: take one person out of "Price went up".
  await b.evaluate(`(()=>{const k=${q(CB)};const s=JSON.parse(localStorage.getItem(k));const c=s['pet-food-churn'].codes.find(c=>c.id==='c-price-rise');c.excerpts=c.excerpts.slice(0,-1);localStorage.setItem(k,JSON.stringify(s));return true})()`)
  await reload()
  const changed = (await b.evaluate(`[...document.querySelectorAll('[data-testid=sentence]')].filter(e=>e.dataset.state==='Needs update').length`))
  is('sentences using that count now say Needs update', changed >= 2, changed)
  const stillOld = await b.evaluate(`document.querySelector('[data-testid=exec-card] [data-testid=sentence]').innerText`)
  is('the wording was not silently rewritten (still says 8 of 20) and the sentence says the numbers changed', /8 of 20 people/.test(stillOld) && /Numbers changed/.test(stillOld), stillOld)
  await pick('[data-testid=exec-card]')
  is('the suggested update shows the new number (7 of 20)', /7 of 20/.test(await text('[data-testid=exec-card] [data-testid=suggested-update]')))
  is('a changed number means more to review and Publish is gone', /^Review \d+ sentences$/.test(await primary()), await primary())
  await click('[data-testid=exec-card] [data-testid=apply-update]')
  await expect('applying the update rewrites it and asks for a fresh approval', `/Price went up”: 7 of 20 people/.test(document.querySelector('[data-testid=exec-card] [data-testid=sentence]')?.innerText||'')&&document.querySelector('[data-testid=exec-card] [data-testid=sentence]').dataset.state==='To review'`)
  r = await report()
  is('and it is logged', r.log.some((e) => e.action === 'Updated numbers in a sentence'))
  // Keep as written, with a reason: the sentence stays as approved and the reason is kept.
  await click('[data-testid=toggle-all-sections]'); await b.sleep(200)
  if (!(await count('[data-testid=finding]'))) await click('[data-testid=toggle-all-sections]')
  await expect('expanded', `document.querySelectorAll('[data-testid=finding]').length===7`)
  await click('[data-q=q-cancel] [data-testid=sentence][data-state="Needs update"] [data-testid=sentence-text]')
  await clickText('[data-q=q-cancel] [data-testid=suggested-update] button', 'Keep as written')
  await b.evaluate(setVal('[data-testid=reason-field] input', 'The earlier count was agreed with the client.'))
  await clickText('[data-testid=reason-field] button', 'Keep and approve')
  await expect('Keep as written approves the old wording and notes why', `document.querySelector('[data-q=q-cancel] [data-testid=sentence]').dataset.state==='Approved'&&/Numbers kept as written by Maya Ortiz/.test(document.querySelector('[data-q=q-cancel]').innerText)`)
  r = await report()
  is('the kept-numbers reason is stored', Object.values(r.approvals).some((a) => a.keptNumbers && /agreed with the client/.test(a.keptNumbers.why)))

  // ── A broken citation: a code rejected in the codebook ──
  await fresh()
  await b.evaluate(`(()=>{const k=${q(CB)};const s=JSON.parse(localStorage.getItem(k));s['pet-food-churn'].codes.find(c=>c.id==='c-nothing').status='Rejected';localStorage.setItem(k,JSON.stringify(s));return true})()`)
  await reload()
  is('the summary is built from approved codes, so it drops the sentence whose only code was rejected', !/nothing the company could have done/.test(await text('[data-testid=exec-card]')) && (await count('[data-testid=exec-card] [data-testid=sentence]')) === 4, await text('[data-testid=exec-card]'))
  await click('[data-testid=toggle-all-sections]')
  is('the finding that cited it shows No citation', (await count('[data-testid=finding] [data-testid=sentence][data-state="No citation"]')) === 1)
  await click('[data-testid=finding] [data-testid=sentence][data-state="No citation"] [data-testid=sentence-text]'); await b.sleep(300)
  is('and says why', /is rejected in the codebook/.test(await text('[data-testid=sentence-tray]')))
  is('it is flagged in the prose as well, without a click', /No citation/.test(await b.evaluate(`document.querySelector('[data-testid=finding] [data-testid=sentence][data-state="No citation"]').innerText`)))

  // ── Publish stays blocked until every sentence is approved and cited (or a reason is logged) ──
  is('with sentences to review the primary button is not Publish', (await primary()) !== 'Publish' && /^Review \d+ sentences$/.test(await primary()), await primary())
  await click('[data-testid=tool-release]')
  await expect('the publish checklist opens', `!!document.querySelector('[data-studio=release]')`)
  is('it says Not ready and the Publish button is disabled', /Not ready/.test(await text('[data-testid=release-verdict]')) && (await b.evaluate(`document.querySelector('[data-testid=publish-v1]').disabled`)), await text('[data-testid=release-verdict]'))
  is('"approved" and "cited" are both failing checks', (await b.evaluate(`['approved','cited'].every(k=>document.querySelector('[data-check='+k+']').dataset.ok==='false')`)))
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`)
  await b.sleep(300)
  // Approve everything that can be approved plainly: one uncited sentence is left, and it alone still blocks.
  await click('[data-testid=primary-action]')
  await expect('Review mode', `!!document.querySelector('[data-studio=review]')`)
  for (let i = 0; i < 20; i++) {
    if (!(await count('[data-testid=queue-item][data-state="To review"]'))) break
    await b.evaluate(`document.querySelector('[data-testid=queue-item][data-state="To review"]').click(); true`)
    await b.sleep(150)
    if (await count('[data-testid=review-approve]')) await click('[data-testid=review-approve]')
  }
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(300)
  is('one uncited sentence left (a finding’s): still Review 1 sentence, never Publish', (await primary()) === 'Review 1 sentence', await primary())
  await click('[data-testid=tool-release]')
  await expect('checklist again', `!!document.querySelector('[data-studio=release]')`)
  is('the one that blocks is the citation: the check fails and Publish is disabled', (await b.evaluate(`document.querySelector('[data-check=cited]').dataset.ok`)) === 'false' && /Not ready/.test(await text('[data-testid=release-verdict]')) && (await b.evaluate(`document.querySelector('[data-testid=publish-v1]').disabled`)))
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(300)
  await click('[data-testid=report] [data-testid=finding] [data-testid=sentence][data-state="No citation"] [data-testid=sentence-text]')
  await click('[data-testid=approve-reason]')
  await b.evaluate(setVal('[data-testid=reason-field] input', 'Context line for the client.'))
  await clickText('[data-testid=reason-field] button', 'Approve')
  await expect('and only when the last one has a reason does the primary button become Publish', `document.querySelector('[data-testid=primary-action]')?.innerText==='Publish'`)
  await click('[data-testid=primary-action]')
  await expect('the checklist is ready', `/Ready to publish/.test(document.querySelector('[data-testid=release-verdict]')?.innerText||'')`)
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(300)
  await fresh()
  await b.evaluate(`(()=>{const k=${q(CB)};const s=JSON.parse(localStorage.getItem(k));s['pet-food-churn'].codes.find(c=>c.id==='c-nothing').status='Rejected';localStorage.setItem(k,JSON.stringify(s));return true})()`)
  await reload()
  await click('[data-testid=primary-action]')
  await expect('Review mode', `!!document.querySelector('[data-studio=review]')`)
  is('Review mode offers only "Approve with a reason" for it', await b.poll(`(()=>{ [...document.querySelectorAll('[data-testid=queue-item]')].find(x=>/nothing would have kept them/.test(x.innerText))?.click(); return true })()`) && (await b.poll(`!document.querySelector('[data-testid=review-approve]')&&!!document.querySelector('[data-testid=review-approve-reason]')`)))
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`)

  // An Unanswered finding: nothing accepted under the question.
  await fresh()
  await b.evaluate(`(()=>{const k=${q(CB)};const s=JSON.parse(localStorage.getItem(k));s['pet-food-churn'].codes.find(c=>c.id==='c-stable-price').status='Rejected';localStorage.setItem(k,JSON.stringify(s));return true})()`)
  await reload()
  await click('[data-testid=toggle-all-sections]')
  is('with nothing accepted under it, the finding is Unanswered and says so', (await b.evaluate(`document.querySelector('[data-q=q-back]').dataset.strength`)) === 'Unanswered' && /Unanswered: no accepted codes cover this question/.test(await b.evaluate(`document.querySelector('[data-q=q-back]').innerText`)))
  is('and its sentence has no citation left', (await b.evaluate(`document.querySelector('[data-q=q-back] [data-testid=sentence]').dataset.state`)) === 'No citation')

  // ── Tension decisions are the same decisions as in A2; dismissed ones never appear ──
  await fresh()
  await click('[data-testid=toggle-all-sections]')
  await openDetails()
  const tn = await b.evaluate(`[...document.querySelectorAll('[data-testid=tension]')].map(e=>e.innerText.split(String.fromCharCode(10)).filter(Boolean)[1])`)
  is('related tensions are listed on findings', tn.length >= 1, tn)
  const title = tn[0]
  await clickText('[data-testid=tension] button', 'Dismiss…')
  await b.evaluate(setVal('[data-testid=reason-field] input', 'Too few people to read.'))
  await clickText('[data-testid=reason-field] button', 'Dismiss')
  await expect('the dismissed tension disappears from the report', `![...document.querySelectorAll('[data-testid=tension]')].some(e=>e.innerText.includes(${q(title)}))`)
  const dm = await codebook()
  const entry = Object.entries(dm.tensions).find(([, v]) => v.why === 'Too few people to read.' && v.status === 'Dismissed')
  is('it is the same decision as in A2: stored in the codebook with who, when and why', entry && entry[1].by === 'Maya Ortiz' && /^\d{4}-/.test(entry[1].at), entry)
  is('and in the codebook change log', dm.log.some((e) => e.target.kind === 'tension' && e.action === 'Dismissed' && e.why === 'Too few people to read.'))
  await b.goto(`${STUDY}/signals?tab=tensions`); await b.waitFor('Emotion & behaviour'); await b.sleep(1200)
  await b.evaluate(`(()=>{const e=[...document.querySelectorAll('button,[role=tab]')].find(x=>/^Dismissed/.test(x.innerText.trim()));e&&e.click();return true})()`)
  await b.sleep(400)
  is('Emotion & behaviour shows it as dismissed', (await b.evaluate('document.body.innerText')).includes(title))

  // ── Leave a finding out; put it back ──
  await reload()
  await click('[data-testid=toggle-all-sections]')
  await click('[data-q=q-schedule] [data-testid=finding-more]')
  await click('[data-q=q-schedule] [data-testid=omit-finding]')
  await b.evaluate(setVal('[data-testid=reason-field] input', 'Only asked of some people.'))
  await clickText('[data-testid=reason-field] button', 'Leave out')
  await expect('a finding left out is marked and its sentences stop counting', `document.querySelector('[data-q=q-schedule]').dataset.omitted==='true'&&/16 to review/.test(document.querySelector('[data-testid=report-status]').innerText)`)
  await clickText('[data-q=q-schedule] button', 'Put back')
  await expect('putting it back counts it again', `/17 to review/.test(document.querySelector('[data-testid=report-status]').innerText)`)

  // ── Tools: Highlights opens the Explore drawer; an unbuilt tool says so honestly ──
  await click('[data-testid=tool-highlights]')
  await expect('Highlights opens the Explore drawer on its tab', `document.querySelector('[data-testid=explore-tab-highlights]')?.getAttribute('aria-selected')==='true'`)
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`)
  await b.sleep(300)
  await click('[data-testid=tool-theme-map]')
  await expect('an unbuilt tool opens a pop-up that says it is not built yet', `/Not built yet in the prototype/.test(document.querySelector('[data-studio=theme-map]')?.innerText||'')`)
  is('and it lists what it would be built on with real counts', /20 accepted sessions/.test(await text('[data-testid=coming-studio]')))
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`)

  // ── Regenerate the AI draft ──
  await click('[data-testid=exec-card] [data-testid=regenerate]')
  await expect('regenerating shows progress, then fresh sentences', `/Regenerating/.test(document.querySelector('[data-testid=exec-card] [data-testid=regenerate]')?.innerText||'')`, 1500)
  await expect('and finishes', `/^Regenerate$/.test(document.querySelector('[data-testid=exec-card] [data-testid=regenerate]')?.innerText||'')`)

  // ── Error and empty states ──
  await b.goto(`${STUDY}/report?demo=error`); await b.waitFor('The report didn’t load')
  await clickText('button', 'Try again')
  await b.waitFor('EXECUTIVE SUMMARY')
  out.checks['the error state retries into the report'] = true
}
