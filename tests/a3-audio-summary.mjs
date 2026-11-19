// A3 Audio summary. Step 1: the script logic and the store, tested on their own (no page yet). Later steps add the page tests below.
//   npx vite --port 5199 --strictPort &   then   node tests/a3-audio-summary.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail !== undefined ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
}
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const PRE = `${MOD};
  const cb=await window.__mod('/src/state/codebook'); const ms=await window.__mod('/src/mock/signals'); const sess=await window.__mod('/src/mock/sessions'); const sc=await window.__mod('/src/state/audioScript'); const st=await window.__mod('/src/state/audioSummary'); const nr=await window.__mod('/src/state/narration'); const cfg=await window.__mod('/src/config/audioSummary'); const ex=await window.__mod('/src/state/execSummary'); const rl=await window.__mod('/src/state/reportLogic')
  const store=()=>Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))))[0]
  const sid=(p)=>sess.sessionIdOf(sess.PET_SEED_SESSIONS.find(x=>x.participant===p&&x.variant==='done'))
  const basisOf=(parts)=>cb.basisOf(parts.map(p=>({id:sid(p),participantId:p})))
  const mk=(doc)=>({doc:doc??store(),basis:basisOf(ms.ACCEPTED_PARTICIPANTS),studyName:'Pet Food Subscription Churn',release:'Release v1.0'})
  const excl=sess.PET_SEED_SESSIONS.filter(s=>s.review?.status==='Excluded').map(s=>s.participant)`
const run = (body) => b.evaluate(`(async()=>{${PRE}; ${body}})()`)

