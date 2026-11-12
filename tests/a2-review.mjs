// A2 Emotion & behaviour: the seven review fixes. Every step waits on state and every expectation is asserted.
//   1 faces lead with what was seen, then "reads as"      2 ties are said as ties          3 one vocabulary (positive, neutral, negative, unclear)
//   4 the Conflicting rule is on screen and is the rule   5 dog and cat: one note, not one per row
//   6 timestamps vary and Play lands on the quoted turn   7 dismiss, correct, excluded and quality-flagged sessions
//   npx vite --port 5199 --strictPort &   then   node tests/a2-review.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/pet-food-churn/analysis'
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail ? `${label} (${detail})` : label)
}
const text = (sel) => b.evaluate(`document.querySelector(${JSON.stringify(sel)})?.innerText.replace(/\\s+/g,' ') ?? null`)
const all = (sel) => b.evaluate(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e=>e.innerText.replace(/\\s+/g,' '))`)
const click = async (sel) => {
  const done = await b.poll(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e||e.disabled)return false;e.click();return true})()`)
  if (!done) throw new Error(`nothing to click for ${sel}`)
  await b.sleep(350)
}
const clickText = async (sel, label) => {
  const done = await b.poll(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.innerText.trim().replace(/\\s+/g,' ').startsWith(${JSON.stringify(label)}));if(!e||e.disabled)return false;e.click();return true})()`)
  if (!done) throw new Error(`nothing to click for ${sel} "${label}"`)
  await b.sleep(350)
}
const setText = (sel, v) => `(() => { const t=document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${JSON.stringify(v)}); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`
// Modules are imported by the exact URL the app loaded (the dev server adds ?t= after an edit), so they are the app's own instances.
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const withMod = (expr) => b.evaluate(MOD + '; ' + expr)
const fresh = async () => {
  await b.goto('/researcher')
  await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${root}/signals?view=code`)
  await b.waitFor('What stands out')
  await b.sleep(500)
}

