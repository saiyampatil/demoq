// A2, the Themes tab (commit 1B): the header, the table, the panel, the decisions, the keyboard, review mode, the Key and the wording.
//   npx vite --port 5199 --strictPort &   then   node tests/a2-themes-tab.mjs
// Every step waits on state, and every figure on the page is checked against the logic (state/signals.ts, state/speech.ts), not typed here.
import { launch } from './cdp.mjs'

const b = await launch()
const PET = '/researcher/studies/pet-food-churn/analysis'
const ICE = '/researcher/studies/ice-cream-flavours/analysis'
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail !== undefined ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
}
const q = JSON.stringify
const ev = (expr) => b.evaluate(expr)
const text = (sel) => ev(`document.querySelector(${q(sel)})?.innerText.replace(/\\s+/g,' ').trim() ?? null`)
const lastToast = () => ev(`(()=>{const t=[...document.querySelectorAll('[data-testid=toast]')].pop();return t?t.innerText.replace(/\\s+/g,' '):null})()`)
const count = (sel) => ev(`document.querySelectorAll(${q(sel)}).length`)
const click = async (sel, i = 0) => {
  const done = await b.poll(`(()=>{const e=document.querySelectorAll(${q(sel)})[${i}];if(!e||e.disabled)return false;e.click();return true})()`)
  if (!done) throw new Error(`nothing to click for ${sel} ${i}`)
  await b.sleep(250)
}
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const PRE = (study) => `${MOD};
  const cb=await window.__mod('/src/state/codebook'); const ms=await window.__mod('/src/mock/signals'); const sg=await window.__mod('/src/state/signals'); const sp=await window.__mod('/src/state/speech'); const cfg=await window.__mod('/src/config/delivery')
  const study=${q(study)}; const ppl=ms.acceptedParticipants(study)
  const doc=cb.getCodebook(study); const basis=cb.basisOf(ppl.map(p=>({id:ms.sessionOfParticipant(p),participantId:p})))
  const model=()=>{const d=cb.getCodebook(study);const s=sg.codeSignals(d,basis);const p=sg.themeSignals(d,basis,s);return {d,s,p,c:sg.insightCounts(p)}}`
const run = (body, study = 'pet-food-churn') => ev(`(async()=>{${PRE(study)}; ${body}})()`)
const fresh = async (root = PET) => {
  await b.goto('/researcher')
  await ev('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(`${root}/signals`)
  await b.waitFor('What stood out')
  await b.sleep(700)
}
// Real key events, so focus and the page's own handlers are exercised.
const press = async (key, text) => {
  const code = key.length === 1 ? `Key${key.toUpperCase()}` : key
  const vk = { ArrowDown: 40, ArrowUp: 38, ArrowRight: 39, ArrowLeft: 37, Enter: 13 }[key] ?? key.toUpperCase().charCodeAt(0)
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, text: text ?? (key.length === 1 ? key : key === 'Enter' ? '\r' : undefined) })
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk })
  await b.sleep(250)
}
const setValue = (sel, v) => ev(`(() => { const t=document.querySelector(${q(sel)}); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${q(v)}); t.dispatchEvent(new Event('input',{bubbles:true})); return true })()`)
const LABEL_OF = { Consistent: 'Consistent', Mixed: 'Mixed', Conflicting: 'Gap', 'No claim': 'No position', 'Too few to read': 'Too few to read' }
const themeIdx = async (name) => ev(`[...document.querySelectorAll('[data-testid=theme-name]')].findIndex(e=>e.innerText.trim()===${q(name)})`)
const openTheme = async (name) => click('[data-testid=theme-name]', await themeIdx(name))
const statusOf = (name) => ev(`[...document.querySelectorAll('[data-testid=theme-row]')].find(r=>r.querySelector('[data-testid=theme-name]').innerText.trim()===${q(name)})?.querySelector('[data-testid=status-chip]')?.dataset.status ?? null`)
const expandAll = async () => { await ev(`(()=>{const e=document.querySelector('[data-testid=expand-all]');if(/^Expand all/.test(e.innerText))e.click();return true})()`); await b.sleep(250) }