try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto('/researcher/studies/pet-food-churn/analysis/report/videos'); await b.waitFor('Theme videos'); await b.sleep(1500)

  // ═══ What feeds the script ═══
  const draft = await run(`const ctx=mk(); const d=sc.buildDraft(ctx,10); const doc=ctx.doc; const dec=cb.tensionDecisions(doc)
    return {lines:d.lines.map(l=>({key:l.key,chapter:l.chapter,type:l.type,text:l.text,src:l.source,cites:l.cites.length,locked:!!l.locked,state:l.state,audio:l.audio})), chapters:sc.chaptersOf(d.lines), tensions:Object.entries(dec).map(([id,v])=>[id,v.status]), leftOut:d.leftOut, themes:cb.codeThemes(doc).map(t=>t.id)}`)
  const L = draft.lines
  ok('the chapters are in order: about, headline, one for each theme largest first, where it splits, thin evidence, close', JSON.stringify(draft.chapters) === JSON.stringify(['about', 'headline', 'theme:t-pet', 'theme:t-price', 'tensions', 'thin', 'close']), draft.chapters)
  ok('only the approved tension (Between concepts) produces a line: suggested and dismissed ones never do', L.filter((l) => l.src?.kind === 'tension').every((l) => l.src.id === 'tn-pause-concept') && L.some((l) => l.src?.kind === 'tension') && draft.tensions.filter(([, s]) => s !== 'Added as a tension theme').every(([id]) => !L.some((l) => l.src?.id === id)), draft.tensions)
  const cites = await run(`const ctx=mk(); const d=sc.buildDraft(ctx,10); const out=d.lines.flatMap(l=>l.cites); return {n:out.length,excluded:out.filter(c=>excl.includes(c.participantId)).length,notAccepted:out.filter(c=>!ctx.basis.sessions.has(c.sessionId)).length,excl}`)
  ok('excluded sessions never appear: every cited turn is from an accepted session', cites.n > 10 && cites.excl.length === 2 && cites.excluded === 0 && cites.notAccepted === 0, cites)

  // ═══ Narration rules ═══
  const rules = await run(`const ctx=mk(); const d=sc.buildDraft(ctx,10); const n=d.lines.filter(l=>l.type==='narration')
    return n.map(l=>({key:l.key,text:l.text,cites:l.cites.length,figs:nr.figures(l.text).length,close:l.key==='headline-close',words:nr.words(l.text),pct:/%|percent/i.test(l.text),ok:nr.checkNarration(l.text,{faceBased:l.key==='tension:tn-pause-portion-face:n',figuresAllowed:l.key==='headline-close'?2:1}).ok,numbers:sc.numbersCheck(l.text,l.source,l.cites,ctx).every(x=>x.ok),mostOk:!/\\b(most people|majority)\\b/i.test(l.text)||nr.figures(l.text).some(f=>f.n*2>f.of)}))`)
  ok('every narration line has a citation and exactly one “n of N” (the close-to-even line has two, set side by side)', rules.length >= 8 && rules.every((r) => r.cites >= 1 && r.figs === (r.close ? 2 : 1)), rules.filter((r) => r.cites < 1 || r.figs !== (r.close ? 2 : 1)))
  ok('none is over 28 words, none has a percentage, “most” only above half, and all pass the shared rules', rules.every((r) => r.words <= 28 && !r.pct && r.mostOk && r.ok), rules.filter((r) => !r.ok))
  ok('every number in a line equals its source’s count', rules.every((r) => r.numbers), rules.filter((r) => !r.numbers))
  const quotes = await run(`const ctx=mk(); const d=sc.buildDraft(ctx,10); const q=d.lines.filter(l=>l.type==='quote'); return {n:q.length,verbatim:q.every(l=>l.text===cb.excerpt(l.cites[0].excerptId).text),people:q.map(l=>l.cites[0].participantId),withSegment:q.every(l=>/(Dog|Cat) owner/.test(sc.segmentLabel(l.cites[0].participantId))),cited:q.every(l=>l.cites.length===1&&!!l.cites[0].sessionId&&l.cites[0].atSec>=0)}`)
  ok('quotes are verbatim, each with its own session, participant, time and segment', quotes.n >= 4 && quotes.verbatim && quotes.withSegment && quotes.cited, quotes)
  ok('at most one quote for each person across the episode', new Set(quotes.people).size === quotes.people.length, quotes.people)
  const exec = await run(`const ctx=mk(); const e=ex.execDraft({doc:ctx.doc,basis:ctx.basis}).map(s=>({text:rl.renderTemplate(s.template,ctx),close:/close to even/.test(s.template)})); return e.map(s=>({ok:nr.checkNarration(s.text,{maxWords:25,figuresAllowed:s.close?2:1}).ok,text:s.text}))`)
  ok('the executive summary’s sentences pass the same shared validator (25 words, two figures only for the close-to-even one)', exec.length === 6 && exec.every((e) => e.ok), exec.filter((e) => !e.ok))

  // ═══ Spoken words and length ═══
  const sp = await run(`return {a:nr.spoken('9 of 20 people'),b:nr.numberWords(23),c:nr.numberWords(100),d:nr.numberWords(7),e:nr.spoken('Q3 was 12 of 14'),secs:sc.lineSeconds('9 of 20 people said it'),words:nr.spokenWords('9 of 20 people said it'),wpm:cfg.AUDIO.wordsPerMinute,pause:cfg.AUDIO.pauseSec}`)
  ok('digits become words for speaking: “nine of twenty people”, twenty-three, one hundred', sp.a === 'nine of twenty people' && sp.b === 'twenty-three' && sp.c === 'one hundred' && sp.d === 'seven' && /twelve of fourteen/.test(sp.e), sp)
  ok('length is spoken words over the configured rate, plus the pause: 6 spoken words at 150 a minute is 2.4 s plus 0.6 s', sp.words === 6 && Math.abs(sp.secs - (6 / (sp.wpm / 60) + sp.pause)) < 1e-9 && sp.wpm === 150 && sp.pause === 0.6, sp)
  const len = await run(`const ctx=mk(); const d=sc.buildDraft(ctx,10); const t=sc.timeline(d.lines); const sum=t.reduce((n,l)=>n+l.seconds,0); return {sum,total:sc.totalSeconds(d.lines),lastEnd:t[t.length-1].start+t[t.length-1].seconds,starts:t.every((l,i)=>i===0?l.start===0:Math.abs(l.start-(t[i-1].start+t[i-1].seconds))<1e-9)}`)
  ok('the timeline is computed: start times run on from each line, and the total is their sum', len.starts && Math.abs(len.sum - len.total) < 1e-6 && Math.abs(len.lastEnd - len.total) < 1e-6 && len.total > 60, len)
  ok('a script of this size is outside 8 to 12 minutes, which is a warning and no more', await run(`const ctx=mk(); const d=sc.buildDraft(ctx,10); return sc.outsideBrief(sc.totalSeconds(d.lines))===true && sc.outsideBrief(9*60)===false && sc.outsideBrief(7*60)===true && sc.outsideBrief(13*60)===true`))

  // ═══ Locked frame lines ═══
  const frames = await run(`const ctx=mk(); const doc=st.newDoc('pet-food-churn',sc.buildDraft(ctx,10),10,'Maya Ortiz'); const open=doc.lines.find(l=>l.key==='frame-open'); const close=doc.lines.find(l=>l.key==='frame-close')
    const e=st.editLine(doc,open.id,'Something else.','Maya Ortiz',ctx); const r=st.removeLine(doc,open.id,'Maya Ortiz'); const r2=st.removeLine(doc,close.id,'Maya Ortiz')
    return {open:open.text,close:close.text,locked:open.locked&&close.locked,approved:open.state==='Approved',editBlocked:e.problems.length>0&&e.doc===doc,removeBlocked:r===doc&&r2===doc}`)
  ok('the opening says it is AI-generated, how many accepted sessions it uses, and that quotes are read by a second voice', /AI-generated summary/.test(frames.open) && /20 accepted sessions/.test(frames.open) && /second voice/.test(frames.open), frames.open)
  ok('the closing names the study and release; both are locked: they can’t be edited or removed', /Pet Food Subscription Churn, Release v1\.0/.test(frames.close) && frames.locked && frames.editBlocked && frames.removeBlocked, frames)

  // ═══ Editing ═══
  const edit = await run(`const ctx=mk(); let doc=st.newDoc('pet-food-churn',sc.buildDraft(ctx,10),10,'Maya Ortiz'); const line=doc.lines.find(l=>l.key==='theme:t-price:c-price-rise'); const real=sc.numbersCheck(line.text,line.source,line.cites,ctx)[0].text
    doc=st.approve(doc,line.id,'Maya Ortiz',ctx); const wasApproved=doc.lines.find(l=>l.id===line.id).state
    const bad=st.editLine(doc,line.id,'“Price went up” came up for 9 of 20 people.','Maya Ortiz',ctx); const nosrc=st.editLine(doc,line.id,'“Price went up” came up for 8 of 20 people.','Maya Ortiz',ctx,undefined,[])
    const good=st.editLine(doc,line.id,'“Price went up” was raised by '+real+' people.','Maya Ortiz',ctx); const after=good.doc.lines.find(l=>l.id===line.id)
    const note=st.addNote(doc,'headline','A plain thought from me.','Maya Ortiz',ctx); const noteNum=st.addNote(doc,'headline','It was 9 of 20 people.','Maya Ortiz',ctx); const noteMatch=st.addNote(doc,'headline','It was '+real+' people.','Maya Ortiz',ctx,line.source,line.cites)
    const added=note.doc.lines.find(l=>l.type==='note')
    return {real,wasApproved,badProblems:bad.problems,badSaved:bad.doc!==doc,nosrcProblems:nosrc.problems,goodProblems:good.problems,after:{state:after.state,edited:after.edited,audio:after.audio,prev:after.history.at(-1)},noteOk:note.problems.length===0&&added.state==='Not approved'&&added.author==='Maya Ortiz',noteNumBlocked:noteNum.problems.length>0&&/needs a source/.test(noteNum.problems[0]),noteMatchOk:noteMatch.problems.length===0}`)
  ok('Save is blocked when the number doesn’t match its source, and says “Says 9 of 20. The data says 8 of 20”', edit.badProblems.includes('Says 9 of 20. The data says 8 of 20') && !edit.badSaved, edit)
  ok('Save is blocked on a narration line with no source', edit.nosrcProblems.includes('Add a source'), edit.nosrcProblems)
  ok('a good edit saves: the line is Edited, needs audio, its approval is gone and the old wording is in History', edit.wasApproved === 'Approved' && edit.goodProblems.length === 0 && edit.after.state === 'Edited' && edit.after.edited === true && edit.after.audio === 'Needs audio' && edit.after.prev.action === 'Edited' && /came up for/.test(edit.after.prev.previous), edit)
  ok('a Researcher’s note with no count saves as it is; one with a count needs a linked source that matches', edit.noteOk && edit.noteNumBlocked && edit.noteMatchOk, edit)
  const rw = await run(`const ctx=mk(); let doc=st.newDoc('pet-food-churn',sc.buildDraft(ctx,10),10,'Maya Ortiz'); const line=doc.lines.find(l=>l.key==='theme:t-price:c-price-rise'); const before=line.text
    const r1=st.rewrite(doc,line.id,'','Maya Ortiz'); const a=r1.lines.find(l=>l.id===line.id); const r2=st.rewrite(r1,line.id,'Shorter','Maya Ortiz'); const b2=r2.lines.find(l=>l.id===line.id)
    return {changed:a.text!==before,fig:nr.figures(a.text)[0]&&nr.figures(a.text)[0].n===nr.figures(before)[0].n&&nr.figures(a.text)[0].of===nr.figures(before)[0].of,passes:nr.checkNarration(a.text).ok&&nr.checkNarration(b2.text).ok,keptBefore:a.history.at(-1).previous===before,audio:a.audio,state:a.state,numbers:sc.numbersCheck(a.text,a.source,a.cites,ctx).every(x=>x.ok),short:b2.text.length<=a.text.length}`)
  ok('Rewrite gives another wording of the same claim: same figure, passes the rules, previous wording in History, needs audio', rw.changed && rw.fig && rw.passes && rw.keptBefore && rw.audio === 'Needs audio' && rw.state === 'Not approved' && rw.numbers, rw)

  // ═══ Voices and audio ═══
  const au = await run(`const ctx=mk(); let doc=st.newDoc('pet-food-churn',sc.buildDraft(ctx,10),10,'Maya Ortiz'); const live=doc.lines.filter(l=>!l.removed)
    const nv=st.setVoice(doc,'narrator','Warm','Maya Ortiz'); const qv=st.setVoice(doc,'quote','Second voice, warm','Maya Ortiz')
    const nNeeds=nv.lines.filter(l=>l.audio==='Needs audio'); const qNeeds=qv.lines.filter(l=>l.audio==='Needs audio')
    const edited=st.editLine(doc,live.find(l=>l.key==='theme:t-price:c-price-rise').id,'Price creep was raised by '+sc.numbersCheck(live.find(l=>l.key==='theme:t-price:c-price-rise').text,live.find(l=>l.key==='theme:t-price:c-price-rise').source,live.find(l=>l.key==='theme:t-price:c-price-rise').cites,ctx)[0].text+' people.','Maya Ortiz',ctx).doc
    const r=st.regenerateAudio(edited,undefined,'Maya Ortiz'); const before=edited.lines.filter(l=>l.audio==='Needs audio').length
    const one=st.regenerateAudio(nv,[live.find(l=>l.type==='quote').id],'Maya Ortiz')
    return {nOnly:nNeeds.every(l=>l.type!=='quote')&&nNeeds.length===live.filter(l=>l.type!=='quote').length,qOnly:qNeeds.every(l=>l.type==='quote')&&qNeeds.length===live.filter(l=>l.type==='quote').length,textSame:JSON.stringify(nv.lines.map(l=>l.text))===JSON.stringify(doc.lines.map(l=>l.text)),statesSame:JSON.stringify(nv.lines.map(l=>l.state))===JSON.stringify(doc.lines.map(l=>l.state)),before,made:r.made,after:r.doc.lines.filter(l=>l.audio==='Needs audio').length,untouched:r.doc.lines.filter(l=>l.audio==='Current').length===live.length,oneMade:one.made,oneLeft:one.doc.lines.filter(l=>l.audio==='Needs audio').length,nonQuote:live.filter(l=>l.type!=='quote').length,total:live.length}`)
  ok('changing the narrator voice marks every narrator-read line “Needs audio” and nothing else; the quote voice only the quotes', au.nOnly && au.qOnly && au.textSame && au.statesSame, au)
  ok('regenerating audio touches only lines that need it: one edited line, one regenerated, none left', au.before === 1 && au.made === 1 && au.after === 0 && au.untouched, au)
  ok('regenerating a line whose audio is current does nothing: after a narrator voice change, a quote line makes none and leaves all the narrator lines waiting', au.oneMade === 0 && au.oneLeft === au.nonQuote, au)

  // ═══ Remove, restore, rebuild, start over ═══
  const rb = await run(`const ctx=mk(); let doc=st.newDoc('pet-food-churn',sc.buildDraft(ctx,10),10,'Maya Ortiz'); const k=(key)=>doc.lines.find(l=>l.key===key)
    const approvedKey='theme:t-price:c-price-rise', editedKey='theme:t-pet:c-pet-refused', removedKey='theme:t-pet:c-vet-diet'
    doc=st.approve(doc,k(approvedKey).id,'Maya Ortiz',ctx)
    const realText=sc.numbersCheck(k(editedKey).text,k(editedKey).source,k(editedKey).cites,ctx)[0].text
    doc=st.editLine(doc,k(editedKey).id,'“Pet stopped eating it” was raised by '+realText+' people.','Maya Ortiz',ctx).doc
    doc=st.addNote(doc,'headline','My own thought.','Maya Ortiz',ctx).doc
    doc=st.removeLine(doc,k(removedKey).id,'Maya Ortiz')
    const removed=doc.lines.find(l=>l.key===removedKey).removed
    const draft12=sc.buildDraft(ctx,12); const re=st.rebuild(doc,draft12,12,'Maya Ortiz')
    const get=(d,key)=>d.lines.find(l=>l.key===key)
    const restored=st.restoreLine(re,get(re,removedKey).id,'Maya Ortiz')
    const unapprovedBefore=doc.lines.filter(l=>l.key&&l.state==='Not approved'&&!l.edited&&!l.removed).map(l=>l.text)
    return {removedBy:removed&&removed.by,approvedKept:get(re,approvedKey).state==='Approved'&&get(re,approvedKey).id===get(doc,approvedKey).id,editedKept:get(re,editedKey).edited===true&&get(re,editedKey).text===get(doc,editedKey).text,noteKept:re.lines.some(l=>l.type==='note'&&l.text==='My own thought.'),removedStays:!!get(re,removedKey).removed,restoredBack:!get(restored,removedKey).removed&&get(restored,removedKey).audio==='Needs audio',target:re.target,replaced:re.lines.filter(l=>l.key&&l.state==='Not approved'&&!l.edited&&!l.removed).length>0,lost:st.editsLost(doc),lostFresh:st.editsLost(st.newDoc('pet-food-churn',draft12,12,'x')),over:st.startOver(doc,draft12,12,'Maya Ortiz'),noteAfterOver:st.startOver(doc,draft12,12,'Maya Ortiz').lines.some(l=>l.type==='note')}`)
  ok('removing a line records who and when, and Restore brings it back (needing audio)', rb.removedBy === 'Maya Ortiz' && rb.restoredBack, rb)
  ok('Rebuild keeps the Approved line, the Edited line and the note, and a removed AI line stays removed until restored', rb.approvedKept && rb.editedKept && rb.noteKept && rb.removedStays && rb.target === 12, rb)
  ok('Rebuild replaces only the Not-approved AI lines (they are written again for the new length)', rb.replaced)
  ok('Start over says how many edits are lost: the edited line, the note and the removed line make 3, and a fresh draft has 0', rb.lost === 3 && rb.lostFresh === 0 && rb.noteAfterOver === false, { lost: rb.lost, fresh: rb.lostFresh })

  // ═══ The analysis changed ═══
  const ch = await run(`const ctx=mk(); let doc=st.newDoc('pet-food-churn',sc.buildDraft(ctx,10),10,'Maya Ortiz')
    // Lower a count: take one person's quote out of "Price went up". Dismiss the approved tension.
    const d2=JSON.parse(JSON.stringify(ctx.doc)); const code=d2.codes.find(c=>c.id==='c-price-rise'); code.excerpts=code.excerpts.slice(0,-1)
    const ctx2={...ctx,doc:cb.tensionDecisions? d2:d2}
    const before=doc.lines.map(l=>[l.key,sc.staleOf(l,ctx).state]); const after=doc.lines.filter(l=>l.key).map(l=>({key:l.key,s:sc.staleOf(l,ctx2)}))
    const changed=after.filter(x=>x.s.state==='changed'||x.s.state==='gone').map(x=>x.key)
    const d3=JSON.parse(JSON.stringify(ctx.doc)); d3.tensions={...d3.tensions,'tn-pause-concept':{status:'Dismissed',by:'t',at:'now',why:'x'}}; d3.themes=d3.themes.filter(t=>t.tensionId!=='tn-pause-concept')
    const ctx3={...ctx,doc:d3}; const tension=doc.lines.find(l=>l.key==='tension:tn-pause-concept:n'); const ts=sc.staleOf(tension,ctx3)
    // An edited line is never overwritten by an update.
    const line=doc.lines.find(l=>l.key==='theme:t-price:c-price-rise'); const real=sc.numbersCheck(line.text,line.source,line.cites,ctx)[0].text
    const edited=st.editLine(doc,line.id,'“Price went up” was given by '+real+' people.','Maya Ortiz',ctx).doc
    const draft2=sc.buildDraft(ctx2,10); const kept=st.chooseUpdate(edited,line.id,'mine',draft2,'Maya Ortiz',ctx2); const taken=st.chooseUpdate(edited,line.id,'new',draft2,'Maya Ortiz',ctx2)
    return {allCurrentBefore:before.every(([,s])=>s==='current'),changed,was:after.find(x=>x.key==='theme:t-price:c-price-rise').s,tensionState:ts,keptText:kept.lines.find(l=>l.id===line.id).text===edited.lines.find(l=>l.id===line.id).text,keptFlag:!!kept.lines.find(l=>l.id===line.id).keptAs,keptNotStale:!st.isOutOfDate(kept.lines.find(l=>l.id===line.id),ctx2),takenText:taken.lines.find(l=>l.id===line.id).text,takenState:taken.lines.find(l=>l.id===line.id).state,untouchedNoOp:st.updateLine(edited,'nope',draft2,'x')===edited}`)
  ok('before anything changes, no line is out of date', ch.allCurrentBefore)
  ok('lowering a count marks exactly the lines built from it (and no others), with the old and new values', ch.changed.includes('theme:t-price:c-price-rise') && ch.was.state === 'changed' && /^Was 8 of 20, now 7 of 20$/.test(ch.was.why) && !ch.changed.includes('frame-open') && !ch.changed.includes('theme:t-pet:n'), ch)
  ok('dismissing the approved tension makes its line “gone”: This tension was dismissed, so it can only be removed', ch.tensionState.state === 'gone' && ch.tensionState.why === 'This tension was dismissed', ch.tensionState)
  ok('an edited line is never overwritten without a choice: “keep mine” leaves the text and flags it kept; “take the new one” rewrites it', ch.keptText && ch.keptFlag && ch.keptNotStale && ch.takenState === 'Not approved' && /7 of 20/.test(ch.takenText) && ch.untouchedNoOp, ch)

  // ═══ Left out and release ═══
  const rl2 = await run(`const ctx=mk(); let doc=st.newDoc('pet-food-churn',sc.buildDraft(ctx,10),10,'Maya Ortiz')
    const none=sc.leftOutOf(doc.lines,ctx,true).length
    const d2=JSON.parse(JSON.stringify(ctx.doc)); d2.themes.push({id:'t-new',name:'A new theme',definition:'x',codeIds:['c-runout','c-ingredients'],by:'t',at:'now'}); const ctx2={...ctx,doc:d2}
    const lo=sc.leftOutOf(doc.lines,ctx2,true); const lo2=sc.leftOutOf(doc.lines,ctx2,false)
    const claims=doc.lines.filter(l=>l.type==='narration')
    const p0=st.releaseProblems(doc,ctx)
    let d=doc; for(const l of doc.lines) d=st.approve(d,l.id,'Maya Ortiz',ctx)
    const p1=st.releaseProblems(d,ctx); const rel=st.release(d,'Maya Ortiz',ctx)
    const stale=st.releaseProblems(st.editLine(rel,claims[0].id,'x','Maya Ortiz',ctx).doc,ctx)
    const edited=st.editLine(d,claims[0].id,'The first one, said another way, '+sc.numbersCheck(claims[0].text,claims[0].source,claims[0].cites,ctx)[0].text+' people.','Maya Ortiz',ctx).doc
    const after=st.release(rel,'Maya Ortiz',ctx); const changed=st.changedSinceRelease({...rel,lines:edited.lines})
    return {none,lo,lo2,p0,p1,released:rel.release&&{v:rel.release.version,by:rel.release.by,lines:rel.release.lines},sec:rel.release&&rel.release.seconds,outside:sc.outsideBrief(rel.release.seconds),notChangedYet:!st.changedSinceRelease(rel),changed}`)
  ok('nothing is left out when every approved theme and tension is in the episode', rl2.none === 0)
  ok('a theme approved after the script was written is “Left out” with the reason “new since this was written”', rl2.lo.length === 1 && rl2.lo[0].name === 'A new theme' && rl2.lo[0].why === 'new' && rl2.lo2[0].why === 'time', { lo: rl2.lo, lo2: rl2.lo2 })
  ok('release is blocked while claims are unapproved or audio is stale, and a length outside 8 to 12 minutes does not block it', rl2.p0.some((p) => /not approved/.test(p)) && rl2.p1.length === 0 && rl2.released?.v === 1 && rl2.outside === true, rl2)
  ok('after release, an edit shows “Changed since release”', rl2.notChangedYet && rl2.changed, rl2)

  // ═══ Step 2: the page and the player ═══
  const q = (x) => JSON.stringify(x)
  const sc_clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
  const count = (sel) => b.evaluate(`document.querySelectorAll(${q(sel)}).length`)
  const text = (sel) => b.evaluate(`document.querySelector(${q(sel)})?.innerText.replace(/\\s+/g,' ') ?? null`)
  const click = async (sel) => { const done = await b.poll(`(()=>{const e=document.querySelector(${q(sel)});if(!e||e.disabled)return false;e.click();return true})()`); if (!done) throw new Error(`nothing to click for ${sel}`); await b.sleep(250) }
  const codebook = () => b.evaluate(`localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))`)
  const URL = '/researcher/studies/pet-food-churn/analysis/report/audio-summary'
  const openPage = async (qs = '') => { await b.goto(`${URL}${qs}`); await b.waitFor('Audio summary'); await b.sleep(1500) }
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto('/researcher/studies/pet-food-churn/analysis/report'); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(1200)
  await click('[data-testid=tool-audio-summary]'); await b.waitFor('Back to Report'); await b.sleep(1500)
  ok('Audio summary in Tools opens /report/audio-summary', /\/analysis\/report\/audio-summary$/.test(await b.evaluate('location.pathname')))
  ok('the header has the description, the study line and no Lens selector', /written from the themes and tensions you approved\. Every claim links to the exact words people said\./.test(await b.evaluate('document.body.innerText')) && /Built on 20 accepted sessions · 2 excluded left out · Release v1\.0/.test((await text('[data-testid=built-on]')) ?? '') && (await count('[data-testid=lens-select]')) === 0)
  const cbBefore = await codebook()
  const view = await run(`const ctx=mk(); const doc=JSON.parse(localStorage.getItem('pulseai-qual:audio-summary'))['pet-food-churn']; const st2=st.statusOf(doc,ctx); const t=sc.timeline(doc.lines)
    return {status:st2,total:sc.totalSeconds(doc.lines),lines:doc.lines.length,chapters:sc.chaptersOf(doc.lines),starts:t.map(l=>sc.clock(l.start)),narrationChapters:[...new Set(doc.lines.filter(l=>l.type==='narration').map(l=>l.chapter))].length}`)
  const heads = await b.evaluate(`[...document.querySelectorAll('[data-testid=chapter]')].map(c=>({k:c.dataset.chapter,len:c.querySelector('[data-testid=chapter-length]').innerText,ap:c.querySelector('[data-testid=chapter-approved]').innerText}))`)
  ok('chapter rows show the chapter, its length and “n of m approved”, in order', JSON.stringify(heads.map((h) => h.k)) === JSON.stringify(view.chapters) && heads.every((h) => /^\d+:\d\d$/.test(h.len) && /^\d+ of \d+ approved$/.test(h.ap)) && heads[0].ap === '1 of 1 approved', heads)
  const strip = await text('[data-testid=status-strip]')
  ok('the status strip counts are the computed ones: lines, claims cited, approved, needs audio, out of date', strip.includes(`${view.status.lines} lines`) && strip.includes(`Claims cited ${view.status.cited} of ${view.status.claims}`) && strip.includes(`Approved ${view.status.approved} of ${view.status.lines}`) && strip.includes('Needs audio 0') && strip.includes('Out of date 0') && /Written \d\d:\d\d/.test(strip), strip)
  await click('[data-testid=filter-unapproved]')
  const filtered = await b.evaluate(`[...document.querySelectorAll('[data-testid=line]')].every(l=>l.dataset.state!=='Approved')`)
  ok('a count in the strip is a link that filters the lines (Approved: only the ones not yet approved)', filtered && (await count('[data-testid=line]')) === view.status.lines - view.status.approved && (await count('[data-testid=filter-clear]')) === 1)
  await click('[data-testid=filter-clear]')
  ok('and Show all lines puts them back', (await count('[data-testid=line]')) === view.status.lines)
  const kinds = await b.evaluate(`({quote:[...document.querySelectorAll('[data-testid=line][data-type=quote] [data-testid=line-label]')].map(x=>x.innerText),frame:[...document.querySelectorAll('[data-testid=line][data-type=frame] [data-testid=line-label]')].map(x=>x.innerText),dots:[...document.querySelectorAll('[data-testid=line]')].every(l=>!!l.querySelector('[data-testid=state-dot]')),times:[...document.querySelectorAll('[data-testid=line-jump]')].map(x=>x.innerText),marks:[...document.querySelectorAll('[data-testid=line][data-type=narration] [data-testid=cite-mark]')].map(x=>x.innerText),narr:document.querySelectorAll('[data-testid=line][data-type=narration]').length,serif:getComputedStyle(document.querySelector('[data-testid=line][data-type=quote] [data-testid=line-text]')).fontFamily})`)
  ok('a quote is serif with “Quote · P-3107 · Dog owner” beneath; the opening and closing lines say they are locked', kinds.quote.length >= 4 && kinds.quote.every((l) => /^Quote · P-\d+ · (Dog|Cat) owner$/.test(l)) && /serif/i.test(kinds.serif) && kinds.frame.join() === 'Opening, locked,Closing, locked', kinds)
  ok('every line has a start time and a state dot; every narration line has one citation mark, a range such as 1–3 when it has several', kinds.dots && kinds.times.every((t) => /^\d+:\d\d$/.test(t)) && kinds.marks.length === kinds.narr && kinds.marks.every((m) => /^(1|1–\d)$/.test(m)), kinds)
  ok('“AI-written” is shown once for each chapter that has narration, not on every line', (await count('[data-testid=ai-label]')) === view.narrationChapters, { n: await count('[data-testid=ai-label]'), want: view.narrationChapters })
  ok('the bar says “Target 8 to 12 minutes. This runs 1:58.” in amber when outside the range', /^Target 8 to 12 minutes\. This runs \d+:\d\d\.$/.test((await text('[data-testid=length-note]')) ?? '') && (await b.evaluate(`document.querySelector('[data-testid=length-note]').dataset.outside`)) === 'true' && !/The brief asks/.test(await b.evaluate('document.body.innerText')))
  ok('the scrubber has a tick at each chapter start', (await count('[data-testid=chapter-tick]')) === view.chapters.length)

  // Playback
  ok('nothing plays by itself', (await b.evaluate(`document.querySelector('[data-testid=play]').getAttribute('aria-pressed')`)) === 'false' && /^0:00 \//.test((await text('[data-testid=clock]')) ?? ''))
  await click('[data-testid=play]'); await b.sleep(1800)
  const c1 = await text('[data-testid=clock]')
  ok('Play runs a clock through the lines and the first line is highlighted as current', c1 !== '0:00 / ' + c1.split('/ ')[1] && (await b.evaluate(`document.querySelector('[data-testid=line][data-current=true]')?.dataset.key`)) === 'frame-open' && (await b.evaluate(`document.querySelector('[data-testid=play]').getAttribute('aria-pressed')`)) === 'true', c1)
  await click('[data-testid=play]')
  await click('[data-testid=next-line]')
  ok('next line jumps to the next line’s start', (await b.evaluate(`document.querySelector('[data-testid=line][data-current=true]').dataset.key`)) !== 'frame-open')
  const jumpTo = await b.evaluate(`[...document.querySelectorAll('[data-testid=line]')][4].dataset.id`)
  await b.evaluate(`document.querySelector('[data-testid=line][data-id="${jumpTo}"] [data-testid=line-jump]').click(); true`); await b.sleep(250)
  ok('clicking a line jumps to it and selects it', (await b.evaluate(`document.querySelector('[data-testid=line][data-current=true]').dataset.id`)) === jumpTo && (await b.evaluate(`document.querySelector('[data-testid=line][data-id="${jumpTo}"]').dataset.selected`)) === 'true')
  await click('[data-testid=prev-line]')
  ok('previous line goes back one', (await b.evaluate(`document.querySelector('[data-testid=line][data-current=true]').dataset.id`)) !== jumpTo)
  await click('[data-testid=chapters-menu]'); await click('[data-testid=chapter-jump][data-chapter="theme:t-price"]')
  ok('the Chapters menu jumps to a chapter’s first line', (await b.evaluate(`document.querySelector('[data-testid=line][data-current=true]').dataset.key`)) === 'signpost:theme:t-price')
  await b.evaluate(`document.body.focus(); document.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true})); true`); await b.sleep(300)
  const spaced = await b.evaluate(`document.querySelector('[data-testid=play]').getAttribute('aria-pressed')`)
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true})); true`); await b.sleep(200)
  ok('Space plays and pauses', spaced === 'true' && (await b.evaluate(`document.querySelector('[data-testid=play]').getAttribute('aria-pressed')`)) === 'false')
  const k0 = await b.evaluate(`document.querySelector('[data-testid=line][data-current=true]').dataset.id`)
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); true`); await b.sleep(200)
  const k1 = await b.evaluate(`document.querySelector('[data-testid=line][data-current=true]').dataset.id`)
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true})); true`); await b.sleep(200)
  ok('the arrow keys move between lines', k1 !== k0 && (await b.evaluate(`document.querySelector('[data-testid=line][data-current=true]').dataset.id`)) === k0)
  const speedRun = async (v) => { if (!(await count('[data-testid=speed]'))) await click('[data-testid=playback-menu]'); await b.evaluate(`(()=>{const s=document.querySelector('[data-testid=speed]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${q(String(v))}); s.dispatchEvent(new Event('change',{bubbles:true})); return true})()`); await click('[data-testid=chapters-menu]'); await click('[data-testid=chapter-jump][data-chapter="headline"]'); await click('[data-testid=play]'); await b.sleep(2000); await click('[data-testid=play]'); const t = (await text('[data-testid=clock]')).split(' / ')[0].split(':'); return Number(t[0]) * 60 + Number(t[1]) }
  const slowT = await speedRun(0.75); const fastT = await speedRun(1.5)
  ok('speed changes how fast the clock runs: 1.5× gets further than 0.75× in the same time', fastT > slowT, { slowT, fastT })
  if (!(await count('[role=switch][aria-label="Follow along"]'))) await click('[data-testid=playback-menu]')
  const names = await b.evaluate(`['[data-testid=play]','[data-testid=prev-line]','[data-testid=next-line]','[data-testid=speed]','[data-testid=scrubber]','[data-testid=chapters-menu]','[role=switch][aria-label="Follow along"]'].map(s=>{const e=document.querySelector(s);return !!(e&&(e.getAttribute('aria-label')||e.innerText))})`)
  ok('every player control has an accessible name', names.every(Boolean), names)
  ok('the current line and its approval state are announced to screen readers', /^(Playing|Paused), line \d+ of \d+: .+\. (Not approved|Approved|Edited)\.$/.test((await text('[data-testid=announce]')) ?? ''), await text('[data-testid=announce]'))
  ok('this page never writes to the codebook', (await codebook()) === cbBefore)

  // ═══ Player improvements (from the research on audio tools) ═══
  await openPage()
  const wave = await b.evaluate(`({bars:document.querySelectorAll('[data-testid=wave-bar]').length,quote:document.querySelectorAll('[data-testid=wave-bar][data-type=quote]').length,other:document.querySelectorAll('[data-testid=wave-bar]:not([data-type=quote])').length,played:document.querySelectorAll('[data-testid=wave-bar][data-played=true]').length,range:document.querySelector('[data-testid=scrubber]').type})`)
  ok('the scrubber is a waveform that shows where people’s own words sit: quote bars and narration bars are drawn differently, none played yet, with a real range input over it', wave.bars > 100 && wave.quote > 0 && wave.other > 0 && wave.played === 0 && wave.range === 'range', wave)
  const quoteFill = await b.evaluate(`[document.querySelector('[data-testid=wave-bar][data-type=quote]').getAttribute('fill'),document.querySelector('[data-testid=wave-bar]:not([data-type=quote])').getAttribute('fill')]`)
  ok('quote bars and narration bars are different colours', quoteFill[0] !== quoteFill[1], quoteFill)
  ok('the bar says which chapter it is in and what is up next', /^Now: About this recording$/.test((await text('[data-testid=now-chapter]')) ?? '') && /^Up next: The headline at \d+:\d\d$/.test((await text('[data-testid=up-next]')) ?? ''), await text('[data-testid=now-next]'))
  await click('[data-testid=forward-15]')
  const f15 = (await text('[data-testid=clock]')).split(' / ')[0]
  await click('[data-testid=back-15]'); await click('[data-testid=back-15]')
  ok('forward and back 15 seconds move the clock, and back stops at the start', f15 === '0:15' && (await text('[data-testid=clock]')).startsWith('0:00 /'), f15)
  ok('the page has no running animation while nothing plays, and the player adds none of its own', (await b.evaluate(`document.getAnimations().length`)) === 0)
  // Word by word
  await click('[data-testid=play]'); await b.sleep(2200)
  const words = await b.evaluate(`(()=>{const cur=document.querySelector('[data-testid=line][data-current=true] [data-testid=spoken-line]');const all=[...cur.querySelectorAll('[data-spoken]')];return {n:all.length,spoken:all.filter(w=>w.dataset.spoken==='true').length,dark:all.filter(w=>w.dataset.spoken==='true').every(w=>w.className.includes('text-ink')),light:all.filter(w=>w.dataset.spoken==='false').every(w=>w.className.includes('text-graphite'))}})()`)
  ok('the line being said lights up word by word as the clock reaches it: some words spoken, some not yet', words.n > 5 && words.spoken > 0 && words.spoken < words.n && words.dark && words.light, words)
  ok('while playing with Follow along on, the other lines step back a little (but stay readable)', (await b.evaluate(`[...document.querySelectorAll('[data-testid=line][data-current=false]')].every(l=>getComputedStyle(l).opacity==='0.75')`)))
  await click('[data-testid=play]')
  const during = await b.evaluate(`document.querySelectorAll('[data-testid=wave-bar][data-played=true]').length`)
  ok('the waveform fills as it plays', during > 0)
  // Play modes
  const modeInfo = await run(`const ctx=mk(); const doc=JSON.parse(localStorage.getItem('pulseai-qual:audio-summary'))['pet-food-churn']; const live=doc.lines.filter(l=>!l.removed); return {quotes:live.filter(l=>l.type==='quote').reduce((n,l)=>n+sc.lineSeconds(l.text),0),findings:live.filter(l=>l.type!=='quote').reduce((n,l)=>n+sc.lineSeconds(l.text),0),full:sc.totalSeconds(doc.lines),nq:live.filter(l=>l.type==='quote').length}`)
  await click('[data-testid=mode-quotes]')
  const q1 = await b.evaluate(`({clock:document.querySelector('[data-testid=clock]').innerText,length:document.querySelector('[data-testid=length-note]').innerText,skipped:[...document.querySelectorAll('[data-testid=line-jump][data-skipped=true]')].length,cur:document.querySelector('[data-testid=line][data-current=true]').dataset.type,note:document.querySelector('[data-testid=mode-note]')?.innerText})`)
  ok('“Quotes only” plays just what people said: the clock reads “0:00 / 0:26 of 1:58 total”, the other lines are marked as skipped, and it says so', q1.clock.endsWith(` / ${sc_clock(modeInfo.quotes)} of ${sc_clock(modeInfo.full)} total`) && q1.skipped === view.status.lines - modeInfo.nq && q1.cur === 'quote' && /only what people said/.test(q1.note), { q1, modeInfo })
  ok('the target note stays about the whole script, not the part being played', q1.length === `Target 8 to 12 minutes. This runs ${sc_clock(modeInfo.full)}.`, q1.length)
  await click('[data-testid=mode-findings]')
  const q2 = await b.evaluate(`({clock:document.querySelector('[data-testid=clock]').innerText,cur:document.querySelector('[data-testid=line][data-current=true]').dataset.type})`)
  ok('“Findings” plays the narration, notes and locked lines without the quotes', q2.clock.endsWith(` / ${sc_clock(modeInfo.findings)} of ${sc_clock(modeInfo.full)} total`) && q2.cur !== 'quote', q2)
  await click('[data-testid=mode-all]')
  ok('“Everything” plays it all again, shown plainly as “0:00 / 1:58”', (await text('[data-testid=clock]')) === `0:00 / ${sc_clock(modeInfo.full)}`)
  // Search
  await b.evaluate(`var i=document.querySelector('[data-testid=script-search]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'p'); i.dispatchEvent(new Event('input',{bubbles:true})); true`); await b.sleep(200)
  const short = await count('[data-testid=search-count]')
  await b.evaluate(`var i=document.querySelector('[data-testid=script-search]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'price'); i.dispatchEvent(new Event('input',{bubbles:true})); true`); await b.sleep(250)
  const expected = await run(`const doc=JSON.parse(localStorage.getItem('pulseai-qual:audio-summary'))['pet-food-churn']; return doc.lines.filter(l=>!l.removed&&l.text.toLowerCase().includes('price')).map(l=>l.id)`)
  ok('search starts at two characters, counts the matching lines and marks the term in them', short === 0 && new RegExp(`^${expected.length} matches?$`).test((await text('[data-testid=search-count]')) ?? '') && (await count('[data-testid=match]')) >= 1, { expected: expected.length })
  await click('[data-testid=search-next]')
  const hit1 = await b.evaluate(`document.querySelector('[data-testid=line][data-selected=true]').dataset.id`)
  await click('[data-testid=search-next]')
  const hit2 = await b.evaluate(`document.querySelector('[data-testid=line][data-selected=true]').dataset.id`)
  await click('[data-testid=search-prev]')
  ok('Next and Previous jump to the matches, in order, and the clock follows', expected.includes(hit1) && expected.includes(hit2) && (expected.length < 2 || hit1 !== hit2) && (await b.evaluate(`document.querySelector('[data-testid=line][data-selected=true]').dataset.id`)) === hit1 && (await b.evaluate(`document.querySelector('[data-testid=line][data-current=true]').dataset.id`)) === hit1, { hit1, hit2 })
  await b.evaluate(`var i=document.querySelector('[data-testid=script-search]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,''); i.dispatchEvent(new Event('input',{bubbles:true})); true`); await b.sleep(200)
  // Listen view
  await click('[data-testid=view-listen]')
  const lv = await b.evaluate(`({cur:document.querySelector('[data-testid=listen-current]').innerText.replace(/\\s+/g,' '),line:document.querySelector('[data-testid=line][data-current=true] [data-testid=line-text]').innerText.replace(/\\s+/g,' ').replace(/[“”]/g,'').replace(/\\d(–\\d)?$/,'').trim(),hidden:getComputedStyle(document.querySelector('[data-testid=script]')).display,where:document.querySelector('[data-testid=listen-where]').innerText,speaker:document.querySelector('[data-testid=listen-speaker]').innerText,size:parseFloat(getComputedStyle(document.querySelector('[data-testid=listen-current]')).fontSize)})`)
  ok('the Listen view shows the line being said large, with the line before and after, who is speaking, and the script out of the way', lv.hidden === 'none' && /Line \d+ of \d+/.test(lv.where) && lv.size >= 20 && /Narrator|Participant quote|Locked|Researcher|Signpost/.test(lv.speaker), lv)
  const before = await text('[data-testid=listen-current]')
  await click('[data-testid=next-line]')
  ok('and it moves on with the player', (await text('[data-testid=listen-current]')) !== before)
  await click('[data-testid=view-read]')
  ok('Read brings the script back', (await b.evaluate(`getComputedStyle(document.querySelector('[data-testid=script]')).display`)) !== 'none')
  // Bookmarks
  const target = await b.evaluate(`document.querySelectorAll('[data-testid=line]')[3].dataset.id`)
  await b.evaluate(`document.querySelector('[data-testid=line][data-id="${target}"] [data-testid=bookmark]').click(); true`); await b.sleep(300)
  const marked = await run(`return JSON.parse(localStorage.getItem('pulseai-qual:audio-summary'))['pet-food-churn'].marks`)
  ok('a line can be bookmarked (a star), and the bookmark is kept', JSON.stringify(marked) === JSON.stringify([target]) && (await b.evaluate(`document.querySelector('[data-testid=line][data-id="${target}"] [data-testid=bookmark]').getAttribute('aria-pressed')`)) === 'true')
  await click('[data-testid=filter-marked]')
  ok('“Bookmarked 1” in the strip shows just the starred lines', (await count('[data-testid=line]')) === 1 && /Bookmarked 1/.test((await text('[data-testid=status-strip]')) ?? ''))
  await click('[data-testid=filter-clear]')
  await b.evaluate(`document.querySelector('[data-testid=line][data-id="${target}"] [data-testid=bookmark]').click(); true`); await b.sleep(250)
  ok('and unstarring takes it off; a bookmark changes nothing in the script', (await count('[data-testid=filter-marked]')) === 0)
  // Resume
  await click('[data-testid=chapters-menu]'); await click('[data-testid=chapter-jump][data-chapter="headline"]'); await click('[data-testid=play]'); await b.sleep(2600); await click('[data-testid=play]')
  const left = (await text('[data-testid=clock]')).split(' / ')[0]
  await openPage()
  const offer = await text('[data-testid=resume]')
  ok('after listening, the next visit offers “Resume from 0:11” and never starts by itself', offer === `Resume from ${left.replace(/^(\d+):(\d)$/, '$1:0$2')}` || /^Resume from \d+:\d\d$/.test(offer ?? ''), { offer, left })
  await click('[data-testid=resume]')
  ok('Resume puts the clock where they stopped, paused', (await text('[data-testid=clock]')).startsWith(offer.replace('Resume from ', '')) && (await b.evaluate(`document.querySelector('[data-testid=play]').getAttribute('aria-pressed')`)) === 'false' && (await count('[data-testid=resume]')) === 0)
  ok('none of this touched the codebook', (await codebook()) === cbBefore)

  // ═══ Step A: content and UI fixes ═══
  const A = await run(`const ctx=mk(); const d=sc.buildDraft(ctx,10); const L=d.lines; const doc=ctx.doc
    const by={}; L.forEach(l=>by[l.type]=(by[l.type]||0)+1)
    const headline=L.filter(l=>l.chapter==='headline'&&l.type==='narration')
    const codeOutside=L.filter(l=>l.type==='narration'&&l.source?.kind==='code'&&!l.chapter.startsWith('theme:')).length
    const themes=cb.codeThemes(doc).filter(t=>cb.themeCodes(doc,t).length)
    const perTheme=themes.map(t=>({id:t.id,codes:cb.themeCodes(doc,t).filter(c=>rl.numbersOf(c.id,ctx)?.n>0).length,codeLines:L.filter(l=>l.chapter==='theme:'+t.id&&l.type==='narration').length,quotes:L.filter(l=>l.chapter==='theme:'+t.id&&l.type==='quote').length,n:rl.numbersOf(t.id,ctx).n}))
    const tension=L.filter(l=>l.chapter==='tensions')
    const signposts=L.filter(l=>l.type==='signpost')
    const chaps=sc.chaptersOf(L)
    // two leading themes more than one person apart: no close-to-even line, each theme on its own
    const d2=JSON.parse(JSON.stringify(doc)); d2.themes.find(t=>t.id==='t-price').codeIds=['c-stable-price']; const far=sc.buildDraft({...ctx,doc:d2},10).lines.filter(l=>l.chapter==='headline'&&l.type==='narration')
    const close=L.find(l=>l.key==='headline-close'), none=L.find(l=>l.key==='headline-none')
    const sets=['t-pet','t-price'].map(id=>cb.themePeople(doc,doc.themes.find(t=>t.id===id),ctx.basis))
    const either=new Set([...sets[0],...sets[1]])
    return {by,total:L.length,seconds:sc.totalSeconds(L),headline:headline.map(l=>({key:l.key,text:l.text,src:l.source?.kind,figs:nr.figures(l.text).length,ok:sc.numbersCheck(l.text,l.source,l.cites,ctx).every(x=>x.ok)})),codeOutside,perTheme,tension:tension.map(l=>({type:l.type,key:l.key})),
      signposts:signposts.map(l=>({chapter:l.chapter,text:l.text,digits:/\\d/.test(l.text),words:nr.words(l.text),state:l.state,cites:l.cites.length})),chaps,far:far.map(l=>l.key),closeText:close?.text,noneText:none?.text,noneN:people(none),pe:either.size,n:ms.ACCEPTED_PARTICIPANTS.length,sizes:sets.map(x=>x.size)}
    function people(l){return l&&nr.figures(l.text)[0]?.n}`)
  const headNarr = A.headline
  ok('the headline is made of themes: only theme, pair and no-answer lines, each with its theme’s count; no code appears outside its own theme’s chapter', headNarr.length >= 2 && headNarr.every((h) => ['theme', 'pair', 'pairNone'].includes(h.src) && h.ok) && A.codeOutside === 0, { headNarr, codeOutside: A.codeOutside })
  ok('close to even: the two leading themes are 9 and 8 people, within one, so there is one line with both counts, and one for how many gave no clear answer', A.sizes[0] === 9 && A.sizes[1] === 8 && /close to even: 9 of 20 people and 8 of 20 people\.$/.test(A.closeText) && A.noneN === A.n - A.pe && /gave no clear answer to either\.$/.test(A.noneText) && A.headline.find((h) => h.key === 'headline-close').figs === 2, { close: A.closeText, none: A.noneText, noneN: A.noneN, want: A.n - A.pe })
  ok('and when the leading two are more than one person apart there is no such line: each theme stands alone', !A.far.includes('headline-close') && !A.far.includes('headline-none') && A.far.some((k) => k.startsWith('headline:')), A.far)
  ok('each theme chapter has one line for every accepted code, then two quotes (three for the two largest), no padding', A.perTheme.every((t) => t.codeLines === t.codes && t.quotes === 3), A.perTheme)
  ok('the tension chapter has only the approved tension: one line, then one quote for the words and one for the delivery', JSON.stringify(A.tension.map((t) => t.type)) === JSON.stringify(['signpost', 'narration', 'quote', 'quote']), A.tension)
  ok('signposts open every chapter except the first: fixed wording, no digits, 12 words or fewer, no source and no claim', A.signposts.length === A.chaps.length - 1 && A.signposts.every((sp) => !sp.digits && sp.words <= 12 && sp.cites === 0 && sp.state === 'Approved') && A.chaps.slice(1).every((c) => A.signposts.some((sp) => sp.chapter === c)), A.signposts)
  ok('a signpost can’t be edited', await run(`const ctx=mk(); const doc=st.newDoc('pet-food-churn',sc.buildDraft(ctx,10),10,'x'); const sp=doc.lines.find(l=>l.type==='signpost'); const r=st.editLine(doc,sp.id,'Hello','x',ctx); return r.doc===doc&&r.problems.length>0`))
  ok('the new draft is about two minutes with no filler: 26 lines (frame 2, signpost 6, narration 10, quote 8)', A.by.frame === 2 && A.by.signpost === 6 && A.by.narration === 10 && A.by.quote === 8 && A.total === 26 && A.seconds > 100 && A.seconds < 140, { by: A.by, seconds: A.seconds })

  // Page
  await openPage()
  const pageA = await b.evaluate(`(()=>{const sp=[...document.querySelectorAll('[data-testid=line][data-type=signpost] [data-testid=line-label]')].map(x=>x.innerText);return {sp,lit:document.querySelectorAll('[data-testid=line][data-lit=true]').length,litIsCurrent:document.querySelector('[data-testid=line][data-lit=true]')?.dataset.current,speedInBar:!!document.querySelector('[data-testid=player] > div > [data-testid=speed]'),menu:!!document.querySelector('[data-testid=playback-menu]'),followOutside:!!document.querySelector('[data-testid=player] > div > span [role=switch]')}})()`)
  ok('signposts are labelled “Signpost” in the script', pageA.sp.length === 6 && pageA.sp.every((l) => l === 'Signpost'), pageA)
  ok('exactly one line is lit (paused with nothing selected: the one the clock is at)', pageA.lit === 1 && pageA.litIsCurrent === 'true', pageA)
  await b.evaluate(`document.querySelectorAll('[data-testid=line] [data-testid=line-jump]')[6].click(); true`); await b.sleep(250)
  await click('[data-testid=play]'); await b.sleep(600)
  const playingLit = await b.evaluate(`({n:document.querySelectorAll('[data-testid=line][data-lit=true]').length,cur:document.querySelector('[data-testid=line][data-lit=true]').dataset.current,sel:document.querySelectorAll('[data-testid=line][data-selected=true]').length})`)
  ok('while playing only the playing line is lit, even if another is selected', playingLit.n === 1 && playingLit.cur === 'true', playingLit)
  await click('[data-testid=play]')
  await b.evaluate(`document.querySelectorAll('[data-testid=line] [data-testid=line-jump]')[2].click(); true`); await b.sleep(150)
  await b.evaluate(`(()=>{const l=document.querySelectorAll('[data-testid=line]')[9].querySelector('[data-testid=cite-mark]')||document.querySelectorAll('[data-testid=line]')[9].querySelector('[data-testid=line-jump]');l.click();return true})()`); await b.sleep(200)
  const pausedLit = await b.evaluate(`({n:document.querySelectorAll('[data-testid=line][data-lit=true]').length,sel:document.querySelector('[data-testid=line][data-lit=true]').dataset.selected})`)
  ok('paused, the selected line is the one lit', pausedLit.n === 1 && pausedLit.sel === 'true', pausedLit)
  ok('Speed and Follow along are in a Playback menu, not in the bar', pageA.menu && !pageA.speedInBar && (await count('[data-testid=speed]')) === 0)
  await click('[data-testid=playback-menu]')
  ok('the Playback menu holds Speed and Follow along', (await count('[data-testid=speed]')) === 1 && (await count('[role=switch][aria-label="Follow along"]')) === 1)
  await b.evaluate(`document.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); true`); await b.sleep(150)
  // Listen labels
  await click('[data-testid=view-listen]')
  const lab = await b.evaluate(`({cur:document.querySelector('[data-testid=listen-speaker]').innerText,prev:document.querySelector('[data-testid=listen-prev-label]')?.innerText,next:document.querySelector('[data-testid=listen-next-label]')?.innerText,curOp:getComputedStyle(document.querySelector('[data-testid=listen-current-wrap]')).opacity,prevOp:getComputedStyle(document.querySelector('[data-testid=listen-prev-wrap]')).opacity,nextOp:getComputedStyle(document.querySelector('[data-testid=listen-next-wrap]')).opacity})`)
  ok('in the Listen view every line is labelled with its chapter and speaker', [lab.cur, lab.prev, lab.next].every((t) => /^.+ · (Narrator, AI-written|Signpost|Locked line|Researcher’s note · .+|Participant quote · P-\d+ · (Dog|Cat) owner)$/.test(t)), lab)
  ok('the current line is at full contrast and its neighbours at 70%', lab.curOp === '1' && lab.prevOp === '0.7' && lab.nextOp === '0.7', lab)
  await b.evaluate(`document.querySelector('[data-testid=chapters-menu]').click(); true`); await b.sleep(200)
  await click('[data-testid=chapter-jump][data-chapter="tensions"]'); await click('[data-testid=next-line]'); await click('[data-testid=next-line]')
  ok('a quote in the Listen view reads “Participant quote · P-3114 · Dog owner”', /^Participant quote · P-\d+ · (Dog|Cat) owner$/.test(((await text('[data-testid=listen-speaker]')) ?? '').split(' · ').slice(1).join(' · ')), await text('[data-testid=listen-speaker]'))
  await click('[data-testid=view-read]')

  // ═══ Step B: line editing ═══
  await b.evaluate(`localStorage.removeItem('pulseai-qual:audio-summary'); localStorage.removeItem('pulseai-qual:audio-position:pet-food-churn'); true`)
  await openPage()
  const setVal = (sel, v, proto = 'HTMLTextAreaElement') => b.evaluate(`var t=document.querySelector(${q(sel)}); Object.getOwnPropertyDescriptor(${proto}.prototype,'value').set.call(t,${q(v)}); t.dispatchEvent(new Event('input',{bubbles:true})); true`)
  const lineSel = (key) => `[data-testid=line][data-key="${key}"]`
  const store2 = () => b.evaluate(`JSON.parse(localStorage.getItem('pulseai-qual:audio-summary'))['pet-food-churn']`)
  const KEY = 'theme:t-price:c-price-rise'
  const reveal = async (key) => { await b.evaluate(`document.querySelector('${lineSel(key)} [data-testid=line-jump]').click(); true`); await b.sleep(200) }
  // Edit: blocked on a mismatch, with the data's number
  await reveal(KEY)
  const t0 = await text('[data-testid=clock]')
  await click(`${lineSel(KEY)} [data-testid=edit]`)
  await setVal('[data-testid=editor-text]', '“Price went up” came up for 9 of 20 people.'); await b.sleep(200)
  const bad = await b.evaluate(`({nums:document.querySelector('[data-testid=check-numbers]').innerText,save:document.querySelector('[data-testid=editor-save]').disabled,len:document.querySelector('[data-testid=check-length]').innerText})`)
  ok('the editor checks as you type: spoken length, and “Says 9 of 20. The data says 8 of 20” blocks Save', bad.nums === 'Says 9 of 20. The data says 8 of 20' && bad.save === true && /^Takes \d+\.\d s to say$/.test(bad.len), bad)
  await setVal('[data-testid=editor-text]', '“Price went up” was raised by 8 of 20 people.'); await b.sleep(200)
  const good = await b.evaluate(`({nums:document.querySelector('[data-testid=check-numbers]').innerText,cited:document.querySelector('[data-testid=check-cited]').innerText,save:document.querySelector('[data-testid=editor-save]').disabled})`)
  ok('with the right number it says “Numbers match the data” and “Cited”, and Save is on', good.nums === 'Numbers match the data' && good.cited === 'Cited' && good.save === false, good)
  await click('[data-testid=editor-save]'); await b.sleep(300)
  const saved = await b.evaluate(`({edited:!!document.querySelector('${lineSel(KEY)} [data-testid=edited-tag]'),audio:document.querySelector('${lineSel(KEY)} [data-testid=needs-audio]')?.innerText,state:document.querySelector('${lineSel(KEY)}').dataset.state,text:document.querySelector('${lineSel(KEY)} [data-testid=line-text]').innerText,playing:document.querySelector('[data-testid=play]').getAttribute('aria-pressed')})`)
  const st1 = await store2()
  ok('saving marks the line Edited, Needs audio and not approved, and the clock stays where it was, paused', saved.edited && saved.audio === 'Audio out of date' && saved.state === 'Edited' && /was raised by 8 of 20/.test(saved.text) && saved.playing === 'false' && (await text('[data-testid=clock]')).split(' / ')[0] === t0.split(' / ')[0], { saved, t0, now: await text('[data-testid=clock]') })
  ok('the old wording is in History', st1.lines.find((l) => l.key === KEY).history.at(-1).action === 'Edited' && /came up for 8 of 20/.test(st1.lines.find((l) => l.key === KEY).history.at(-1).previous))
  // Approve, withdraw, keyboard
  await click(`${lineSel(KEY)} [data-testid=approve]`)
  ok('Approve marks the line Approved (a cited line whose numbers match and is in date)', (await b.evaluate(`document.querySelector('${lineSel(KEY)}').dataset.state`)) === 'Approved')
  await click(`${lineSel(KEY)} [data-testid=unapprove]`)
  ok('Withdraw approval takes it back, keeping the Edited tag', (await b.evaluate(`document.querySelector('${lineSel(KEY)}').dataset.state`)) === 'Edited')
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true})); true`); await b.sleep(250)
  ok('the A key approves the selected line', (await b.evaluate(`document.querySelector('${lineSel(KEY)}').dataset.state`)) === 'Approved')
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'e',bubbles:true})); true`); await b.sleep(250)
  ok('and the E key opens its editor', (await count('[data-testid=line-editor]')) === 1)
  await click('[data-testid=editor-cancel]')
  // Back to AI
  await click(`${lineSel(KEY)} [data-testid=edit]`)
  await click('[data-testid=editor-back-to-ai]'); await b.sleep(250)
  ok('Back to AI draft puts the AI’s own wording back and needs audio', /came up for 8 of 20/.test(await b.evaluate(`document.querySelector('${lineSel(KEY)} [data-testid=line-text]').innerText`)) && (await b.evaluate(`document.querySelector('${lineSel(KEY)}').dataset.state`)) === 'Not approved')
  // Rewrite
  const RK = 'theme:t-pet:c-pet-refused'
  const beforeRW = await b.evaluate(`document.querySelector('${lineSel(RK)} [data-testid=line-text]').innerText.replace(/\\d(–\\d)?$/,'')`)
  await click(`${lineSel(RK)} [data-testid=rewrite]`)
  await setVal('[data-testid=rewrite-instruction]', 'Shorter', 'HTMLInputElement')
  await click('[data-testid=rewrite-go]'); await b.sleep(300)
  const stRW = await store2()
  const rl = stRW.lines.find((l) => l.key === RK)
  ok('Rewrite gives another wording of the same claim (same number), passes the rules, is not approved, needs audio, and keeps the old wording in History', rl.text !== beforeRW.trim() && /6 of 20/.test(rl.text) && rl.audio === 'Needs audio' && rl.state === 'Not approved' && /^Rewritten \(Shorter\)$/.test(rl.history.at(-1).action) && rl.history.at(-1).previous.length > 10, rl)
  // Remove, restore
  await click(`${lineSel(RK)} [data-testid=more]`); await click('[data-testid=remove]'); await b.sleep(300)
  ok('Remove takes the line out of the script and shows “Removed (1)” at the bottom of its chapter', (await count(lineSel(RK))) === 0 && /Removed \(1\)/.test((await text('[data-chapter="theme:t-pet"] [data-testid=removed-toggle]')) ?? ''))
  await click('[data-chapter="theme:t-pet"] [data-testid=removed-toggle]')
  ok('it lists who removed it and when, with Restore', /Removed by Maya Ortiz, \w{3} \d+, \d+:\d\d/.test((await text('[data-testid=removed-row]')) ?? '') && (await count('[data-testid=restore]')) === 1)
  await click('[data-testid=restore]'); await b.sleep(300)
  ok('Restore puts it back, needing audio', (await count(lineSel(RK))) === 1 && /Audio out of date/.test((await text(`${lineSel(RK)} [data-testid=needs-audio]`)) ?? ''))
  // Add a note
  await click('[data-chapter="headline"] [data-testid=add-line]'); await click('[data-testid=add-note]')
  await setVal('[data-testid=editor-text]', 'It was 9 of 20 people.'); await b.sleep(200)
  const noSrc = await b.evaluate(`({save:document.querySelector('[data-testid=editor-save]').disabled,msg:[...document.querySelectorAll('[data-testid=editor-checks] li')].map(x=>x.innerText)})`)
  ok('a Researcher’s note with a count is blocked until it links a source that matches', noSrc.save === true && noSrc.msg.some((m) => /needs a source/.test(m)), noSrc)
  await b.evaluate(`(()=>{const sel=document.querySelector('[data-testid=editor-source]'); const o=[...sel.options].find(x=>x.text==='Theme: The pet decides'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(sel,o.value); sel.dispatchEvent(new Event('change',{bubbles:true})); return true})()`); await b.sleep(200)
  ok('linked to the theme it matches (9 of 20) the note can be saved', (await b.evaluate(`document.querySelector('[data-testid=editor-save]').disabled`)) === false && (await text('[data-testid=check-numbers]')) === 'Numbers match the data')
  await click('[data-testid=editor-save]'); await b.sleep(300)
  await click('[data-chapter="headline"] [data-testid=add-line]'); await click('[data-testid=add-note]')
  await setVal('[data-testid=editor-text]', 'A thought of mine, with no count.'); await b.sleep(150); await click('[data-testid=editor-save]'); await b.sleep(300)
  const notes = await b.evaluate(`[...document.querySelectorAll('[data-testid=line][data-type=note]')].map(l=>({label:l.querySelector('[data-testid=line-label]').innerText,state:l.dataset.state,text:l.querySelector('[data-testid=line-text]').innerText}))`)
  ok('notes are labelled “Researcher’s note · name”, set apart from the AI’s lines, and start not approved', notes.length === 2 && notes.every((n) => n.label === 'Researcher’s note · Maya Ortiz' && n.state === 'Not approved'), notes)
  // Add a quote from the transcripts
  await click('[data-chapter="theme:t-price"] [data-testid=add-line]'); await click('[data-testid=add-quote]')
  await setVal('[data-testid=picker-search]', 'price', 'HTMLInputElement'); await b.sleep(400)
  const hitsInfo = await b.evaluate(`({n:document.querySelectorAll('[data-testid=picker-hit]').length,ids:[...document.querySelectorAll('[data-testid=picker-hit]')].map(h=>h.dataset.participant)})`)
  ok('quote search covers accepted sessions only: results, and never an excluded person (P-3112, P-3119)', hitsInfo.n > 0 && !hitsInfo.ids.some((i) => i === 'P-3112' || i === 'P-3119'), hitsInfo)
  const chosen = await b.evaluate(`(()=>{const h=[...document.querySelectorAll('[data-testid=picker-hit]')].find(x=>x.querySelector('[data-testid=picker-use]'));return {p:h.dataset.participant,text:h.querySelector('p').innerText.replace(/[“”]/g,'')}})()`)
  await b.evaluate(`[...document.querySelectorAll('[data-testid=picker-hit]')].find(x=>x.querySelector('[data-testid=picker-use]')).querySelector('[data-testid=picker-use]').click(); true`); await b.sleep(400)
  const added = (await store2()).lines.filter((l) => l.type === 'quote' && !l.key)
  ok('the chosen quote joins the chapter verbatim, with its own session, participant and time', added.length === 1 && added[0].text === chosen.text && added[0].cites[0].participantId === chosen.p && added[0].cites[0].sessionId && added[0].state === 'Not approved', { added, chosen })
  await click('[data-chapter="theme:t-price"] [data-testid=add-line]'); await click('[data-testid=add-quote]')
  await setVal('[data-testid=picker-search]', 'price', 'HTMLInputElement'); await b.sleep(400)
  ok('the same segment is then marked “Already included” and can’t be added twice', (await count('[data-testid=picker-already]')) >= 1 && await b.evaluate(`[...document.querySelectorAll('[data-testid=picker-already]')].every(x=>x.disabled)`))
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); true`); await b.sleep(250)
  // Replace a quote
  const QK = 'theme:t-price:q1'
  const qBefore = await b.evaluate(`document.querySelector('${lineSel(QK)} [data-testid=line-label]').innerText`)
  await click(`${lineSel(QK)} [data-testid=replace]`)
  await b.evaluate(`document.querySelector('[data-testid=picker-quote] [data-testid=picker-use]').click(); true`); await b.sleep(400)
  const qAfter = await b.evaluate(`document.querySelector('${lineSel(QK)} [data-testid=line-label]').innerText`)
  ok('Replace puts another person’s words in the same place, and it needs audio', qAfter !== qBefore && /Audio out of date/.test((await text(`${lineSel(QK)} [data-testid=needs-audio]`)) ?? ''), { qBefore, qAfter })
  ok('quotes have Replace, Hear original and Approve, and no Edit or Rewrite', await b.evaluate(`['replace','hear-original','approve'].every(t=>document.querySelector('${lineSel(QK)} [data-testid='+t+']')) && !document.querySelector('${lineSel(QK)} [data-testid=edit]') && !document.querySelector('${lineSel(QK)} [data-testid=rewrite]')`))
  // Approve is blocked when a line can't be approved
  const blockedApprove = await run(`const ctx=mk(); const doc=JSON.parse(localStorage.getItem('pulseai-qual:audio-summary'))['pet-food-churn']; const l=doc.lines.find(x=>x.key==='theme:t-pet:c-vet-diet'); return {ok:st.approvalProblem(l,ctx),none:st.approvalProblem({...l,cites:[]},ctx),wrong:st.approvalProblem({...l,text:l.text.replace(/\\d+ of \\d+/,'9 of 20')},ctx)}`)
  ok('a line can be approved only if cited, its numbers match and it is in date', blockedApprove.ok === null && blockedApprove.none === 'It has no source' && /Says 9 of 20/.test(blockedApprove.wrong), blockedApprove)
  // Voices
  await click('[data-testid=voice-menu]')
  await b.evaluate(`(()=>{const s=document.querySelector('[data-testid=voice-quote]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'Second voice, warm'); s.dispatchEvent(new Event('change',{bubbles:true})); return true})()`); await b.sleep(300)
  const afterQ = await store2()
  const nQuotes = afterQ.lines.filter((l) => !l.removed && l.type === 'quote').length
  ok('changing the quote voice marks every quote line Needs audio, and nothing else new', afterQ.lines.filter((l) => !l.removed && l.type === 'quote').every((l) => l.audio === 'Needs audio') && afterQ.voice.quote === 'Second voice, warm', afterQ.lines.filter((l) => l.audio === 'Needs audio').length)
  const nNeeds = afterQ.lines.filter((l) => !l.removed && l.audio === 'Needs audio').length
  ok('“Regenerate changed lines (n)” counts exactly the lines that need audio', new RegExp(`^Regenerate changed lines \\(${nNeeds}\\)$`).test((await text('[data-testid=regen-changed]')) ?? ''), { nNeeds })
  await b.evaluate(`document.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); true`)
  await click('[data-testid=regen-changed]'); await b.sleep(500)
  ok('regenerating shows a plain counter, “Producing audio, 2 of n”, with no spinner', new RegExp(`^Producing audio, \\d+ of ${nNeeds}$`).test((await text('[data-testid=producing]')) ?? '') && !(await count('[role=progressbar], svg.animate-spin, [data-testid=spinner]')))
  await b.poll(`!document.querySelector('[data-testid=producing]')`, 12000)
  const afterRegen = await store2()
  ok('afterwards only those lines are Current, and nothing needs audio', afterRegen.lines.filter((l) => !l.removed).every((l) => l.audio === 'Current') && (await text('[data-testid=regen-changed]')) === 'Regenerate changed lines (0)' && await b.evaluate(`document.querySelector('[data-testid=regen-changed]').disabled`))
  // single-line regenerate
  await click(`${lineSel('theme:t-pet:c-vet-diet')} [data-testid=edit]`)
  const vet = (await store2()).lines.find((l) => l.key === 'theme:t-pet:c-vet-diet')
  const vetReal = /(\d+ of \d+)/.exec(vet.text)[1]
  await setVal('[data-testid=editor-text]', `“Vet recommended a different diet” was raised by ${vetReal} people.`); await b.sleep(200); await click('[data-testid=editor-save]'); await b.sleep(300)
  await click(`${lineSel('theme:t-pet:c-vet-diet')} [data-testid=regen-audio]`); await b.poll(`!document.querySelector('[data-testid=producing]')`, 5000); await b.sleep(300)
  const single = await store2()
  ok('“Regenerate audio” on one line makes audio for that line only', single.lines.find((l) => l.key === 'theme:t-pet:c-vet-diet').audio === 'Current' && single.lines.filter((l) => !l.removed && l.audio === 'Needs audio').length === 0, single.lines.filter((l) => l.audio === 'Needs audio').length)
  // Target length, Rebuild, Focus, Start over
  const keysBefore = new Set((await store2()).lines.map((l) => l.key).filter(Boolean))
  await click(`${lineSel('theme:t-pet:c-pet-refused')} [data-testid=approve]`)
  await b.evaluate(`(()=>{const s=document.querySelector('[data-testid=target]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'12'); s.dispatchEvent(new Event('change',{bubbles:true})); return true})()`)
  await setVal('[data-testid=focus]', 'start with price creep', 'HTMLInputElement')
  await click('[data-testid=rebuild]'); await b.sleep(500)
  const rb2 = await store2()
  ok('Rebuild for 12 minutes keeps what was approved, edited or added, and the target is 12', rb2.target === 12 && rb2.lines.find((l) => l.key === KEY && !l.removed) && rb2.lines.find((l) => l.key === 'theme:t-pet:c-vet-diet').edited === true && rb2.lines.filter((l) => l.type === 'note').length === 2 && rb2.lines.some((l) => l.type === 'quote' && !l.key) && rb2.lines.find((l) => l.key === 'theme:t-pet:c-pet-refused').state === 'Approved')
  const order = await b.evaluate(`[...document.querySelectorAll('[data-testid=chapter]')].map(c=>c.dataset.chapter)`)
  ok('the focus “start with price creep” moved that theme to the front, and only the order changed', order.indexOf('theme:t-price') < order.indexOf('theme:t-pet') && [...new Set(rb2.lines.map((l) => l.key).filter(Boolean))].every((k) => keysBefore.has(k) || /^(signpost|headline|tension|thin|theme)/.test(k)), order)
  for (const bad of ['recommend a discount for price creep', 'add a new theme about delivery', '20 percent more price quotes', 'something unrelated']) {
    await setVal('[data-testid=focus]', bad, 'HTMLInputElement')
    const linesBefore = (await store2()).lines.length
    await click('[data-testid=rebuild]'); await b.sleep(300)
    ok(`the focus “${bad}” is refused: “I can change emphasis and order, not add advice or new findings”, and nothing is rebuilt`, (await text('[data-testid=focus-message]')) === 'I can change emphasis and order, not add advice or new findings' && (await store2()).lines.length === linesBefore)
  }
  await setVal('[data-testid=focus]', '', 'HTMLInputElement')
  // Start over warns with the number of edits lost
  const lostN = await run(`const doc=JSON.parse(localStorage.getItem('pulseai-qual:audio-summary'))['pet-food-churn']; return st.editsLost(doc)`)
  await click('[data-testid=start-over]')
  ok('Start over warns with the number of edits that will be lost', new RegExp(`^Start over\\? ${lostN} edits will be lost\\.`).test((await text('[data-testid=start-over-confirm]')) ?? '') && lostN >= 4, { lostN, msg: await text('[data-testid=start-over-confirm]') })
  await b.evaluate(`[...document.querySelectorAll('[data-testid=start-over-confirm] button')].find(x=>/Keep my edits/.test(x.innerText)).click(); true`); await b.sleep(200)
  ok('“Keep my edits” leaves everything as it is', (await count('[data-testid=start-over-confirm]')) === 0 && (await store2()).lines.some((l) => l.type === 'note'))
  await click('[data-testid=start-over]'); await click('[data-testid=start-over-yes]'); await b.sleep(400)
  const fresh2 = await store2()
  ok('Start over restores the whole AI draft: no notes, no added quotes, nothing edited', fresh2.lines.every((l) => l.type !== 'note' && !l.edited && !l.removed) && !fresh2.lines.some((l) => l.type === 'quote' && !l.key) && fresh2.target === 12)
  ok('none of the editing touched the codebook', (await codebook()) === cbBefore)
  ok('the player still works after editing: play, jump, speed and chapters', await (async () => { await openPage(); await click('[data-testid=play]'); await b.sleep(800); await click('[data-testid=play]'); await click('[data-testid=chapters-menu]'); await click('[data-testid=chapter-jump][data-chapter="tensions"]'); return (await b.evaluate(`document.querySelector('[data-testid=line][data-current=true]').dataset.type`)) === 'signpost' })())

  // States
  await openPage('?demo=error')
  ok('?demo=error shows “The audio summary didn’t load” with Retry', /The audio summary didn’t load/.test(await b.evaluate('document.body.innerText')))
  await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(x=>/codebook/.test(x));const s=JSON.parse(localStorage.getItem(k));const d=s['pet-food-churn'];d.themes=d.themes.filter(t=>t.id==='t-price'||t.tensionId);localStorage.setItem(k,JSON.stringify(s));return true})()`)
  await openPage()
  ok('with fewer than 2 approved themes it says “Not enough approved material for a summary”', (await count('[data-testid=not-enough]')) === 1 && /Not enough approved material for a summary/.test(await b.evaluate('document.body.innerText')))
  await b.evaluate(`(()=>{const k=Object.keys(localStorage).find(x=>/codebook/.test(x));const s=JSON.parse(localStorage.getItem(k));const d=s['pet-food-churn'];d.themes=[];localStorage.setItem(k,JSON.stringify(s));return true})()`)
  await openPage()
  ok('with no approved themes it says “No approved themes yet” and links to the codebook', /No approved themes yet/.test(await b.evaluate('document.body.innerText')) && (await count('a[href$="/analysis/codebook"]')) >= 1)
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('A3 AUDIO SUMMARY FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('A3 AUDIO SUMMARY OK')
