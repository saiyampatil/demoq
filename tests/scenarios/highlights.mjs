// Explore drawer, Highlights tab (brief step 7) on the Pet Food study. Every check waits on state and throws when it fails.
// Run: npx vite --port 5199 --strictPort &   then   node tests/setup-flow.mjs hl highlights
const STUDY = '/researcher/studies/pet-food-churn/analysis'
const KEY = 'pulseai-qual:codebook'
const setIn = (sel, v) => `(()=>{const i=document.querySelector(${JSON.stringify(sel)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(v)});i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`

export default async ({ b, out }) => {
  out.checks = {}
  const fail = (label) => {
    console.error(JSON.stringify(out, null, 1))
    throw new Error(`FAILED: ${label}`)
  }
  const expect = async (label, expr, ms = 6000) => {
    const ok = await b.poll(expr, ms)
    out.checks[label] = !!ok
    if (!ok) fail(label)
    return ok
  }
  const is = (label, cond, detail) => {
    out.checks[label] = !!cond
    if (!cond) {
      if (detail !== undefined) out[`detail: ${label}`] = detail
      fail(label)
    }
  }
  const click = async (sel) => {
    const ok = await b.poll(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e||e.disabled)return false;e.click();return true})()`)
    if (!ok) fail(`nothing to click for ${sel}`)
    await b.sleep(250)
  }
  const doc = () => b.evaluate(`(()=>{const s=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})||'{}')['pet-food-churn'];return s?{codes:s.codes.length,log:s.log.length,dismissed:s.dismissedSuggestions,added:Object.keys(s.addedExcerpts||{}).length}:null})()`)
  const fresh = async (path = 'codebook') => {
    await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
    await b.goto(`${STUDY}/${path}`); await b.waitFor('Explore'); await b.sleep(500)
  }
  const openDrawer = async () => {
    await click('[data-testid=explore-open]')
    await expect('the drawer opens on the Highlights tab', `document.querySelector('[data-testid=explore-tab-highlights]')?.getAttribute('aria-selected')==='true'&&!!document.querySelector('[data-testid=highlights]')`)
  }
  const type = async (v) => { await b.evaluate(setIn('[data-testid=idea-input]', v)) }
  // After typing: wait out the 300 ms of quiet and the mock scan, then wait for an outcome with no scan in flight.
  const results = async () => {
    await b.sleep(900)
    return b.poll(`!document.querySelector('[data-testid=scanning]')&&(!!document.querySelector('[data-testid=results]')||!!document.querySelector('[data-testid=no-matches]')||!!document.querySelector('[data-testid=idea-dismissed]'))`, 5000)
  }

  // ── The same drawer opens on A1, A2 and A3, on Highlights ──
  for (const [path, label] of [['codebook', 'A1 Codebook'], ['signals', 'A2 Emotion & behaviour'], ['report', 'A3 Report']]) {
    await fresh(path)
    await openDrawer()
    out.checks[`${label} has the Explore drawer on Highlights`] = true
    await click('[data-testid=explore-tab-ask]')
    await expect(`${label}: Ask is a placeholder`, `/Ask: coming next/.test(document.querySelector('[data-testid=coming-next]')?.innerText||'')`)
    await click('[data-testid=explore-tab-numbers]')
    await expect(`${label}: Numbers is a placeholder`, `/Numbers: coming next/.test(document.querySelector('[data-testid=coming-next]')?.innerText||'')`)
    await click('[data-testid=explore-tab-highlights]')
    await expect(`${label}: Highlights is back`, `!!document.querySelector('[data-testid=highlights]')`)
  }

  // ── Current codes ──
  await fresh('codebook')
  await openDrawer()
  const accepted = await b.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}))['pet-food-churn'].codes.filter(c=>c.status==='Accepted').length`)
  is('current codes lists every accepted code', (await b.evaluate(`document.querySelectorAll('[data-testid=current-code]').length`)) === accepted, accepted)
  is('each current code says n of N people', await b.evaluate(`[...document.querySelectorAll('[data-testid=current-code]')].every(e=>/\\d+ of \\d+ people/.test(e.innerText))`))
  await b.evaluate(setIn('[aria-label="Search the current codes"]', 'pause'))
  await b.sleep(250)
  is('the search box narrows the list', (await b.evaluate(`document.querySelectorAll('[data-testid=current-code]').length`)) > 0 && (await b.evaluate(`document.querySelectorAll('[data-testid=current-code]').length`)) < accepted)
  await b.evaluate(setIn('[aria-label="Search the current codes"]', ''))

  // ── Typing a known idea: the scan waits, scans, finds the known quote ──
  const before = await doc()
  const t0 = Date.now()
  await type('pause when we travel')
  await b.sleep(120)
  is('the scan does not start before 300 ms of quiet', !(await b.evaluate(`!!document.querySelector('[data-testid=scanning]')`)))
  await expect('the loading state names how many interviews are scanned', `/Scanning 20 accepted interviews…/.test(document.querySelector('[data-testid=scanning]')?.innerText||'')`, 3000)
  await results()
  is('results appear after the mock delay', Date.now() - t0 >= 600, Date.now() - t0)
  const quotes = await b.evaluate(`[...document.querySelectorAll('[data-testid=results] [data-testid=quote]')].map(q=>({text:q.dataset.text,participant:q.dataset.participant,session:q.dataset.session,at:Number(q.dataset.at),body:q.innerText.replace(/\\s+/g,' ')}))`)
  is('there are at most ten quotes, and some', quotes.length > 0 && quotes.length <= 10, quotes.length)
  const known = quotes.find((q) => q.text === 'Pause. It solves the travel problem.')
  is('the known quote is found', !!known, quotes.map((q) => q.text))
  const truth = await b.evaluate(`import('/src/mock/codebook.ts').then(m=>{const e=Object.values(m.EXCERPTS).find(x=>x.text==='Pause. It solves the travel problem.'&&x.participantId==='P-3109');return e?{session:e.sessionId,at:e.atSec,pet:m.petOf(e.participantId)}:null})`)
  is('the quote has the right participant, session and timestamp', known.participant === 'P-3109' && known.session === truth.session && known.at === truth.at, { known, truth })
  is('each quote shows participant, pet type, session, timestamp and its guide question', quotes.every((q) => /P-\d+ (Dog|Cat) owner P-\d+-\d+ \d+:\d\d \S/.test(q.body)), quotes.map((q) => q.body))
  is('each quote has a Play link to that moment', await b.evaluate(`[...document.querySelectorAll('[data-testid=results] [data-testid=quote] a')].every(a=>/\\/session\\//.test(a.getAttribute('href'))&&/at=\\d+/.test(a.getAttribute('href')))`))
  is('no score or judgement about a person is shown', !/score|confidence|relevance|%/i.test(await b.evaluate(`document.querySelector('[data-testid=results]').innerText`)))
  // Never invent text: each quote is a whole participant turn, word for word.
  const exact = await b.evaluate(`import('/src/mock/review.ts').then(m=>[...document.querySelectorAll('[data-testid=results] [data-testid=quote]')].every(q=>m.transcriptFor(q.dataset.session,'reviewed').some(t=>t.speaker==='Participant'&&t.text===q.dataset.text&&t.atSec===Number(q.dataset.at))))`)
  is('every quote is an exact participant turn of the transcript, at that timestamp', exact)
  is('the proposed code is tagged AI-generated and named from the idea', await b.evaluate(`(()=>{const p=document.querySelector('[data-testid=proposal]');return /AI-generated/.test(p.innerText)&&p.querySelector('[data-testid=proposal-name]').value==='Pause when we travel'})()`))
  const people = await b.evaluate(`new Set([...document.querySelectorAll('[data-testid=results] [data-testid=quote]')].map(q=>q.dataset.participant)).size`)
  is('the proposal counts the distinct people', (await b.evaluate(`document.querySelector('[data-testid=proposal-count]').innerText`)).startsWith(`${people} people`), people)
  is('scanning changed nothing', JSON.stringify(await doc()) === JSON.stringify(before), { before, after: await doc() })

  // ── An excluded session never appears ──
  const excluded = await b.evaluate(`import('/src/mock/signals.ts').then(async s=>{const p=await import('/src/mock/sessions.ts');return p.PET_SEED_SESSIONS.filter(x=>x.variant==='done'&&x.review?.status==='Excluded').map(x=>x.participant)})`)
  is('the study has excluded sessions to test against', excluded.length >= 2, excluded)
  const generic = await b.evaluate(`import('/src/mock/review.ts').then(async m=>{const s=await import('/src/mock/signals.ts');const id=s.sessionOfParticipant(${JSON.stringify(excluded[0])});return m.transcriptFor(id,'reviewed').filter(t=>t.speaker==='Participant').map(t=>t.text)})`)
  const idea = generic.find((t) => t.split(/\s+/).length >= 6) ?? generic[0]
  await type(idea)
  await results()
  const whose = await b.evaluate(`[...document.querySelectorAll('[data-testid=results] [data-testid=quote]')].map(q=>q.dataset.participant)`)
  is('that wording is found in accepted interviews', whose.length > 0, { idea, whose })
  is('no result comes from an excluded session', whose.every((p) => !excluded.includes(p)), { whose, excluded })

  // ── Empty and error states ──
  await type('zzzxqv')
  await results()
  const nm = await b.evaluate(`document.querySelector('[data-testid=no-matches]')?.innerText.trim()`)
  is('no matches says what to do', nm === 'No matches in the accepted interviews for this wording. Try a different word.', { nm, body: await b.evaluate(`document.querySelector('[data-testid=highlights]')?.innerText.slice(-400)`) })

  // ── Dismiss leaves nothing behind, and is not offered again ──
  const beforeDismiss = await doc()
  await type('vet')
  await results()
  await click('[data-testid=dismiss-idea]')
  const afterDismiss = await doc()
  is('dismiss adds no code and no log entry', afterDismiss.codes === beforeDismiss.codes && afterDismiss.log === beforeDismiss.log && afterDismiss.added === beforeDismiss.added, { beforeDismiss, afterDismiss })
  is('the dismissed idea is remembered', afterDismiss.dismissed.some((k) => k.startsWith('hl:')), afterDismiss.dismissed)
  await type('Vets')
  await results()
  is('the same idea, worded differently, is not offered again', await b.evaluate(`!!document.querySelector('[data-testid=idea-dismissed]')&&!document.querySelector('[data-testid=proposal]')`))
  await click('[data-testid=idea-restore]')
  await expect('offering it again brings the proposal back', `!!document.querySelector('[data-testid=proposal]')`)
  await type('')

  // ── Accept: one code, one log entry, the codebook moves at once ──
  await type('pause when we travel')
  await results()
  const shown = await b.evaluate(`document.querySelector('[data-testid=proposal-count]').innerText`)
  const beforeAccept = await doc()
  const beforeCount = await b.evaluate(`Number(document.querySelector('[data-testid=current-codes-count]').innerText.match(/\\d+/)[0])`)
  await b.evaluate(setIn('[data-testid=proposal-name]', 'Pause as a reason to stay'))
  await click('[data-testid=accept-idea]')
  await expect('a toast says what changed', `[...document.querySelectorAll('[data-testid=toast]')].some(t=>/Added code “Pause as a reason to stay”, \\d+ people/.test(t.innerText))`)
  const afterAccept = await doc()
  is('accept adds exactly one code', afterAccept.codes === beforeAccept.codes + 1, { beforeAccept, afterAccept })
  is('accept adds exactly one log entry', afterAccept.log === beforeAccept.log + 1, { beforeAccept, afterAccept })
  is('the quotes are kept with the codebook', afterAccept.added > 0, afterAccept)
  await expect('the current codes list gains it at once', `Number(document.querySelector('[data-testid=current-codes-count]').innerText.match(/\\d+/)[0])===${beforeCount + 1}&&[...document.querySelectorAll('[data-testid=current-code]')].some(e=>/Pause as a reason to stay/.test(e.innerText))`)
  const nPeople = Number(shown.match(/^(\d+) people/)?.[1])
  is('the new code shows the same number of people the proposal did', await b.evaluate(`[...document.querySelectorAll('[data-testid=current-code]')].find(e=>/Pause as a reason to stay/.test(e.innerText))?.innerText.includes(${JSON.stringify(`${nPeople} of `)})`), shown)
  const entry = await b.evaluate(`(()=>{const l=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}))['pet-food-churn'].log[0];return l})()`)
  is('the log entry says who, what and why', entry.by === 'Maya Ortiz' && entry.action === 'Accepted' && entry.target.name === 'Pause as a reason to stay' && /pause when we travel/i.test(entry.why) && !!entry.at, entry)

  // ── It survives a refresh and shows in the codebook, the signals and the report ──
  await b.goto(`${STUDY}/codebook`); await b.waitFor('Explore'); await b.sleep(600)
  await b.evaluate(`[...document.querySelectorAll('[role=group] button')].find(x=>/^Accepted/.test(x.innerText.trim()))?.click(); true`); await b.sleep(400)
  is('after a refresh the Codebook tab lists it', (await b.evaluate(`document.body.innerText`)).includes('Pause as a reason to stay'))
  await b.goto(`${STUDY}/signals`); await b.waitFor('What stands out'); await b.sleep(400)
  is('Emotion & behaviour still loads with the new code', (await b.evaluate(`document.body.innerText`)).includes('Pause as a reason to stay'))
  await b.goto(`${STUDY}/report`); await b.waitFor('Explore'); await b.sleep(600)
  is('the Report still loads', (await b.evaluate(`document.body.innerText`)).includes('Built on'))

  // ── The error state, and its retry ──
  await b.goto(`${STUDY}/codebook?demo=explore-error`); await b.waitFor('Explore'); await b.sleep(500)
  await openDrawer()
  await type('pause')
  await expect('a failed scan shows a banner with a retry', `/The scan didn’t finish/.test(document.querySelector('[role=alert]')?.innerText||'')&&!!document.querySelector('[data-testid=scan-retry]')`, 4000)
  await click('[data-testid=scan-retry]')
  await expect('retry scans again and shows results', `!!document.querySelector('[data-testid=results]')`, 4000)

  out.invariants = await b.evaluate('window.__invariants')
  is('invariants hold', !out.invariants?.length)
}
