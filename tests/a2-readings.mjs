// A2's output: one reading per theme. The label rules and their edges, the statement and its validator, the Researcher's decision
// (accept, edit with numbers locked, change label with a reason, leave out), Out of date when the counts move, and the cleaned-up table.
//   npx vite --port 5199 --strictPort &   then   node tests/a2-readings.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/pet-food-churn/analysis'
const failures = []
let n = 0
const ok = (label, cond, detail) => {
  n++
  if (!cond) failures.push(detail ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
}
const q = (s) => JSON.stringify(s)
const text = (sel) => b.evaluate(`document.querySelector(${q(sel)})?.innerText.replace(/\\s+/g,' ').trim() ?? null`)
const all = (sel) => b.evaluate(`[...document.querySelectorAll(${q(sel)})].map(e=>e.innerText.replace(/\\s+/g,' ').trim())`)
const click = async (sel) => {
  const done = await b.poll(`(()=>{const e=document.querySelector(${q(sel)});if(!e||e.disabled)return false;e.click();return true})()`)
  if (!done) throw new Error(`nothing to click for ${sel}`)
  await b.sleep(350)
}
const setVal = (sel, v, proto = 'HTMLTextAreaElement', i = 0) => b.evaluate(`(()=>{const t=document.querySelectorAll(${q(sel)})[${i}];Object.getOwnPropertyDescriptor(${proto}.prototype,'value').set.call(t,${q(v)});t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new Event('change',{bubbles:true}));return true})()`).then(() => b.sleep(200))
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const withMod = (expr) => b.evaluate(MOD + '; ' + expr)
const doc = () => b.evaluate(`Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))))[0]`)
const pickTheme = async (name) => { await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-row]')].find(r=>r.querySelector('.font-semibold').innerText.trim()===${q(name)}).click(); true`); await b.sleep(300) }
const rowOf = (name) => b.evaluate(`(()=>{const r=[...document.querySelectorAll('[data-testid=theme-row]')].find(r=>r.querySelector('.font-semibold').innerText.trim()===${q(name)});return r?{status:r.dataset.status,label:r.dataset.label,line:r.querySelector('[data-testid=theme-line]').innerText}:null})()`)
const footer = () => text('[data-testid=report-footer-count]')

try {
  await b.goto('/researcher')
  await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${root}/codebook?tab=themes`); await b.waitFor('New theme'); await b.sleep(600)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-suggestion]')].forEach(s=>s.querySelector('[data-testid=accept-theme]').click()); true`); await b.sleep(700)
  await b.goto(`${root}/signals`); await b.waitFor('Reading'); await b.sleep(900)

  // ── The label rules, with their edges ──
  const u = await withMod(`(async()=>{
    const tr = await window.__mod('/src/state/themeReadings')
    const nar = await window.__mod('/src/state/narration')
    const N = (o) => ({ n: 10, R: 8, P: 0, U: 0, M: 8, positive: 8, negative: 0, facts: 0, audio: 0, faces: 8, ...o })
    const C = (name, verdict, R, o = {}) => ({ id: name, name, verdict, R, P: 0, U: 0, M: R, positive: R, negative: 0, ...o })
    const r = (nums, codes = [], tensions = []) => tr.readingFrom({ nums: N(nums), codes, tensions })
    const out = {
      stated: r({ R: 0, M: 0, positive: 0, negative: 0, facts: 6, n: 6 }),
      few: r({ R: 2, M: 2, positive: 2 }),
      split: r({ R: 9, M: 4, P: 4, U: 1 }, [C('Skip', 'Consistent', 3, { M: 3 }), C('Flex', 'Conflicting', 3, { M: 0, P: 3 })]),
      noSplit: r({ R: 9, M: 4, P: 4, U: 1 }, [C('Skip', 'Consistent', 3, { M: 3 }), C('Flex', 'Conflicting', 2, { M: 0, P: 2 })]),
      meant: r({ R: 8, M: 5, P: 2, U: 1 }, [C('A', 'Mixed', 4, { M: 2, P: 2 })]),
      halfMeant: r({ R: 8, M: 4, P: 3, U: 1 }),
      notBacked: r({ R: 8, M: 2, P: 5, U: 1 }),
      halfAgainst: r({ R: 8, M: 2, P: 4, U: 2 }),
      unsure: r({ R: 6, M: 2, P: 1, U: 3 }),
      unsureNoP: r({ R: 6, M: 2, P: 0, U: 4 }),
      partlyNoU: r({ R: 6, M: 3, P: 3, U: 0 }),
      complaint: r({ R: 5, M: 4, P: 1, positive: 0, negative: 5 }),
      both: r({ R: 5, M: 4, P: 1, positive: 3, negative: 2 }),
      hes: r({ R: 9, M: 5, P: 1, U: 3 }),
      tension: r({ R: 8, M: 5, P: 3 }, [], [{ id: 't1', title: 'Chose the pause idea in the end, but hesitated when first shown it' }]),
    }
    const lines = Object.values(out).flatMap((x) => x.lines)
    return { out: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { label: v.label, lines: v.lines, problems: v.problems, coverage: v.coverage }])), bad: lines.filter((l) => !nar.checkNarration(l, { maxWords: 40, figuresAllowed: 3 }).ok),
      edit: { same: tr.editProblems(['5 of 8 who argued for it sounded and looked like they meant it.'], ['5 of 8 who argued for it sounded like they meant it.']), changed: tr.editProblems(['5 of 8 who argued for it sounded and looked like they meant it.'], ['6 of 8 who argued for it sounded like they meant it.']), pct: tr.editProblems(['5 of 8 people.'], ['5 of 8 people, 62%.']) } }
  })()`)
  const o = u.out
  ok('nobody argued or complained: “Stated, not argued”, with the plain line and no others', o.stated.label === 'Stated, not argued' && o.stated.lines.length === 1 && /^All 6 described what happened\. Nobody argued for or against it/.test(o.stated.lines[0]), o.stated)
  ok('fewer than 3 with a claim: “Too few to read”', o.few.label === 'Too few to read' && o.few.lines[0] === 'Only 2 of 10 had a claim with a readable delivery.', o.few)
  ok('a Consistent code and a Conflicting code, each with 3 readable people: “Split inside the theme”, naming both', o.split.label === 'Split inside the theme' && o.split.lines[0] === '“Skip” reads as meant (3 of 3); “Flex” doesn’t (3 of 3).', o.split)
  ok('a Conflicting code with only 2 readable people does not split the theme', o.noSplit.label !== 'Split inside the theme', o.noSplit.label)
  ok('more than half matched: “Said and meant”', o.meant.label === 'Said and meant' && o.meant.lines[0] === '5 of 8 who argued for it sounded and looked like they meant it.', o.meant)
  ok('exactly half matched is never “more than half”', o.halfMeant.label !== 'Said and meant', o.halfMeant.label)
  ok('more than half pulled against: “Said, not backed”', o.notBacked.label === 'Said, not backed' && o.notBacked.lines[0] === '5 of 8 who argued for it didn’t sound or look like they meant it.', o.notBacked)
  ok('exactly half against is not “Said, not backed”: it is “Partly backed” (P at least U)', o.halfAgainst.label === 'Partly backed' && o.halfAgainst.lines[0] === 'Of the 8 who argued for it, 2 sounded and looked like they meant it, 4 didn’t and 2 were unsure.', o.halfAgainst)
  ok('more unsure than against: “Said, but unsure”', o.unsure.label === 'Said, but unsure' && o.unsure.lines[0] === 'Of the 6 who argued for it, 3 sounded unsure, 1 didn’t sound like they meant it and 2 did.', o.unsure)
  ok('a clause whose count is 0 is left out (no “didn’t” when nobody pulled against)', o.unsureNoP.lines[0] === 'Of the 6 who argued for it, 4 sounded unsure and 2 sounded like they meant it.' && !/ 0 /.test(o.unsureNoP.lines.join(' ')), o.unsureNoP.lines)
  ok('and no “unsure” clause when nobody was unsure', o.partlyNoU.lines[0] === 'Of the 6 who argued for it, 3 sounded and looked like they meant it and 3 didn’t.', o.partlyNoU.lines)
  ok('the claim word follows who made a claim: complained, or argued for it or complained', /who complained/.test(o.complaint.lines[0]) && /who argued for it or complained/.test(o.both.lines[0]), [o.complaint.lines[0], o.both.lines[0]])
  ok('the gap line names the code where people pulled against their words', o.meant.lines[1] === 'The gap sits in “A”: 2 of the 4 who argued for it pulled against their words.', o.meant.lines)
  ok('the hesitation line shows when a third or more were unsure', o.hes.lines.some((l) => l === '3 of 9 hesitated while saying it.') && !o.unsure.lines.some((l) => /hesitated while saying it/.test(l)), [o.hes.lines, o.unsure.lines])
  ok('an accepted tension adds “Related tension: …”', o.tension.lines.some((l) => l === 'Related tension: Chose the pause idea in the end, but hesitated when first shown it.'), o.tension.lines)
  ok('at most three lines, and every line passes the shared validator (no percentages, n of N)', Object.values(o).every((x) => x.lines.length <= 3 && x.problems.length === 0) && u.bad.length === 0 && !Object.values(o).some((x) => /%/.test(x.lines.join(' '))), u.bad)
  ok('coverage sits apart from the statement, never inside it', Object.values(o).every((x) => !x.lines.some((l) => /audio-only|faces read for|only stated a fact/.test(l))))
  ok('an edit that keeps the numbers can be saved; changing a number or adding a percentage cannot', u.edit.same.length === 0 && u.edit.changed.some((p) => /numbers are locked/.test(p)) && u.edit.pct.some((p) => /percentage/.test(p)), u.edit)

  // ── In the app: nothing accepted on its own; suggested tensions never in a statement ──
  const rows = await all('[data-testid=theme-row]')
  ok('one row per theme, all Suggested on arrival: nothing is accepted on its own', rows.length === 4 && (await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-row]')].every(r=>r.dataset.status==='Suggested')`)), rows)
  const seen = await withMod(`(async()=>{const cb=await window.__mod('/src/state/codebook');const ms=await window.__mod('/src/mock/signals');const sess=await window.__mod('/src/mock/sessions');const sg=await window.__mod('/src/state/signals');const tr=await window.__mod('/src/state/themeReadings');const doc=Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))))[0];const sid=(p)=>sess.sessionIdOf(sess.PET_SEED_SESSIONS.find(x=>x.participant===p&&x.variant==='done'));const basis=cb.basisOf(ms.ACCEPTED_PARTICIPANTS.map(p=>({id:sid(p),participantId:p})));const ts=sg.tensionsOf(doc,basis);const out=[];sg.themeSignals(doc,basis).filter(t=>t.kind==='theme').forEach(t=>{const r=tr.readingOf(t,doc,ts);const mine=tr.tensionsOfTheme(t,ts);out.push({name:t.name,lines:r.lines,suggested:mine.filter(x=>x.status!=='Added as a tension theme').map(x=>x.title),accepted:mine.filter(x=>x.status==='Added as a tension theme').map(x=>x.title),R:r.nums.R,fitN:t.fit.n,P:r.nums.P,against:t.fit.against})});return out})()`)
  ok('a suggested tension never appears in a statement; an accepted one does', seen.every((s) => s.suggested.every((t) => !s.lines.join(' ').includes(t))) && seen.some((s) => s.accepted.length && s.accepted.every((t) => s.lines.join(' ').includes(t.replace(/\.$/, '')))), seen)
  ok('the counts are A2’s own theme counts, not recomputed', seen.every((s) => s.R === s.fitN && s.P === s.against))

  // ── The table ──
  ok('the columns are Theme, Said by, Reading, Tensions, Status, with How it’s decided and Key in the header', /^Theme Said by Reading Tensions Status How it’s decided Key$/.test((await text('[data-testid=signal-head]')) ?? ''), await text('[data-testid=signal-head]'))
  ok('theme rows are collapsed by default; each shows its statement’s first line under the name', (await b.evaluate(`document.querySelectorAll('[data-testid=theme-codes]').length`)) === 0 && (await all('[data-testid=theme-line]')).every((l) => l.length > 20))
  ok('there is no Tension themes group, no legend strip and no grouping paragraph on the page', !(await b.evaluate(`[...document.querySelectorAll('h3')].some(h=>/Tension themes/.test(h.innerText))`)) && (await b.evaluate(`document.querySelectorAll('[data-testid=valence-key]').length`)) === 0 && !/Grouped as/.test((await text('main')) ?? ''))
  await click('[data-testid=key]')
  ok('the Key popover holds the face, tone and certainty colours and the grouping', (await b.evaluate(`!!document.querySelector('[data-testid=key-pop] [data-testid=valence-key]')`)) && /Face/.test((await text('[data-testid=key-pop]')) ?? '') && /certainty/i.test((await text('[data-testid=key-pop]')) ?? ''))
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(200)
  await click('[data-testid=expand-all]')
  ok('Expand all opens every theme’s codes, read-only (no switches)', (await b.evaluate(`document.querySelectorAll('[data-testid=theme-codes]').length`)) === 4 && (await b.evaluate(`document.querySelectorAll('[data-testid=theme-codes] [role=switch], [data-testid=theme-codes] input').length`)) === 0)
  const faces = await all('[data-testid=face-cell]')
  const speech = await all('[data-testid=speech-label]')
  ok('Face cells never say “Mixed”: the leading reading with its count, or “No clear lead”', faces.length >= 8 && faces.every((f) => !/Mixed/.test(f) && /^([A-Z][a-z]+ \d+ of \d+|No clear lead|No faces read|—)$/.test(f)), faces)
  ok('Speech cells never say “Mixed” and always carry their base', speech.length >= 8 && speech.every((f) => !/Mixed/.test(f) && (/\d+ of \d+/.test(f) || f === 'No clear lead' || f === '—')), speech)
  ok('no inline “In report” or “Nothing to show” tags next to code names', (await b.evaluate(`document.querySelectorAll('[data-testid=row-state]').length`)) === 0 && !/Nothing to show/.test((await text('[aria-label="Theme readings"]')) ?? ''))
  ok('verdict chips stay in the verdict column', (await all('[data-testid=fit-cell]')).every((f) => /^(Consistent|Mixed|Conflicting|No claim|Too few to read)$/.test(f)))
  ok('“Said by” explains N when it is not the full sample', /people who were asked this question/.test((await b.evaluate(`document.querySelector('[data-testid=said-by-head]').title`)) ?? ''))

  // ── Accept: who, when and version; goes to the report count ──
  await pickTheme('Why they joined')
  ok('the theme panel shows the label, the statement, the AI-suggested tag and the four figures', /AI-suggested/.test((await text('[data-testid=reading-tag]')) ?? '') && (await b.evaluate(`['R','P','U','M'].every(k=>document.querySelector('[data-testid=rfig-'+k+']'))`)) && /9 of 9 who argued for it/.test((await text('[data-testid=reading-statement]')) ?? ''))
  ok('the footer starts at 0 theme readings', /^Goes to the report: 0 theme readings and \d+ tension themes?\.$/.test((await footer()) ?? ''), await footer())
  await click('[data-testid=reading-accept]')
  const d1 = (await doc()).readings
  const why = Object.values(d1)[0]
  ok('Accept records who, when and the data version', why && why.status === 'Accepted' && why.by === 'Maya Ortiz' && !!why.at && why.version === 1 && !!why.fingerprint && why.sessions === 20, why)
  ok('the row says Accepted, the footer counts 1 theme reading, the approval footer names who and the version', (await rowOf('Why they joined')).status === 'Accepted' && /^Goes to the report: 1 theme reading /.test((await footer()) ?? '') && /^Accepted by Maya Ortiz · \d+ \w{3}, \d\d:\d\d · data v1$/.test((await text('[data-testid=approval-footer]')) ?? ''), await text('[data-testid=approval-footer]'))
  // ── Edit: wording only, numbers locked ──
  await pickTheme('Price creep')
  await click('[data-testid=reading-edit]')
  const orig = await b.evaluate(`document.querySelector('[data-testid=reading-edit-line]').value`)
  await setVal('[data-testid=reading-edit-line]', orig.replace(/^5 of 8/, '6 of 8'))
  ok('changing a number blocks Save', (await b.evaluate(`document.querySelector('[data-testid=reading-edit-save]').disabled`)) && /numbers are locked/.test((await text('[data-testid=reading-edit-problems]')) ?? ''), await text('[data-testid=reading-edit-problems]'))
  await setVal('[data-testid=reading-edit-line]', orig.replace('sounded and looked like they meant it', 'meant it, by voice and face'))
  ok('rewording with the same numbers can be saved', !(await b.evaluate(`document.querySelector('[data-testid=reading-edit-save]').disabled`)))
  await click('[data-testid=reading-edit-save]')
  ok('saved: status Edited, tagged “Edited by Maya Ortiz”, the new wording shown', (await rowOf('Price creep')).status === 'Edited' && (await text('[data-testid=reading-tag]')) === 'Edited by Maya Ortiz' && /meant it, by voice and face/.test((await text('[data-testid=reading-statement]')) ?? ''))
  // ── Change label: needs a reason ──
  await pickTheme('The pet decides')
  await click('[data-testid=reading-label]')
  await b.evaluate(`(()=>{const s=document.querySelector('[data-testid=label-select]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'Partly backed');s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`); await b.sleep(200)
  ok('a label change cannot be saved without a reason', await b.evaluate(`document.querySelector('[data-testid=label-save]').disabled`))
  await setVal('[data-testid=label-why-input]', 'The one who pulled against is the vet case, which matters here.')
  await click('[data-testid=label-save]')
  const pet = Object.values((await doc()).readings).find((x) => x.label)
  ok('with a reason it saves: Label changed, the reason shown, the numbers unchanged and logged', (await rowOf('The pet decides')).status === 'Label changed' && (await rowOf('The pet decides')).label === 'Partly backed' && /Label changed from “Said and meant” by Maya Ortiz/.test((await text('[data-testid=label-why]')) ?? '') && pet.snap.M === Number(await b.evaluate(`document.querySelector('[data-testid=rfig-M]').dataset.n`)) && (await doc()).log.some((l) => l.action === 'Reading label changed' && l.why))
  // ── Note: separate ──
  await setVal('[data-testid=reading-note]', 'Probe the vet story in the next wave.')
  await click('[data-testid=reading-note-save]')
  ok('a researcher note is saved apart from the statement', (await doc()).readingNotes && Object.values((await doc()).readingNotes)[0].text === 'Probe the vet story in the next wave.' && !/Probe the vet/.test((await text('[data-testid=reading-statement]')) ?? '') && /Researcher’s note · Maya Ortiz/.test((await text('[data-testid=reading-note-by]')) ?? ''))
  // ── Needs review ──
  await click('[data-testid=show-review]')
  ok('“Needs review” shows only the Suggested and Out of date readings', JSON.stringify(await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-row]')].map(r=>r.dataset.status)`)) === JSON.stringify(['Suggested']))
  await pickTheme('Wanting control over deliveries')
  await click('[data-testid=reading-accept]')
  ok('accepting the last one empties it', (await b.evaluate(`document.querySelectorAll('[data-testid=theme-row]').length`)) === 0 && /Every reading has a decision/.test((await text('main')) ?? ''))
  await click('[data-testid=show-all]')
  // ── Out of date: an input changes after acceptance ──
  const before = await rowOf('Wanting control over deliveries')
  await b.goto(`${root}/signals?tab=tensions`); await b.waitFor('Tensions'); await b.sleep(600)
  const added = await b.evaluate(`(()=>{const c=[...document.querySelectorAll('[data-testid=tension-card][data-status=Suggested]')].find(c=>/flexib|control|skip|pause|schedule/i.test(c.innerText)&&c.querySelector('[data-testid=turn-theme]'));if(!c)return null;c.querySelector('[data-testid=turn-theme]').click();return c.querySelector('h3').innerText})()`)
  await b.sleep(400); if (added) await click('[data-testid=turn-confirm]')
  await b.goto(`${root}/signals`); await b.waitFor('Reading'); await b.sleep(800)
  const after = await rowOf('Wanting control over deliveries')
  ok('adding a tension that touches an accepted reading marks it Out of date; nothing is rewritten silently', !!added && before.status === 'Accepted' && after.status === 'Out of date', { added, before, after })
  await pickTheme('Wanting control over deliveries')
  ok('Out of date shows the old and the new values, with Re-accept and Leave out', /^Was .+: \d+ matched, \d+ pulled against, \d+ unsure of \d+\. Now .+: \d+ matched, \d+ pulled against, \d+ unsure of \d+\.$/.test((await text('[data-testid=old-new]')) ?? '') && (await text('[data-testid=reading-accept]')) === 'Re-accept' && !(await b.evaluate(`document.querySelector('[data-testid=reading-leave]').disabled`)), await text('[data-testid=old-new]'))
  ok('the new statement already names the added tension', (await text('[data-testid=reading-statement]'))?.includes(`Related tension: ${added?.replace(/\.$/, '')}`), await text('[data-testid=reading-statement]'))
  await click('[data-testid=reading-accept]')
  const ctl = Object.values((await doc()).readings).find((x) => x.aiLines.join(' ').includes(added?.replace(/\.$/, '') ?? '§'))
  ok('re-accepting records a new data version', ctl?.version === 2 && (await rowOf('Wanting control over deliveries')).status === 'Accepted', ctl)
  // ── Leave out ──
  await pickTheme('Why they joined')
  await click('[data-testid=reading-leave]')
  await setVal('[data-testid=leave-why]', 'Background, not a finding.')
  await click('[data-testid=leave-save]')
  ok('Leave out: reviewed, not reported, with the optional reason', (await rowOf('Why they joined')).status === 'Left out' && /Left out by Maya Ortiz .*“Background, not a finding\.”/.test((await text('[data-testid=approval-footer]')) ?? '') && /^Goes to the report: 3 theme readings /.test((await footer()) ?? ''), await footer())

  // ── The code panel ──
  await b.goto(`${root}/signals?view=code`); await b.waitFor('Reading'); await b.sleep(800)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=signal-row]')].find(r=>/Pause would have kept them/.test(r.innerText)).click(); true`); await b.sleep(300)
  ok('the code panel has no report switch, and the hesitant-delivery line sits inside the figures', (await b.evaluate(`document.querySelectorAll('[data-testid=signal-panel] [role=switch]').length`)) === 0 && (await b.evaluate(`!!document.querySelector('[data-testid=delivery-breakdown] [data-testid=hesitant-note]')`)))
  ok('the certainty chip says “Certainty: …” and the origin is small grey text', /^Certainty: /.test((await text('[data-testid=certainty-chip]')) ?? '') && /^Origin: (guide question|new code)$/.test((await text('[data-testid=origin]')) ?? ''))
  await click('[data-testid=code-theme-link]')
  ok('and leads back to its theme', /Wanting control over deliveries/.test((await text('[data-testid=theme-panel] h2')) ?? ''))
} catch (e) {
  failures.push(`stopped: ${e.message}`)
}
b.close()
console.log(`${n} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('A2 READINGS FAILED:\n - ' + failures.join('\n - '))
  process.exit(1)
}
console.log('A2 READINGS OK')