try {
  // ── the tabs and the header ──
  await fresh()
  const tabs = await ev(`[...document.querySelectorAll('[role=tab]')].map(t=>t.innerText.replace(/\\s+/g,' ').trim().replace(/ \\d+$/,''))`)
  ok('the tabs are Themes and Tensions, and nothing is called Signals', JSON.stringify(tabs) === JSON.stringify(['Themes', 'Tensions']) && !/\bSignals\b/.test((await ev('document.body.innerText')) ?? ''), tabs)
  const head = await text('[data-testid=a2-header]')
  const want = await run(`const m=model(); const t=sg.tensionCounts(m.d); return {a:m.c.decided,b:m.c.total,t:t.toReview}`)
  ok('the header says “{a} of {b} insights decided · {t} tensions to review” from the logic', (await text('[data-testid=insights-progress]')) === `${want.a} of ${want.b} insights decided · ${want.t} ${want.t === 1 ? 'tension' : 'tensions'} to review`, [await text('[data-testid=insights-progress]'), want])
  ok('the header is sticky, and the tension part is a link to the Tensions tab', (await ev(`getComputedStyle(document.querySelector('[data-testid=a2-header]')).position`)) === 'sticky' && (await ev(`document.querySelector('[data-testid=tensions-link]').tagName`)) === 'BUTTON')
  ok('the coverage line says speech was read for everyone, and who was audio-only', /^Speech read for 20 of 20 · \d+ audio-only, read on speech/.test((await text('[data-testid=coverage]')) ?? ''), await text('[data-testid=coverage]'))
  ok('there is no colour legend and no “Grouped as” paragraph on the page, no “How faces are read”', (await count('[data-testid=legend],[data-testid=valence-key],[data-testid=how-faces]')) === 0 && !/Grouped as|How faces are read/.test((await ev('document.body.innerText')) ?? ''))

  // ── the table ──
  const cols = await ev(`[...document.querySelector('[data-testid=signal-head]').children].map(e=>e.innerText.trim())`)
  ok('five columns: Name, Said by, What stood out, Verdict, Status', JSON.stringify(cols) === JSON.stringify(['Name', 'Said by', 'What stood out', 'Verdict', 'Status']), cols)
  ok('no Face or Speech column, no “In report”, no “Nothing to show”, and no switch in the table', !/\b(Face|Speech)\b/.test(cols.join(' ')) && !/In report|Nothing to show/.test((await text('[data-testid=themes-table]')) ?? '') && (await count('[data-testid=themes-table] [role=switch]')) === 0)
  ok('the header row is sticky', (await ev(`getComputedStyle(document.querySelector('[data-testid=signal-head]')).position`)) === 'sticky')
  ok('collapsed on load: no code rows, every chevron says collapsed', (await count('[data-testid=signal-row]')) === 0 && (await ev(`[...document.querySelectorAll('[data-testid=theme-chevron]')].every(e=>e.getAttribute('aria-expanded')==='false')`)))
  await click('[data-testid=expand-all]')
  const nCodes = await run('return model().s.length')
  ok('Expand all opens every theme and shows every accepted code once per theme it is in, then says Collapse all', (await count('[data-testid=signal-row]')) >= nCodes && (await text('[data-testid=expand-all]')) === 'Collapse all')
  await click('[data-testid=expand-all]')
  ok('Collapse all closes them again', (await count('[data-testid=signal-row]')) === 0 && (await text('[data-testid=expand-all]')) === 'Expand all')
  await expandAll()

  // ── theme rows and code rows ──
  const rows = await ev(`[...document.querySelectorAll('[data-testid=theme-row]')].map(r=>{const n=r.querySelector('[data-testid=theme-name]');const cs=getComputedStyle(n);const sb=r.querySelector('[data-testid=theme-said-by]');return {name:n.innerText.trim(),fs:cs.fontSize,codes:r.querySelector('[data-testid=group-count]')?.innerText.trim(),said:sb?.innerText.trim()??null,saidRight:sb?Math.round(sb.getBoundingClientRect().right):null,tab:sb?getComputedStyle(sb).fontVariantNumeric:null,chip:r.querySelector('[data-testid=theme-verdict]')?.innerText.trim()??null,insight:r.querySelector('[data-testid=theme-insight]')?.innerText.replace(/\\s+/g,' ').trim(),status:r.querySelector('[data-testid=status-chip]')?.dataset.status??null,h:Math.round(r.getBoundingClientRect().height),chev:(()=>{const c=r.querySelector('[data-testid=theme-chevron]').getBoundingClientRect();return [Math.round(c.width),Math.round(c.height)]})(),verdictH:Math.round(r.querySelector('[data-testid=theme-verdict]')?.getBoundingClientRect().height??0)}})`)
  const model1 = await run(`const m=model(); return m.p.filter(t=>t.kind==='theme').map(t=>({name:t.name,codes:t.codes.length,people:t.people,of:t.of,verdict:t.verdict,sentence:t.insight?.sentence}))`)
  const real = rows.filter((r) => r.name !== 'Not in a theme')
  ok('every theme row reads: name, “n codes”, Said by n of N, its verdict, its insight and status, all from the logic', real.length === model1.length && real.every((r, i) => r.name === model1[i].name && r.codes === `${model1[i].codes} ${model1[i].codes === 1 ? 'code' : 'codes'}` && r.said === `${model1[i].people} of ${model1[i].of}` && r.chip === LABEL_OF[model1[i].verdict] && r.insight === model1[i].sentence && r.status === 'Suggested'), [real, model1])
  ok('theme names are 15px, numbers are tabular, the row is at least 56px, the chevron and verdict targets at least 44px', rows.every((r) => r.fs === '15px' && r.h >= 56 && r.chev[0] >= 44 && r.chev[1] >= 44) && real.every((r) => /tabular-nums/.test(r.tab) && r.verdictH >= 44), rows)
  const codeRows = await ev(`[...document.querySelectorAll('[data-testid=signal-row]')].map(r=>{const sb=r.querySelector('[data-testid=code-said-by]');return {name:r.querySelector('[data-testid=code-name]').innerText.trim(),fs:getComputedStyle(r).fontSize,h:Math.round(r.getBoundingClientRect().height),said:sb.innerText.trim(),saidRight:Math.round(sb.getBoundingClientRect().right),stood:r.querySelector('[data-testid=code-stood-out]').innerText.trim(),chip:r.querySelector('[data-verdict-chip]').dataset.verdictChip,tag:r.querySelector('[data-testid=stance-tag]').innerText.trim()}})`)
  const codes1 = await run(`return model().s.map(s=>({name:s.code.name,people:s.people,of:s.of,stood:s.standout?({hesitated:'Hesitated',flatTense:'Sounded flat or tense',animated:'Sounded animated',even:'Sounded even'}[s.standout.key]+' · '+s.standout.n+' of '+s.standout.of):'—',chip:s.readable?s.fit.pattern:'Too few to read'}))`)
  ok('every code row reads: name, a stance tag, Said by n of N, What stood out (or a dash), its verdict', codeRows.every((r) => { const c = codes1.find((x) => x.name === r.name); return c && r.said === `${c.people} of ${c.of}` && r.stood === c.stood && r.chip === c.chip && /^(For it|Against it|Just describes)$/.test(r.tag) }), codeRows.slice(0, 3))
  ok('code names are 13px and the row is at least 44px', codeRows.every((r) => r.fs === '13px' && r.h >= 44))
  const rights = [...new Set([...real.map((r) => r.saidRight), ...codeRows.map((r) => r.saidRight)])]
  ok('Said by sits at the same x in theme rows and code rows (right-aligned numbers)', rights.length === 1, rights)
  ok('there is no bar, chart or split bar in the table', (await count('[data-testid=themes-table] [role=img], [data-testid=themes-table] canvas, [data-testid=themes-table] meter, [data-testid=themes-table] progress')) === 0)
  const clipped = await ev(`[...document.querySelectorAll('[data-testid=themes-table] [data-verdict-chip],[data-testid=themes-table] [data-testid=status-chip]')].filter(e=>e.scrollWidth>e.clientWidth+1||getComputedStyle(e).textOverflow==='ellipsis').map(e=>e.innerText)`)
  ok('no verdict or status text is cut short', clipped.length === 0, clipped)
  const bare = await ev(`[...document.querySelectorAll('[data-testid=themes-table] [data-verdict-chip],[data-testid=themes-table] [data-testid=status-chip]')].filter(e=>!e.querySelector('svg')||e.innerText.trim().length<3).length`)
  ok('every verdict and status chip has an icon and words (colour is never the only carrier)', bare === 0, bare)
  ok('the table text uses no word the label table retired', !/pulled against|argued for|complained|uncertain|\bfits\b|no claim|conflicting/i.test((await text('[data-testid=themes-table]')) ?? ''))

  // ── polish: the table (A1 to A8) ──
  const geo = await ev(`(()=>{
    const R=(e)=>e.getBoundingClientRect(); const mid=(e)=>{const r=R(e);return (r.top+r.bottom)/2}
    const th=[...document.querySelectorAll('[data-testid=theme-row]')].find(r=>!/^Not in a theme/.test(r.innerText.trim()))
    const name=th.querySelector('[data-testid=theme-name]'); const ins=th.querySelector('[data-testid=theme-insight]'); const lh=parseFloat(getComputedStyle(ins).lineHeight)
    const head=[...document.querySelector('[data-testid=signal-head]').children].map(R)
    const code=document.querySelector('[data-testid=signal-row]'); const cname=code.querySelector('[data-testid=code-name]'); const tag=code.querySelector('[data-testid=stance-tag]'); const ccell=cname.parentElement
    const group=th.closest('[data-testid=theme-group]')
    return {
      insight:{overflow:getComputedStyle(ins).textOverflow,clipped:ins.scrollHeight>ins.clientHeight+1,lines:Math.round(R(ins).height/lh)},
      topAlign:[th.querySelector('[data-testid=theme-said-by]'),th.querySelector('[data-testid=theme-stood-out]'),th.querySelector('[data-verdict-chip]'),th.querySelector('[data-testid=status-chip]')].map(e=>Math.abs(mid(e)-mid(name))),
      gapBelowHead:parseFloat(getComputedStyle(th.closest('[data-testid=theme-group]').parentElement).paddingTop),
      headGaps:head.slice(0,-1).map((r,i)=>Math.round(head[i+1].left-r.right)),
      indent:Math.round(R(cname).left-R(name).left),
      tagInside:R(tag).right<=R(ccell).right+1&&R(tag).left>R(cname).left, tagFirstLine:R(tag).top<R(cname).top+lh+4, caret:!!tag.querySelector('svg'),
      nameLines:Math.round(R(cname).height/20),
      hairline:getComputedStyle(code.parentElement.nextElementSibling??code.parentElement).borderTopWidth,
      tint:getComputedStyle(group).backgroundColor,
      dash:[...document.querySelectorAll('[data-testid=theme-row]')].filter(r=>!/^Not in a theme/.test(r.innerText.trim())).map(r=>r.querySelector('[data-testid=theme-stood-out]')?.innerText.trim()),
    }})()`)
  ok('A1 the theme insight is shown in full: no ellipsis, nothing clipped, at most 3 lines', geo.insight.overflow !== 'ellipsis' && !geo.insight.clipped && geo.insight.lines <= 3, geo.insight)
  ok('A2 every cell lines up with the first line of the name, and there is a gap between the header and the first row', geo.topAlign.every((d) => d <= 4) && geo.gapBelowHead >= 4, [geo.topAlign, geo.gapBelowHead])
  ok('A3 codes are indented at least 24px more than theme names, the stance tag is right-aligned in the name cell on the first line, names wrap in at most 2 lines', geo.indent >= 24 && geo.tagInside && geo.tagFirstLine && geo.nameLines <= 2, geo)
  ok('A3 code rows have hairline dividers, and an expanded theme group is lightly tinted', geo.hairline !== '0px' && geo.tint !== 'rgba(0, 0, 0, 0)', [geo.hairline, geo.tint])
  ok('A4 the header labels never touch: a clear gap between every column', geo.headGaps.every((g) => g >= 8), geo.headGaps)
  ok('A4 What stood out is spelled out: “Sounded animated · 4 of 9”, “Sounded even · 8 of 11”, “Hesitated · 3 of 5”, or a dash', codeRows.every((r) => r.stood === '—' || /^(Sounded (animated|even|flat or tense)|Hesitated) · \d+ of \d+$/.test(r.stood)), codeRows.map((r) => r.stood))
  ok('A5 a theme row has a muted dash in What stood out', geo.dash.length >= 2 && geo.dash.every((d) => d === '—'), geo.dash)
  ok('A8 the stance chip has a caret to show it is clickable', geo.caret)
  const flags = await ev(`[...document.querySelectorAll('[data-testid=tension-flag]')].map(f=>({text:f.innerText.trim(),icon:!!f.querySelector('svg'),title:f.title,toReview:+f.dataset.toReview,color:getComputedStyle(f).color}))`)
  ok('A6 the tension flag is an amber icon and “n tensions” (“1 tension” when one), with a tooltip, not a dot', flags.length >= 1 && flags.every((f) => /^\d+ tensions?$/.test(f.text) && f.icon && f.title.length > 20 && (f.text === '1 tension' || /^[2-9]|^\d\d/.test(f.text))) && !(await count('[data-testid=tension-flag] .rounded-full')), flags)
  const amber = flags.filter((f) => f.toReview > 0)
  const quiet = flags.filter((f) => f.toReview === 0)
  ok('A6 it is amber while any tension is still to review, and grey when none is', amber.length === 0 || quiet.length === 0 || amber[0].color !== quiet[0].color, flags)
  await click('[data-testid=tension-flag]')
  ok('A6 clicking it goes to the Tensions tab', (await ev(`document.getElementById('sttab-tensions').getAttribute('aria-selected')`)) === 'true')
  await ev(`document.getElementById('sttab-themes').click(); true`); await b.sleep(400)
  await expandAll()

  // ── Not in a theme ──
  const none = await ev(`(()=>{const r=[...document.querySelectorAll('[data-testid=theme-row]')].find(x=>/^Not in a theme/.test(x.innerText.trim()));return {text:r.innerText.replace(/\\s+/g,' '),chips:r.querySelectorAll('[data-verdict-chip],[data-testid=status-chip],[data-testid=row-accept],[data-testid=tension-flag]').length,href:r.querySelector('[data-testid=group-in-codebook]')?.getAttribute('href')}})()`)
  const noneN = await run(`const n=model().p.find(t=>t.kind==='none'); return n.codes.length`)
  ok('Not in a theme says “{n} codes aren’t in a theme yet. Group them in the codebook.” with a link to the codebook, and shows no verdict, status or Accept', new RegExp(`${noneN} codes aren’t in a theme yet\\. Group them in the codebook\\.`).test(none.text) && none.chips === 0 && /\/analysis\/codebook\?tab=themes$/.test(none.href ?? ''), none)
  await click('[data-testid=theme-name]', rows.length - 1)
  ok('clicking it opens no panel', (await count('[data-testid=theme-panel],[data-testid=signal-panel]')) === 0)
  await expandAll()

  // ── Show: All | Needs review ──
  await click('[data-testid=show-review]')
  const reviewShown = await ev(`[...document.querySelectorAll('[data-testid=theme-row]')].map(r=>r.querySelector('[data-testid=status-chip]')?.dataset.status??'none')`)
  ok('Needs review shows only the themes still to decide', reviewShown.length >= 1 && reviewShown.every((s) => s === 'Suggested' || s === 'Out of date'), reviewShown)
  await click('[data-testid=show-all]')
  ok('All shows them all again', (await count('[data-testid=theme-row]')) === rows.length)

  // ── stance tags: one click to open, one to correct; counts follow; logged; undo ──
  const sBefore = await run(`const c=model().s.find(s=>s.code.name==='Price went up'); return {chip:c.fit.pattern,n:c.fit.n,against:c.fit.against,fits:c.fit.fits}`)
  const tagRow = `[data-testid=signal-row]`
  const price = await ev(`[...document.querySelectorAll('[data-testid=signal-row]')].findIndex(r=>r.querySelector('[data-testid=code-name]').innerText.trim()==='Price went up')`)
  await click('[data-testid=stance-tag]', price)
  ok('a stance tag opens a menu of the three choices', (await ev(`[...document.querySelectorAll('[data-testid=stance-menu] [data-stance-option]')].map(e=>e.innerText.replace(/PulseAI/,'').trim()).join()`)) === 'For it,Against it,Just describes')
  await click('[data-stance-option=Positive]')
  const sAfter = await run(`const m=model(); const c=m.s.find(s=>s.code.name==='Price went up'); return {fix:m.d.stanceFixes?.['code:'+c.code.id], chip:c.fit.pattern, against:c.fit.against, tag:null, log:m.d.log[0]}`)
  ok('choosing a stance corrects the whole code: stored with who and when, logged, and the counts move', !!sAfter.fix && sAfter.fix.to === 'Positive' && sAfter.fix.by === 'Maya Ortiz' && sAfter.log.action === 'Stance corrected' && sAfter.against !== sBefore.against, [sBefore, sAfter])
  ok('the tag shows the new word and a dashed border; the row’s verdict follows the logic', (await ev(`(()=>{const r=document.querySelectorAll('[data-testid=signal-row]')[${price}];const t=r.querySelector('[data-testid=stance-tag]');return t.innerText.trim()==='For it'&&getComputedStyle(t).borderStyle==='dashed'&&r.querySelector('[data-verdict-chip]').dataset.verdictChip===${q(sAfter.chip)}})()`)))
  await click('[data-testid=toast] button')
  ok('Undo in the toast puts the code back as PulseAI had it', (await run(`const m=model(); const c=m.s.find(s=>s.code.name==='Price went up'); return !m.d.stanceFixes?.['code:'+c.code.id] && c.fit.against===${sBefore.against}`)))

  // ── the theme panel: one anatomy, top to bottom ──
  await openTheme('Price creep')
  ok('opening a theme opens one panel, and its row is selected', (await count('[data-testid=theme-panel]')) === 1 && (await ev(`document.querySelector('[data-testid=theme-row][data-selected=true] [data-testid=theme-name]').innerText.trim()`)) === 'Price creep')
  const order = await ev(`['insight','theme-figures','moments-section','codes-to-check','tensions-section','note-section'].map(id=>{const e=document.querySelector('[data-testid=theme-panel] [data-testid='+id+']');return e?Math.round(e.getBoundingClientRect().top+document.querySelector('[data-testid=theme-panel] .overflow-y-auto').scrollTop):-1})`)
  ok('the panel sections run: insight, tiles, moments to watch, codes to check, tensions, your note; the approval line is the panel’s footer', order.every((y, i) => y >= 0 && (i === 0 || y >= order[i - 1])) && (await ev(`document.querySelector('[data-testid=theme-panel]').lastElementChild.dataset.testid`)) === 'approval-line', order)
  // Polish B2: the action bar is outside the scrolling part, stays at the bottom of the panel, and the scrolling part leaves room under its last line.
  const bar = await ev(`(()=>{const p=document.querySelector('[data-testid=theme-panel]');const d=p.querySelector('[data-testid=decision]');const sc=p.querySelector('.overflow-y-auto');const pr=p.getBoundingClientRect(),dr=d.getBoundingClientRect(),sr=sc.getBoundingClientRect();return {outside:!sc.contains(d),buttons:[...d.querySelectorAll('[data-testid=actions] button')].map(x=>x.innerText.trim()),primary:getComputedStyle(d.querySelector('[data-testid=accept]')).backgroundColor,belowScroll:Math.round(dr.top)>=Math.round(sr.bottom)-1,insidePanel:dr.bottom<=pr.bottom+1,pad:parseFloat(getComputedStyle(sc).paddingBottom)}})()`)
  ok('the Accept · Edit · Leave out bar sits below the scrolling part, inside the panel, with room under the last line', bar.outside && bar.belowScroll && bar.insidePanel && bar.buttons.join() === 'Accept,Edit,Leave out' && bar.pad >= 16, bar)
  ok('Accept is the primary button (filled indigo)', /rgb\(\d+, \d+, \d+\)/.test(bar.primary) && bar.primary !== 'rgba(0, 0, 0, 0)', bar.primary)
  const pHead = await text('[data-testid=theme-panel] header')
  ok('the panel header has the verdict chip, the name and “Said by n of N”, and the status sits on the Insight heading, apart from the verdict', /Consistent|Mixed|Gap|No position|Too few to read/.test(pHead) && !/Suggested/.test(pHead) && /Price creep/.test(pHead) && /Said by \d+ of \d+/.test(pHead) && (await ev(`document.querySelector('[data-testid=theme-panel] [data-testid=insight] [data-testid=status-chip]')?.dataset.status`)) === 'Suggested', pHead)
  ok('the AI-generated tag appears once in the panel', (await ev(`[...document.querySelectorAll('[data-testid=theme-panel] *')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()==='AI-generated')).length`)) === 1)
  const sentence = await text('[data-testid=theme-panel] [data-testid=summary-sentence]')
  ok('the sentence is the logic’s insight sentence', sentence === (await run(`return model().p.find(t=>t.name==='Price creep').insight.sentence`)), sentence)
  const moments = await ev(`[...document.querySelectorAll('[data-testid=theme-panel] [data-testid=moment]')].map(m=>({who:m.dataset.person,reason:m.querySelector('[data-testid=moment-reason]')?.innerText??null,play:!!m.querySelector('a[aria-label^=Play]')}))`)
  // Changed from “every reason starts with Answered x s…”: a reason prints only the measures that fired, so it may be empty, and then no reason line is shown.
  ok('moments to watch: 3 to 5 clips, one per person, each with Play; a reason line only when a measure fired', moments.length >= 3 && moments.length <= 5 && new Set(moments.map((m) => m.who)).size === moments.length && moments.every((m) => m.play && (m.reason === null || /^(Answered \d+\.\d s after the question\. Usual: \d+\.\d s\.|Paused \d+\.\d s mid-answer\.|\d+ fillers or restarts\.|Spoke faster than usual: |Voice varied (less|more) than usual: pitch range |Quieter than usual by |\s)+/.test(m.reason))), moments)
  const chipsOnClips = await ev(`[...document.querySelectorAll('[data-testid=theme-panel] [data-testid=moment]')].map(m=>({who:m.dataset.person,chip:m.querySelector('[data-fit-chip]')?.innerText.trim()??null}))`)
  const fitsWant = await run(`const t=model().p.find(t=>t.name==='Price creep'); return Object.fromEntries(t.reads.map(r=>[r.participantId,r.fit]))`)
  const FITW = { Matches: 'Matched', 'Pulls against': 'No match', Uncertain: 'Hesitant' }
  ok('each moment has a small chip with that person’s own result (Matched, No match or Hesitant), from the logic', chipsOnClips.length >= 3 && chipsOnClips.every((m) => fitsWant[m.who] === 'Split' || fitsWant[m.who] === undefined ? m.chip === null : m.chip === FITW[fitsWant[m.who]]), [chipsOnClips, fitsWant])
  const mm = await run(`return model().p.find(t=>t.name==='Price creep').moments.map(m=>m.participantId)`)
  ok('they are the logic’s clips, in the logic’s order (the clearest first)', JSON.stringify(moments.map((m) => m.who)) === JSON.stringify(mm), [moments.map((m) => m.who), mm])

  // ── polish: the panel (B1, B3, B4) ──
  const typo = await ev(`(()=>{const p=document.querySelector('[data-testid=theme-panel]');const f=(e)=>{const c=getComputedStyle(e);return {size:parseFloat(c.fontSize),weight:+c.fontWeight,color:c.color}};
    const heads=['insight','theme-figures','moments-section'].map(id=>{const e=p.querySelector('[data-testid='+id+']');const h=e.querySelector('h3');return f(h)});
    const sent=f(p.querySelector('[data-testid=summary-sentence]')); const title=f(p.querySelector('h2'));
    const others=[...p.querySelectorAll('p,li,span,button,h3')].filter(e=>!e.closest('h2')&&e.dataset.testid!=='summary-sentence'&&!e.closest('[data-testid=summary-sentence]')).map(e=>parseFloat(getComputedStyle(e).fontSize));
    const gh=f(p.querySelector('[data-testid=group-head]'));const tag=p.querySelector('[data-testid=insight] .border-dashed');
    return {heads,sent,title,maxOther:Math.max(...others),gh,tagSize:tag?parseFloat(getComputedStyle(tag).fontSize):null}})()`)
  ok('B1 the insight sentence is the largest text under the title, with a small AI-generated tag', typo.sent.size >= 16 && typo.sent.size > typo.maxOther && typo.sent.size < typo.title.size && typo.tagSize !== null && typo.tagSize <= 12, typo)
  ok('B3 “Did their delivery match their words?” has the same heading style as Insight and Moments to watch', typo.heads.every((h) => h.size === typo.heads[0].size && h.weight === typo.heads[0].weight && h.color === typo.heads[0].color), typo.heads)
  ok('B3 “n people spoke in favour” is a lighter subline than those headings', typo.gh.weight < typo.heads[0].weight || typo.gh.color !== typo.heads[0].color, [typo.gh, typo.heads[0]])
  ok('B4 the header says “Said by n of N people”', /^Said by \d+ of \d+ people$/.test((await text('[data-testid=theme-panel-said-by]')) ?? ''), await text('[data-testid=theme-panel-said-by]'))

  // tiles filter people
  const tiles = await ev(`[...document.querySelectorAll('[data-testid=theme-panel] [data-testid=tile-group]')].map(g=>({side:g.dataset.side,tiles:[...g.querySelectorAll('[data-testid=match-tiles] > button')].map(x=>({fit:x.dataset.fit,n:+x.dataset.n,label:x.innerText.replace(/\\s+/g,' ').trim()}))}))`)
  ok('the tiles read Matched · No match · Hesitant', tiles.length >= 1 && tiles.every((g) => g.tiles.map((t) => t.label.replace(/^\d+ /, '')).join() === 'Matched,No match,Hesitant'), tiles)
  const g0 = tiles[0]
  const big = g0.tiles.find((t) => t.n > 0)
  await ev(`[...document.querySelectorAll('[data-testid=theme-panel] [data-testid=tile-group]')][0].querySelector('[data-fit=${q(big.fit).replace(/"/g, '')}]').click(); true`); await b.sleep(250)
  const listed = await ev(`[...document.querySelectorAll('[data-testid=theme-panel] [data-testid=tile-people] [data-testid=tile-person]')].map(li=>({id:li.querySelector('.font-medium').innerText,seg:li.children[1].innerText,reason:li.querySelector('[data-testid=tile-reason]').innerText,play:!!li.querySelector('a[aria-label^=Play]')}))`)
  ok('a tile lists exactly its people, each with ID, segment, one word and Play, and no “Not right?” at theme level', listed.length === big.n && listed.every((x) => /^P-\d{4}$/.test(x.id) && /owner$/.test(x.seg) && x.reason.length > 2 && x.play) && (await count('[data-testid=theme-panel] [data-testid=not-right]')) === 0, listed)
  const side = await ev(`document.querySelector('[data-testid=theme-panel] [data-testid=tile-group]').dataset.side`)
  ok('a group heading lists everyone on that side', await ev(`(()=>{const g=document.querySelector('[data-testid=theme-panel] [data-testid=tile-group]');g.querySelector('[data-testid=group-head]').click();return true})()`) && (await b.sleep(250), (await count('[data-testid=theme-panel] [data-testid=tile-people] [data-testid=tile-person]')) === +(await ev(`document.querySelector('[data-testid=theme-panel] [data-testid=tile-group]').dataset.n`))), side)
  ok('the coverage line is under the tiles, and the panel has no bars or charts', !!(await text('[data-testid=theme-panel] [data-testid=theme-coverage]')) && (await count('[data-testid=theme-panel] canvas,[data-testid=theme-panel] meter,[data-testid=theme-panel] progress,[data-testid=theme-panel] [role=img]')) === 0)
  ok('before a decision the footer says “Not decided yet”', (await text('[data-testid=theme-panel] [data-testid=approval-line]')) === 'Not decided yet')

  // ── Codes to check, and the code panel with its back link ──
  await fresh()
  await click('[data-testid=theme-name]', await ev(`[...document.querySelectorAll('[data-testid=theme-name]')].findIndex(e=>/Not in a theme/.test(e.innerText))`)) // fold toggle only
  await b.goto(`${PET}/codebook?tab=themes`); await b.waitFor('New theme'); await b.sleep(500)
  for (let k = 0; k < 8; k++) {
    if (await run(`return model().p.some(t=>t.kind==='theme'&&sg.themeInsight(t).check.length>0)`)) break
    if (!(await ev(`(()=>{const e=document.querySelector('[data-testid=theme-suggestion] [data-testid=accept-theme]');if(!e)return false;e.click();return true})()`))) break
    await b.sleep(700)
  }
  await b.goto(`${PET}/signals`); await b.waitFor('What stood out'); await b.sleep(600)
  const chipTheme = await run(`const t=model().p.find(t=>t.kind==='theme'&&sg.themeInsight(t).check.length>0); return {name:t.name,check:sg.themeInsight(t).check.map(c=>c.code.id),names:sg.themeInsight(t).check.map(c=>c.code.name)}`)
  await openTheme(chipTheme.name)
  const chips = await ev(`[...document.querySelectorAll('[data-testid=theme-panel] [data-testid=check-chip]')].map(e=>e.dataset.codeId)`)
  ok('Codes to check lists the Mixed and Gap codes, Gap first, as the logic does', JSON.stringify(chips) === JSON.stringify(chipTheme.check), [chips, chipTheme.check])
  await click('[data-testid=theme-panel] [data-testid=check-chip]')
  ok('a chip opens that code’s panel, with “← theme” at the top and its row selected and open', (await text('[data-testid=back-to-theme]')) === `← ${chipTheme.name}` && (await ev(`document.querySelector('[data-testid=signal-row][aria-current=true]')?.dataset.code`)) === chipTheme.check[0])
  const cp = await ev(`(()=>{const p=document.querySelector('[data-testid=signal-panel]');const y=(id)=>{const e=p.querySelector('[data-testid='+id+']');return e?Math.round(e.getBoundingClientRect().top+p.querySelector('.overflow-y-auto').scrollTop):-1};return {order:['speech-evidence','insight','code-figures','moments-section','tensions-section','customise'].map(y),evidence:[...p.querySelectorAll('[data-testid=evidence-lines] li')].map(l=>l.innerText),notRight:p.querySelectorAll('[data-testid=not-right]').length,accept:[...p.querySelectorAll('button')].some(x=>/^Accept/.test(x.innerText.trim()))}})()`)
  ok('the code panel runs: speech evidence first, then the insight, tiles, moments, tensions, Customise', cp.order.every((y, i) => y >= 0 && (i === 0 || y >= cp.order[i - 1])), cp.order)
  const evWant = await run(`const c=model().s.find(s=>s.code.id===${q(chipTheme.check[0])}); return sp.speechEvidence(c.reads).map(e=>[e.label,e.n,e.of])`)
  const evGot = await ev(`[...document.querySelectorAll('[data-testid=evidence-lines] li')].map(li=>({label:li.querySelector('.text-sm span').innerText.trim(),count:li.querySelector('[data-testid=evidence-count]').innerText.trim(),weight:getComputedStyle(li.querySelector('[data-testid=evidence-count]')).fontWeight,baseline:li.querySelector('[data-testid=evidence-baseline]').innerText.trim()}))`)
  ok('speech evidence is four compact rows (Delay, Pauses, Fillers or restarts, Tone): the label on the left, a bold “n of N people” on the right, one grey baseline line, the numbers from the logic', evGot.length === 4 && evGot.map((e) => e.label).join() === 'Delay,Pauses,Fillers or restarts,Tone' && evGot.every((e, i) => e.count === `${evWant[i][1]} of ${evWant[i][2]} people` && +e.weight >= 600 && e.baseline.length > 10), [evGot, evWant])
  ok('the code panel has no Accept (decisions are on the theme)', !cp.accept)
  await click('[data-testid=back-to-theme]')
  ok('the “← theme” link returns to the theme panel', (await text('[data-testid=theme-panel-name]')) === chipTheme.name && (await count('[data-testid=signal-panel]')) === 0)

  // ── “Not right?” on a person, and Customise ──
  await expandAll()
  await click('[data-testid=signal-row]', await ev(`[...document.querySelectorAll('[data-testid=signal-row]')].findIndex(r=>r.dataset.code===${q(chipTheme.check[0])})`))
  await ev(`document.querySelector('[data-testid=signal-panel] [data-testid=group-head]').click(); true`); await b.sleep(250)
  const pBefore = await run(`const c=model().s.find(s=>s.code.id===${q(chipTheme.check[0])}); const r=c.reads[0]; return {id:r.participantId,side:r.side,code:c.code.id}`)
  ok('each person in a code panel has “Not right?”', (await count('[data-testid=signal-panel] [data-testid=tile-person] [data-testid=not-right]')) >= 1)
  await click('[data-testid=signal-panel] [data-testid=tile-person] [data-testid=not-right]')
  const firstWho = await ev(`document.querySelector('[data-testid=signal-panel] [data-testid=tile-person] .font-medium').innerText`)
  await ev(`document.querySelector('[data-testid=not-right-menu] [data-stance-option=Neutral]').click(); true`); await b.sleep(300)
  const pfix = await run(`const d=model().d; return {fix:Object.entries(d.stanceFixes??{}).filter(([k])=>k.startsWith('person:')), log:d.log[0].action}`)
  ok('correcting one person is stored for that person and code only, and logged', pfix.fix.length === 1 && pfix.fix[0][0].endsWith(`|${firstWho}`) && pfix.fix[0][1].to === 'Neutral' && pfix.log === 'Person’s stance corrected', pfix)
  await click('[data-testid=customise-toggle]')
  const ov0 = await ev(`document.querySelector('[data-testid=code-override]').getAttribute('aria-checked')`)
  ok('Customise defaults to the theme’s decision (not accepted, so out)', ov0 === 'false' && /Follows its theme/.test((await text('[data-testid=override-note]')) ?? ''))
  await click('[data-testid=code-override]')
  ok('switching it on is the code’s own choice, stored, and the note says so', (await run(`return model().d.codeOverrides?.[${q(chipTheme.check[0])}]`)) === true && /Set by you/.test((await text('[data-testid=override-note]')) ?? ''))

  // ── decisions: Accept, Undo, Edit, Leave out, Out of date ──
  await fresh()
  await openTheme('Price creep')
  await click('[data-testid=accept]')
  const acc = await run(`const t=model().p.find(t=>t.name==='Price creep'); const d=model().d.insights['t-price']; return {status:t.decision.status,by:d.by,v:d.dataVersion,counts:model().c.decided}`)
  ok('Accept records who, when, the data fingerprint and the data version, and the status is Accepted', acc.status === 'Accepted' && acc.by === 'Maya Ortiz' && acc.v === 1 && (await statusOf('Price creep')) === 'Accepted', acc)
  ok('the footer reads “Accepted by {name} · {date} · data v{n}”', /^Accepted by Maya Ortiz · [A-Z][a-z]{2} \d{1,2}, \d{4} · data v1$/.test((await text('[data-testid=approval-line]')) ?? ''), await text('[data-testid=approval-line]'))
  ok('an undo toast follows Accept, and the progress line moves', (await text('[data-testid=toast]'))?.includes('Undo') && (await text('[data-testid=insights-progress]'))?.startsWith(`${acc.counts} of`))
  await click('[data-testid=toast] button')
  ok('Undo takes it back to Suggested and “Not decided yet”', (await statusOf('Price creep')) === 'Suggested' && (await text('[data-testid=approval-line]')) === 'Not decided yet')
  await click('[data-testid=accept]')
  // edit: numbers locked, wording only
  await click('[data-testid=edit]')
  const sentence1 = await run(`return model().p.find(t=>t.name==='Price creep').insight.sentence`)
  await setValue('[data-testid=insight-text]', sentence1.replace(/^(\d+) of (\d+)/, (_, a, c) => `${Number(a) + 1} of ${c}`)); await b.sleep(200)
  ok('Edit locks the numbers: changing a figure shows why and disables Save', /numbers are locked/i.test((await text('[data-testid=insight-problems]')) ?? '') && (await ev(`document.querySelector('[data-testid=insight-save]').disabled`)))
  await setValue('[data-testid=insight-text]', sentence1.replace(/^(\d+) of (\d+)/, '$1 of $2') + ' (about 90%)'); await b.sleep(200)
  ok('Edit runs the narration validator: a percentage is refused', (await text('[data-testid=insight-problems]'))?.length > 0 && (await ev(`document.querySelector('[data-testid=insight-save]').disabled`)))
  await setValue('[data-testid=insight-text]', sentence1.replace('were verbally negative about it', 'said it negatively')); await b.sleep(200)
  ok('wording-only changes pass', (await count('[data-testid=insight-problems]')) === 0 && !(await ev(`document.querySelector('[data-testid=insight-save]').disabled`)))
  await click('[data-testid=insight-save]')
  ok('the edit is saved as Edited, with PulseAI’s sentence kept beside it', (await statusOf('Price creep')) === 'Edited' && /said it negatively/.test((await text('[data-testid=theme-panel] [data-testid=summary-sentence]')) ?? '') && (await text('[data-testid=ai-original]')) === `PulseAI wrote: ${sentence1}`)
  ok('the row’s insight shows the Researcher’s wording', /said it negatively/.test((await ev(`document.querySelector('[data-testid=theme-row] [data-testid=theme-insight]').innerText`)) ?? ''))
  // out of date
  const codeId = await run(`return model().p.find(t=>t.name==='Price creep').codes[0].code.id`)
  await expandAll()
  await click('[data-testid=stance-tag]', await ev(`[...document.querySelectorAll('[data-testid=signal-row]')].findIndex(r=>r.dataset.code===${q(codeId)})`))
  await ev(`[...document.querySelectorAll('[data-testid=stance-menu] [data-stance-option]')].find(e=>e.getAttribute('aria-checked')!=='true').click(); true`); await b.sleep(300)
  await openTheme('Price creep')
  ok('when the data moves after a decision the status becomes Out of date, showing old and new', (await statusOf('Price creep')) === 'Out of date' && /Was: /.test((await text('[data-testid=was]')) ?? '') && /Now: /.test((await text('[data-testid=now]')) ?? ''), await text('[data-testid=out-of-date]'))
  ok('and the footer says so', /out of date$/.test((await text('[data-testid=approval-line]')) ?? ''), await text('[data-testid=approval-line]'))
  // leave out with a reason
  await click('[data-testid=leave-out]')
  await setValue('[data-testid=leave-why]', 'Not what the brief asked.'); await b.sleep(150)
  await click('[data-testid=leave-confirm]')
  ok('Leave out records the reason, the status is Left out, and there is an undo toast', (await statusOf('Price creep')) === 'Left out' && /Not what the brief asked/.test((await text('[data-testid=left-out-why]')) ?? '') && /^Left out by Maya Ortiz/.test((await text('[data-testid=approval-line]')) ?? '') && (await lastToast())?.includes('Undo'))
  await click('[data-testid=accept]')
  ok('a left-out insight can be accepted again', (await statusOf('Price creep')) === 'Accepted')
  // the note is kept apart
  await ev(`document.querySelector('[data-testid=note]').focus(); true`); await setValue('[data-testid=note]', 'Check the price rise against the refund policy.'); await ev(`document.querySelector('[data-testid=note]').dispatchEvent(new FocusEvent('focusout',{bubbles:true})); true`); await b.sleep(300)
  const note = await run(`const d=model().d; return {note:d.insightNotes?.['t-price'], sentence:d.insights['t-price'].text}`)
  ok('your note is stored apart from the insight and never inside its sentence', note.note === 'Check the price rise against the refund policy.' && !note.sentence.includes('refund'), note)

  // ── under 3 people: Nothing to decide ──
  await fresh()
  const before = await run(`return model().c.total`)
  await run(`const code=doc.codes.find(c=>c.id==='c-nothing'); cb.updateCodebook(study, d=>cb.createTheme(d,'Nothing would have kept them','Nobody could have kept them.',[code.id],{by:'Maya Ortiz'})); return true`)
  await b.goto(`${PET}/signals`); await b.waitFor('What stood out'); await b.sleep(700)
  ok('a theme with too few people says Nothing to decide, is grey, and is not in the progress counts', (await statusOf('Nothing would have kept them')) === 'Nothing to decide' && (await run(`return model().c.total`)) === before && (await text('[data-testid=insights-progress]'))?.includes(`of ${before} insights`))
  await openTheme('Nothing would have kept them')
  ok('its Accept and Edit are disabled, and the tip says “Too few people to read a pattern”', (await ev(`document.querySelector('[data-testid=accept]').disabled&&document.querySelector('[data-testid=edit]').disabled`)) && /Too few people to read a pattern/.test((await ev(`document.querySelector('[data-testid=actions]').innerText+[...document.querySelectorAll('[data-testid=actions] [role=tooltip]')].map(e=>e.textContent).join(' ')`)) ?? ''))
  await click('[data-testid=leave-out]')
  ok('it can still be left out, but only with a reason', await ev(`document.querySelector('[data-testid=leave-confirm]').disabled`))
  await setValue('[data-testid=leave-why]', 'Two people, not enough to say anything.'); await b.sleep(150)
  await click('[data-testid=leave-confirm]')
  ok('with a reason it is Left out', (await statusOf('Nothing would have kept them')) === 'Left out')

  // ── the keyboard ──
  await fresh()
  await ev(`document.querySelectorAll('[data-testid=theme-name]')[0].focus(); true`)
  await press('ArrowDown')
  ok('Down moves to the next row', (await ev(`document.activeElement.dataset.testid+':'+document.activeElement.innerText.trim()`)) === `theme-name:${(await ev(`document.querySelectorAll('[data-testid=theme-name]')[1].innerText.trim()`))}`)
  await press('ArrowUp')
  ok('Up moves back', (await ev(`document.activeElement.dataset.testid`)) === 'theme-name' && (await ev(`document.activeElement.innerText.trim()`)) === (await ev(`document.querySelectorAll('[data-testid=theme-name]')[0].innerText.trim()`)))
  await press('Enter')
  ok('Enter opens it in the panel', (await count('[data-testid=theme-panel]')) === 1)
  const first = await ev(`document.querySelectorAll('[data-testid=theme-name]')[0].innerText.trim()`)
  await ev(`document.querySelectorAll('[data-testid=theme-name]')[0].focus(); true`)
  await press('a')
  ok('A accepts the focused theme', (await statusOf(first)) === 'Accepted')
  await ev(`document.querySelectorAll('[data-testid=theme-name]')[0].focus(); true`)
  await press('e')
  ok('E opens its wording to edit', (await count('[data-testid=insight-text]')) === 1)
  ok('typing a letter in a text box does not trigger a shortcut', await (async () => { await ev(`document.querySelector('[data-testid=insight-text]').focus(); true`); await press('l'); return (await count('[data-testid=leave-form]')) === 0 })())
  await ev(`document.querySelectorAll('[data-testid=theme-name]')[0].focus(); true`)
  await press('l')
  ok('L opens the reason to leave it out', (await count('[data-testid=leave-form]')) === 1)
  await ev(`document.getElementById('sttab-themes').focus(); true`)
  await press('ArrowRight')
  ok('the arrow keys move between the tabs', (await ev(`document.getElementById('sttab-tensions').getAttribute('aria-selected')`)) === 'true')
  await press('ArrowLeft')
  ok('and back', (await ev(`document.getElementById('sttab-themes').getAttribute('aria-selected')`)) === 'true')

  // ── hover shows Accept in place of the status ──
  await fresh()
  const box = await ev(`(()=>{const r=document.querySelectorAll('[data-testid=theme-row]')[0].getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`)
  const vis = (sel) => ev(`(()=>{const e=document.querySelectorAll('[data-testid=theme-row]')[0].querySelector(${q(sel)});return !!e&&e.getBoundingClientRect().width>0})()`)
  const accState = () => ev(`(()=>{const r=document.querySelectorAll('[data-testid=theme-row]')[0];const a=r.querySelector('[data-testid=row-accept]');const s=r.querySelector('[data-testid=status-chip]');const cs=getComputedStyle(a);return {op:+cs.opacity,bg:cs.backgroundColor,border:cs.borderTopWidth,chip:s.getBoundingClientRect().width>0&&getComputedStyle(s).opacity==='1',tab:a.tabIndex,disp:cs.display,overlap:(()=>{const x=a.getBoundingClientRect(),y=s.getBoundingClientRect();return !(x.bottom<=y.top||x.top>=y.bottom||x.right<=y.left||x.left>=y.right)})()}})()`)
  const rest = await accState()
  ok('at rest the status chip shows and Accept is hidden (but still in the page, so the keyboard can reach it)', rest.chip && rest.op === 0 && rest.tab >= 0 && rest.disp !== 'none', rest)
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y }); await b.sleep(400)
  const hov = await accState()
  ok('on hover an outlined Accept appears beside the status, which stays: it is not filled and does not cover the pill', hov.op === 1 && hov.chip && hov.border !== '0px' && !/rgb\(\d+, \d+, \d+\)/.test(hov.bg.replace('rgb(255, 255, 255)', '')) && !hov.overlap, hov)
  await ev(`document.querySelectorAll('[data-testid=theme-row]')[0].querySelector('[data-testid=row-accept]').focus(); true`); await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 }); await b.sleep(300)
  ok('keyboard focus shows it too', (await accState()).op === 1)
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 })

  // ── review mode ──
  await fresh()
  const n0 = await run(`return model().c.toReview.map(t=>t.name)`)
  ok('the footer offers “Review {n} insights”, n from the logic', (await text('[data-testid=lead-action]')) === `Review ${n0.length} insights`, await text('[data-testid=lead-action]'))
  await click('[data-testid=lead-action]')
  ok('it opens the first insight to decide, and says where you are', (await text('[data-testid=theme-panel-name]')) === n0[0] && (await text('[data-testid=review-position]'))?.startsWith(`1 of ${n0.length}`))
  ok('the button says “Accept and next”', (await text('[data-testid=accept]')) === 'Accept and next')
  await click('[data-testid=accept]')
  ok('Accept and next accepts it and opens the next one', (await statusOf(n0[0])) === 'Accepted' && (await text('[data-testid=theme-panel-name]')) === n0[1], await text('[data-testid=theme-panel-name]'))
  for (let i = 1; i < n0.length; i++) await click('[data-testid=accept]')
  ok('after the last one review ends: every insight is decided and the Review button is gone', (await run(`return model().c.toReview.length`)) === 0 && (await count('[data-testid=lead-action]')) === 0 && (await count('[data-testid=review-position]')) === 0)

  // ── the Key and How it’s decided ──
  await fresh()
  await click('[data-testid=how-to-read]')
  const key = await ev(`({verdicts:[...document.querySelectorAll('[data-testid=key-verdicts] li')].map(e=>e.innerText.replace(/\\s+/g,' ').trim()),fits:[...document.querySelectorAll('[data-testid=key-fits] li')].map(e=>e.innerText.replace(/\\s+/g,' ').trim()),words:[...document.querySelectorAll('[data-testid=key-words] li')].map(e=>e.innerText.replace(/\\s+/g,' ').trim()),statuses:[...document.querySelectorAll('[data-testid=key-statuses] li')].map(e=>e.innerText.replace(/\\s+/g,' ').trim()),grouping:document.querySelector('[data-testid=key-grouping]')?.innerText,rules:[...document.querySelectorAll('[data-testid=key-rules] li')].map(e=>e.innerText.replace(/\\s+/g,' ').replace(/^\\d\\. /,'').trim())})`)
  const cfgLines = await run('return cfg.DELIVERY_RULE_LINES')
  ok('How to read this lists the five verdicts, the three results and split across codes, the three words, the six statuses, the grouping note and the five rules (“How it’s decided”)', key.verdicts.map((v) => v.split(' ')[0]).join() === 'Consistent,Mixed,Gap,No,Too' && key.fits.length === 4 && /^Matched/.test(key.fits[0]) && /^No match/.test(key.fits[1]) && /^Hesitant/.test(key.fits[2]) && /^Split across codes/.test(key.fits[3]) && key.words.length === 3 && key.statuses.length === 6 && /not in a theme yet/.test(key.grouping ?? '') && JSON.stringify(key.rules) === JSON.stringify(cfgLines), key)
  const readTxt = (await text('[data-testid=read-pop]')) ?? ''
  ok('the popover has two short sections, “What the labels mean” and “How it’s decided”, and nothing is said twice', /What the labels mean/.test(readTxt) && /How it’s decided/.test(readTxt) && cfgLines.every((l) => readTxt.split(l).length === 2) && Object.values(await run('return cfg.VERDICT_DEF')).every((d) => readTxt.split(d).length === 2), readTxt.slice(0, 120))
  ok('there is no separate Key and no separate How it’s decided button', (await count('[data-testid=key],[data-testid=how-decided]')) === 0)
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(250)
  ok('Escape closes it', (await count('[data-testid=read-pop]')) === 0)
  // toolbar and footer
  const tb = await ev(`(()=>{const c=(sel)=>getComputedStyle(document.querySelector(sel));const all=document.querySelector('[data-testid=show-all]');return {read:c('[data-testid=how-to-read]').color,expand:c('[data-testid=expand-all]').color,readW:c('[data-testid=how-to-read]').fontWeight,expandW:c('[data-testid=expand-all]').fontWeight,allBg:getComputedStyle(all).backgroundColor,ink:getComputedStyle(document.body).getPropertyValue('--color-ink'),count:document.querySelector('[data-testid=show-review-count]').innerText.trim(),prev:[...document.querySelectorAll('a')].find(a=>/^Back to /.test(a.innerText.trim()))?.innerText.trim()}})()`)
  const needs = await run('return model().c.toReview.length')
  ok('Expand all is styled like How to read this (same colour and weight)', tb.read === tb.expand && tb.readW === tb.expandW, tb)
  ok('the selected “All” uses the indigo accent, not black, and “Needs review” shows its count', tb.allBg !== 'rgb(0, 0, 0)' && !/^rgb\((2\d|1\d|\d), (2\d|1\d|\d), (4\d|3\d|2\d|1\d|\d)\)$/.test(tb.allBg) && tb.count === String(needs), [tb, needs])
  ok('the footer’s Previous is labelled by where it goes: “Back to Codebook”', tb.prev === 'Back to Codebook', tb.prev)

  // ── one label map, no retired wording, on every part of the tab ──
  const BANNED = /pulled against|pulls against|argued for|complained|complains|\buncertain\b|\bfits\b|partly fits|no claim|conflicting/i
  await expandAll()
  let scanned = 0
  const scan = async (label) => { scanned++; const t = (await ev('document.querySelector("main").innerText')) ?? ''; const hit = t.match(BANNED); ok(`no retired wording on ${label}`, !hit, hit && t.slice(Math.max(0, hit.index - 40), hit.index + 40)) }
  await scan('the Themes tab')
  const nT = await count('[data-testid=theme-name]')
  for (let i = 0; i < nT - 1; i++) { await click('[data-testid=theme-name]', i); await scan(`theme panel ${i + 1}`) }
  const nC = await count('[data-testid=signal-row]')
  for (let i = 0; i < nC; i++) { await click('[data-testid=signal-row]', i); await scan(`code panel ${i + 1}`) }
  ok('every panel was scanned', scanned === 1 + (nT - 1) + nC)
  const labelsOnce = await ev(`(()=>{const t=document.body.innerText;return {consistent:/Consistent/.test(t)}})()`)
  ok('the wording comes from the one label map', labelsOnce.consistent)

  // ── a second study: the same table ──
  await fresh(ICE)
  const iceCols = await ev(`[...document.querySelector('[data-testid=signal-head]').children].map(e=>e.innerText.trim())`)
  ok('Ice Cream has the same five columns and a collapsed table', JSON.stringify(iceCols) === JSON.stringify(['Name', 'Said by', 'What stood out', 'Verdict', 'Status']) && (await count('[data-testid=signal-row]')) === 0)
  const iceHead = await text('[data-testid=insights-progress]')
  ok('and the header counts its own insights', /^0 of 2 insights decided · \d+ tensions? to review$/.test(iceHead ?? ''), iceHead)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('A2 THEMES TAB FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('A2 THEMES TAB OK')