try {
  await fresh()

  // ── 6 (data). Timestamps: varied, unique where they were not, and each one is a real turn ──
  const data = await withMod(`(async () => {
    const cb = await window.__mod('/src/mock/codebook'), rv = await window.__mod('/src/mock/review'), sg = await window.__mod('/src/mock/signals')
    const out = { quoteOff: [], dupCode: [], dupMoment: [], notParticipantTurn: [], concept: [], clock: 0, pts: 0 }
    for (const e of Object.values(cb.EXCERPTS)) {
      const t = rv.transcriptFor(e.sessionId, 'reviewed')[e.turnIndex]
      if (!t || t.atSec !== e.atSec || t.text !== e.text) out.quoteOff.push(e.id)
    }
    for (const c of cb.SEED_CODES) {
      const seen = new Map()
      for (const id of c.excerpts) { const e = cb.EXCERPTS[id]; if (seen.has(e.atSec)) out.dupCode.push(c.id + ':' + e.participantId + '=' + seen.get(e.atSec)); seen.set(e.atSec, e.participantId) }
    }
    for (const m of sg.MOMENTS) {
      const seen = new Map()
      for (const p of sg.momentPoints(m.id)) {
        out.pts++
        if (p.atSec % 30 === 0) out.clock++
        if (seen.has(p.atSec)) out.dupMoment.push(m.id + ':' + p.participantId + '=' + seen.get(p.atSec)); seen.set(p.atSec, p.participantId)
        const turns = rv.transcriptFor(p.sessionId, 'raw')
        if (!turns.some((x) => x.atSec === p.atSec && x.speaker === 'Participant')) out.notParticipantTurn.push(m.id + ':' + p.participantId)
        if (m.kind === 'stimulus') {
          const rec = rv.findReviewRecord(p.sessionId)
          const card = rec.stimuli.find((s) => s.name.startsWith('Concept ' + m.id.slice(-1).toUpperCase()))
          const ci = turns.findLastIndex((x) => x.atSec <= card.shownAtSec)
          const at = turns.findIndex((x) => x.atSec === p.atSec)
          if (at < ci + 1 || at > ci + 5) out.concept.push(m.id + ':' + p.participantId + ' card turn ' + ci + ' reaction turn ' + at)
        }
      }
    }
    return out
  })()`)
  ok('every quote’s time is the time of the transcript turn it quotes', data.quoteOff.length === 0, data.quoteOff.join(', '))
  ok('no two people share a second within one code', data.dupCode.length === 0, data.dupCode.join(', '))
  ok('no two people share a second within one moment', data.dupMoment.length === 0, data.dupMoment.join(', '))
  ok('every moment lands on a participant turn', data.notParticipantTurn.length === 0, data.notParticipantTurn.join(', '))
  ok('a concept’s first reaction is the answer just after its card was shown (never minutes later)', data.concept.length === 0, data.concept.join(', '))
  ok('times are not bunched on :00 and :30', data.clock / data.pts < 0.08, `${data.clock} of ${data.pts}`)

  // ── 1. Faces: what was seen first, then what it reads as ──
  await clickText('[data-testid=signal-row]', 'Pause would have kept them'); await b.sleep(300)
  const faceTexts = await all('[data-testid=face-reading]')
  ok('every face reading leads with Seen at <time> and then says reads as', faceTexts.length >= 3 && faceTexts.every((t) => /^Seen at \d+:\d\d \([\d.]+ s in\): .+ reads as [A-Z]/.test(t)), faceTexts[0])
  ok('the old wording is gone from the panel', !/Seen: /.test((await text('[data-testid=signal-panel]')) ?? ''))
  ok('the code panel says how many faces read as the top emotion, never "Doubt in"', /\d+ of \d+ faces read as \w+|tie: \d+ of \d+ faces each/.test((await text('[data-testid=channel-face]')) ?? ''), await text('[data-testid=channel-face]'))
  await click('[data-testid=how-faces]')
  ok('"How faces are read" says a reading is an interpretation that can be corrected', /interpretation/.test((await text('[data-testid=how-faces-note]')) ?? '') && /correct/.test((await text('[data-testid=how-faces-note]')) ?? ''))
  const stands = await all('[data-testid=standout]')
  ok('What stands out words faces as "read as"', stands.some((s) => /faces read as delight or interest/.test(s)) || stands.some((s) => /tie for the most positive/.test(s)), stands.join(' | '))
  await click('[data-testid=lens-emotion]')
  const summaries = await all('[data-testid=signal-row]')
  ok('by-code rows say "read as" or "Tied", not a bare emotion name', summaries.some((r) => /\d+ of \d+ read as \w+/.test(r)), summaries.slice(0, 3).join(' | '))

  // ── 3. One vocabulary: positive, neutral, negative, unclear; confusion is its own group ──
  const key = await text('[data-testid=valence-key]')
  ok('a legend says how each emotion is grouped, with confusion on its own', /positive: Delight, Interest/.test(key ?? '') && /negative: Doubt, Frustration/.test(key ?? '') && /unclear: Confusion/.test(key ?? '') && /neutral: Surprise, Neutral/.test(key ?? ''), key)
  const emoCounts = await all('[data-testid=valence-counts]')
  ok('the code panel counts positive, neutral, negative and unclear', emoCounts.length >= 1 && emoCounts.every((t) => /\d+ positive · \d+ neutral · \d+ negative · \d+ unclear/.test(t)), emoCounts.join(' | '))
  await click('[data-testid=view-moment]')
  const byMoment = await text('main')
  ok('By moment no longer says warm or cold', !/\b(warm|cold|warmest)\b/i.test(byMoment ?? ''), (byMoment?.match(/.{30}\b(warm|cold|warmest)\b.{20}/i) ?? [])[0])
  await clickText('[data-testid=moment-row]', 'First reaction: Concept B')
  await b.sleep(300)
  const mpB = await text('[data-testid=moment-panel]')
  const confusion = Number((await text('[data-testid=moment-emotions]'))?.match(/Confusion (\d+)/)?.[1] ?? 0)
  const unclearB = Number(mpB?.match(/(\d+) unclear/)?.[1] ?? -1)
  const negB = Number(mpB?.match(/(\d+) negative/)?.[1] ?? -1)
  const faceNeg = await withMod(`(async()=>{const sg=await window.__mod('/src/mock/signals');return sg.momentPoints('m-concept-b').filter(p=>p.face&&['Doubt','Frustration'].includes(p.face.emotion)).length})()`)
  ok('Concept B’s confusion is counted as unclear, not negative', confusion > 0 && unclearB === confusion && negB === faceNeg, `confusion ${confusion}, unclear ${unclearB}, negative ${negB} vs doubt+frustration ${faceNeg}`)
  const rowsNow = await all('[data-testid=moment-row]')
  const sums = rowsNow.map((r) => r.match(/(\d+) positive · (\d+) neutral · (\d+) negative · (\d+) unclear of (\d+)/)).filter(Boolean)
  ok('on every row the four groups add up to the faces read', sums.length === rowsNow.length && sums.every((m) => +m[1] + +m[2] + +m[3] + +m[4] === +m[5]), sums.map((m) => m[0]).join(' | '))

  // ── 2. Ties: a tie is said as a tie ──
  await click('[data-testid=lens-hesitation]')
  const hesRows = await all('[data-testid=moment-row]')
  const marked = hesRows.map((r) => ({ n: Number(r.match(/(\d+) marked/)?.[1]), of: Number(r.match(/steady of (\d+)/)?.[1]), tagged: /Most hesitation/.test(r), label: r.slice(0, 40) }))
  const top = Math.max(...marked.filter((m) => m.of >= 10).map((m) => m.n))
  const expected = marked.filter((m) => m.of >= 10 && m.n === top)
  ok('more than one moment shares the top count in this study (the case being fixed)', expected.length >= 2, JSON.stringify(marked))
  ok('every moment that shares the top count is tagged Most hesitation, and no other', marked.every((m) => m.tagged === (m.of >= 10 && m.n === top)), JSON.stringify(marked))
  ok('a note says they tie', /Tied for the most hesitation/.test((await text('[data-testid=tie-note]')) ?? '') && new RegExp(`${expected.length} moments`).test((await text('[data-testid=tie-note]')) ?? ''), await text('[data-testid=tie-note]'))
  await click('[data-testid=view-code]')
  await b.sleep(300)
  const stand2 = await all('[data-testid=standout]')
  const tie = stand2.find((s) => /tie for the most hesitation/.test(s))
  ok('What stands out says the moments tie and lists each with n of N', !!tie && expected.every((m) => tie.includes(`${m.n} of ${m.of}`)) && !/the most of any moment/.test(stand2.join(' ')), stand2.join(' | '))

  // ── 4. Words vs delivery: the rule is on screen, and it is the rule the code uses ──
  const rule = await text('[data-testid=fit-rule]')
  const rl = await withMod(`(async()=>{const e=await window.__mod('/src/state/emotion');return e.FIT_RULE})()`)
  ok('the Conflicting rule is stated beside the Words vs delivery column', /Conflicting: 4 in 10 or more/.test(rule ?? '') && /Mixed: 3 in 10 or more/.test(rule ?? '') && rl.conflicting === 0.4 && rl.mixed === 0.3, rule)
  await click('[data-testid=lens-emotion]')
  const rowCount = (await all('[data-testid=signal-row]')).length
  let verdicts = 0
  const wrong = []
  for (let i = 0; i < rowCount; i++) {
    await b.evaluate(`document.querySelectorAll('[data-testid=signal-row]')[${i}].click(); true`)
    await b.sleep(120)
    const chip = (await b.evaluate(`document.querySelectorAll('[data-testid=fit-cell]')[${i}].innerText.trim()`)) ?? ''
    const verdict = (await text('[data-testid=fit-verdict]')) ?? ''
    const m = verdict.match(/For (\d+) of (\d+),.*?(?:\((\d+) clearly\))?\./)
    const clean = verdict.match(/fits the words for all (\d+)/)
    if (!m && !clean) continue
    verdicts++
    const n = m ? +m[2] : +clean[1]
    const against = m ? +m[1] : 0
    const doesnt = m && m[3] ? +m[3] : 0
    const want = n < rl.min ? 'Too few to read' : doesnt / n >= rl.conflicting ? 'Conflicting' : against / n >= rl.mixed ? 'Mixed' : 'Consistent'
    if (chip !== want) wrong.push(`${chip} should be ${want} (${against} of ${n}, ${doesnt} clearly)`)
  }
  ok('every code’s Words vs delivery label follows the stated rule', verdicts >= 8 && wrong.length === 0, `${verdicts} checked: ${wrong.join('; ')}`)

  // Denominators in a theme roll-up trace back to the people in it.
  await b.goto(`${root}/codebook?tab=themes`); await b.waitFor('New theme'); await b.sleep(500)
  await b.evaluate(`(()=>{const s=[...document.querySelectorAll('[data-testid=theme-suggestion]')].find(x=>/Wanting control/.test(x.innerText));s.querySelector('[data-testid=accept-theme]').click();return true})()`)
  await b.sleep(500)
  await b.goto(`${root}/signals?view=code`); await b.waitFor('What stands out'); await b.sleep(500)
  const rolls = await all('[data-testid=theme-rollup]')
  ok('a roll-up counts faces as read of the people in the theme, and the groups add up', rolls.length >= 3 && rolls.every((r) => {
    const m = r.match(/Faces read for (\d+) of (\d+).*?: (\d+) positive, (\d+) neutral, (\d+) negative, (\d+) unclear/)
    return m && +m[3] + +m[4] + +m[5] + +m[6] === +m[1] && +m[1] <= +m[2]
  }), rolls.join(' | '))
  const hi = await text('[data-testid=theme-highlight]')
  const hm = hi?.match(/Of the (\d+) who spoke for it, (\d+) showed doubt or frustration on their face \((\d+)\) or marked hesitation without it \((\d+)\)/)
  const roll = (await all('[data-testid=theme-rollup]')).find((r) => /Of the \d+ who spoke for it/.test(r))
  const people = Number(roll?.match(/^(\d+) people/)?.[1])
  ok('the warning’s numbers add up, and anyone outside "who spoke for it" is named', !!hm && +hm[3] + +hm[4] === +hm[2] && (people === +hm[1] ? !/The other/.test(hi) : /The other .* in this theme \(P-\d+/.test(hi)), `${hi} | people ${people}`)

  // ── 5. Dog and cat: one note when every row is too small, and the box is off by default ──
  await b.goto(`${root}/signals?view=code`); await b.waitFor('What stands out'); await b.sleep(400)
  await click('[data-testid=view-moment]')
  ok('the compare box is off by default', await b.evaluate(`document.querySelector('[data-testid=compare-pets]').checked===false`))
  ok('no note shows until it is switched on', (await b.evaluate(`document.querySelectorAll('[data-testid=compare-small]').length`)) === 0)
  await click('[data-testid=compare-pets]')
  const small = await b.evaluate(`document.querySelectorAll('[data-testid=compare-small]').length`)
  const smallRows = await all('[data-testid=moment-row]')
  ok('with every group under 5, one note at the top says so', small === 1 && /Too small to read/.test((await text('[data-testid=compare-small]')) ?? ''), `${small}`)
  ok('and the rows do not repeat it', smallRows.length > 0 && smallRows.every((r) => !/Too small to read/.test(r)), smallRows.find((r) => /Too small/.test(r)))
  ok('the dog and cat counts are still shown', smallRows.every((r) => /Dog owners/.test(r) && /Cat owners/.test(r)))

  // ── 6 (browser). Play lands on the quoted turn ──
  await b.goto(`${root}/signals?view=code`); await b.waitFor('What stands out'); await b.sleep(400)
  await clickText('[data-testid=signal-row]', 'Pause would have kept them'); await b.sleep(300)
  const plays = await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-point]')].filter(li=>li.querySelector('p.font-serif')).slice(0,3).map(li=>({quote:li.querySelector('p.font-serif').innerText.replace(/[“”]/g,'').trim().slice(0,40),href:li.querySelector('a[aria-label^="Play"]').getAttribute('href'),time:li.innerText.match(/\\d+:\\d\\d/)[0]}))`)
  ok('there are quotes to play', plays.length === 3)
  for (const p of plays) {
    await b.goto(p.href)
    await b.waitFor('Back to Emotion & behaviour')
    const landed = await b.poll(`(()=>{const m=[...document.querySelectorAll('[role=listitem][data-turn]')].find(e=>/ring-2/.test(e.className));return m?m.innerText.replace(/\\s+/g,' '):false})()`, 8000)
    ok(`Play at ${p.time} lands on the quoted turn`, !!landed && landed.includes(p.quote) && landed.includes(p.time), `${landed} | wanted ${p.quote}`)
  }

  // ── 7a. Dismissing a tension asks for a reason and logs who and when ──
  await fresh()
  await b.goto(`${root}/signals?tab=tensions`); await b.waitFor('Tensions'); await b.sleep(500)
  const title = await b.evaluate(`document.querySelector('[data-testid=tension-card][data-status=Suggested] h3').innerText.trim()`)
  await click('[data-testid=dismiss-tension]')
  ok('a reason is asked for', await b.evaluate(`!!document.querySelector('[role=dialog] textarea')`))
  ok('and Dismiss is blocked until there is one', await b.evaluate(`document.querySelector('[data-testid=reason-confirm]').disabled`))
  await b.evaluate(setText('[role=dialog] textarea', 'Only three people. Too few to read.')); await b.sleep(250)
  await click('[data-testid=reason-confirm]')
  await b.goto(`${root}/codebook?tab=log`); await b.waitFor('Change log'); await b.sleep(500)
  const logRow = (await all('[data-testid=change-log] tbody tr')).find((r) => r.includes('Dismissed') && r.includes('Only three people'))
  ok('the log has the tension, the reason, who and when', !!logRow && logRow.includes(title.slice(0, 30)) && /\d{1,2}:\d\d/.test(logRow) && /[A-Z][a-z]+ [A-Z][a-z]+/.test(logRow), logRow)

  // ── 7b. Not right?: the correction reaches every count that depends on it ──
  await fresh()
  const tensionSides = async () => {
    await b.goto(`${root}/signals?tab=tensions`); await b.waitFor('Tensions'); await b.sleep(500)
    const t = await b.evaluate(`[...document.querySelectorAll('[data-testid=tension-card]')].find(c=>/Said vs emotion/.test(c.innerText)).querySelector('[data-testid=tension-sides]').innerText.replace(/\\s+/g,' ')`)
    return [...t.matchAll(/(\d+) of (\d+)/g)].map((m) => [+m[1], +m[2]])
  }
  const sidesBefore = await tensionSides()
  await b.goto(`${root}/signals?view=code`); await b.waitFor('What stands out'); await b.sleep(400)
  await click('[data-testid=view-moment]')
  await clickText('[data-testid=moment-row]', 'First reaction: Concept C'); await b.sleep(300)
  const standBefore = (await all('[data-testid=standout]')).find((s) => /Concept C|tie for the most positive/.test(s)) ?? ''
  const rowBefore = (await all('[data-testid=moment-row]')).find((r) => /Concept C/.test(r))
  const pos = (r) => Number(r?.match(/(\d+) positive/)?.[1])
  const key3104 = 'm:m-concept-c:P-3104'
  const seen = await b.evaluate(`document.querySelector('[data-key="${key3104}"] [data-testid=face-reading]')?.dataset.emotion`)
  ok('P-3104 reads as Delight at Concept C (the person whose pause face is the tension)', seen === 'Delight', seen)
  await b.evaluate(`document.querySelector('[data-key="${key3104}"] [data-testid=fix-face]').click(); true`); await b.sleep(400)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.innerText.trim().startsWith('Neutral')).querySelector('input').click(); true`); await b.sleep(250)
  await b.evaluate(setText('[role=dialog] textarea', 'A polite smile, not delight.')); await b.sleep(250)
  await click('[data-testid=fix-confirm]')
  const rowAfter = (await all('[data-testid=moment-row]')).find((r) => /Concept C/.test(r))
  ok('the Concept C row loses one positive face', pos(rowAfter) === pos(rowBefore) - 1, `${pos(rowBefore)} -> ${pos(rowAfter)}`)
  const standAfter = (await all('[data-testid=standout]')).find((s) => /Concept C|tie for the most positive/.test(s)) ?? ''
  ok('What stands out follows the correction', standAfter !== standBefore, `${standBefore} -> ${standAfter}`)
  const sidesAfter = await tensionSides()
  ok('the tension’s count of delight-or-interest faces went down by one, and nothing else moved', sidesAfter[1][0] === sidesBefore[1][0] - 1 && sidesAfter[1][1] === sidesBefore[1][1] && sidesAfter[0][0] === sidesBefore[0][0], `${JSON.stringify(sidesBefore)} -> ${JSON.stringify(sidesAfter)}`)
  const clipFaces = await b.evaluate(`[...document.querySelectorAll('[data-testid=tension-card]')].find(c=>/Said vs emotion/.test(c.innerText)).querySelector('[data-testid=clip-faces]')?.innerText.replace(/\\s+/g,' ')`)
  ok('tension clips lead with what was seen and then say reads as', /Seen at \d+:\d\d/.test(clipFaces ?? '') && /reads as/.test(clipFaces ?? ''), clipFaces)
  const fixedOnClip = await b.evaluate(`[...document.querySelectorAll('[data-testid=tension-card]')].find(c=>/Said vs emotion/.test(c.innerText)).innerText`)
  ok('and the corrected face shows as corrected there', /corrected/.test(fixedOnClip ?? ''))
  await b.goto(`${root}/codebook?tab=log`); await b.waitFor('Change log'); await b.sleep(500)
  ok('the correction is logged', /Face reading corrected/.test((await text('main')) ?? '') && /polite smile/.test((await text('main')) ?? ''))

  // ── 7c. Excluded sessions are in no count; quality-flagged accepted sessions follow the same rule as the codebook ──
  const base = await withMod(`(async()=>{
    const sg = await window.__mod('/src/mock/signals'), ss = await window.__mod('/src/mock/sessions')
    const excluded = ss.PET_SEED_SESSIONS.filter((s) => s.review?.status === 'Excluded').map((s) => s.participant)
    const seen = new Set()
    for (const m of sg.MOMENTS) for (const p of sg.momentPoints(m.id)) seen.add(p.participantId)
    const flagged = ss.PET_SEED_SESSIONS.filter((s) => s.review?.status === 'Accepted' && s.review.flags.length).map((s) => s.participant)
    return { excluded, leaked: excluded.filter((p) => seen.has(p)), flagged, flaggedIn: flagged.filter((p) => seen.has(p)), people: seen.size }
  })()`)
  ok('excluded sessions appear in no by-moment count', base.excluded.length === 2 && base.leaked.length === 0, JSON.stringify(base))
  ok('quality-flagged but accepted sessions are counted, as in the codebook', base.flagged.length >= 3 && base.flaggedIn.length === base.flagged.length, JSON.stringify(base))
  ok('so the by-moment people are exactly the 20 accepted', base.people === 20, String(base.people))
  await b.goto(`${root}/signals?view=code`); await b.waitFor('What stands out'); await b.sleep(500)
  const cov = await text('[data-testid=coverage]')
  ok('the coverage line says the excluded sessions are left out', /excluded in Review are left out/.test(cov ?? '') && /20/.test(cov ?? ''), cov)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('A2 REVIEW FIXES FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('A2 REVIEW FIXES OK')
