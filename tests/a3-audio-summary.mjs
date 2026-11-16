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
    return n.map(l=>({key:l.key,text:l.text,cites:l.cites.length,figs:nr.figures(l.text).length,words:nr.words(l.text),pct:/%|percent/i.test(l.text),ok:nr.checkNarration(l.text,{faceBased:l.key==='tension:tn-pause-portion-face:n'}).ok,numbers:sc.numbersCheck(l.text,l.source,l.cites,ctx).every(x=>x.ok),mostOk:!/\\b(most people|majority)\\b/i.test(l.text)||nr.figures(l.text).some(f=>f.n*2>f.of)}))`)
  ok('every narration line has a citation and exactly one “n of N”', rules.length >= 8 && rules.every((r) => r.cites >= 1 && r.figs === 1), rules.filter((r) => r.cites < 1 || r.figs !== 1))
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
  const edit = await run(`const ctx=mk(); let doc=st.newDoc('pet-food-churn',sc.buildDraft(ctx,10),10,'Maya Ortiz'); const line=doc.lines.find(l=>l.key==='theme:t-price:n'); const real=sc.numbersCheck(line.text,line.source,line.cites,ctx)[0].text
    doc=st.approve(doc,line.id,'Maya Ortiz',ctx); const wasApproved=doc.lines.find(l=>l.id===line.id).state
    const bad=st.editLine(doc,line.id,'Price creep came up for 9 of 20 people.','Maya Ortiz',ctx); const nosrc=st.editLine(doc,line.id,'Price creep came up for 8 of 20 people.','Maya Ortiz',ctx,undefined,[])
    const good=st.editLine(doc,line.id,'Price creep was raised by '+real+' people.','Maya Ortiz',ctx); const after=good.doc.lines.find(l=>l.id===line.id)
    const note=st.addNote(doc,'headline','A plain thought from me.','Maya Ortiz',ctx); const noteNum=st.addNote(doc,'headline','It was 9 of 20 people.','Maya Ortiz',ctx); const noteMatch=st.addNote(doc,'headline','It was '+real+' people.','Maya Ortiz',ctx,line.source,line.cites)
    const added=note.doc.lines.find(l=>l.type==='note')
    return {real,wasApproved,badProblems:bad.problems,badSaved:bad.doc!==doc,nosrcProblems:nosrc.problems,goodProblems:good.problems,after:{state:after.state,edited:after.edited,audio:after.audio,prev:after.history.at(-1)},noteOk:note.problems.length===0&&added.state==='Not approved'&&added.author==='Maya Ortiz',noteNumBlocked:noteNum.problems.length>0&&/needs a source/.test(noteNum.problems[0]),noteMatchOk:noteMatch.problems.length===0}`)
  ok('Save is blocked when the number doesn’t match its source, and says “Says 9 of 20. The data says 8 of 20”', edit.badProblems.includes('Says 9 of 20. The data says 8 of 20') && !edit.badSaved, edit)
  ok('Save is blocked on a narration line with no source', edit.nosrcProblems.includes('Add a source'), edit.nosrcProblems)
  ok('a good edit saves: the line is Edited, needs audio, its approval is gone and the old wording is in History', edit.wasApproved === 'Approved' && edit.goodProblems.length === 0 && edit.after.state === 'Edited' && edit.after.edited === true && edit.after.audio === 'Needs audio' && edit.after.prev.action === 'Edited' && /came up for/.test(edit.after.prev.previous), edit)
  ok('a Researcher’s note with no count saves as it is; one with a count needs a linked source that matches', edit.noteOk && edit.noteNumBlocked && edit.noteMatchOk, edit)
  const rw = await run(`const ctx=mk(); let doc=st.newDoc('pet-food-churn',sc.buildDraft(ctx,10),10,'Maya Ortiz'); const line=doc.lines.find(l=>l.key==='theme:t-price:n'); const before=line.text
    const r1=st.rewrite(doc,line.id,'','Maya Ortiz'); const a=r1.lines.find(l=>l.id===line.id); const r2=st.rewrite(r1,line.id,'Shorter','Maya Ortiz'); const b2=r2.lines.find(l=>l.id===line.id)
    return {changed:a.text!==before,fig:nr.figures(a.text)[0]&&nr.figures(a.text)[0].n===nr.figures(before)[0].n&&nr.figures(a.text)[0].of===nr.figures(before)[0].of,passes:nr.checkNarration(a.text).ok&&nr.checkNarration(b2.text).ok,keptBefore:a.history.at(-1).previous===before,audio:a.audio,state:a.state,numbers:sc.numbersCheck(a.text,a.source,a.cites,ctx).every(x=>x.ok),short:b2.text.length<=a.text.length}`)
  ok('Rewrite gives another wording of the same claim: same figure, passes the rules, previous wording in History, needs audio', rw.changed && rw.fig && rw.passes && rw.keptBefore && rw.audio === 'Needs audio' && rw.state === 'Not approved' && rw.numbers, rw)

  // ═══ Voices and audio ═══
  const au = await run(`const ctx=mk(); let doc=st.newDoc('pet-food-churn',sc.buildDraft(ctx,10),10,'Maya Ortiz'); const live=doc.lines.filter(l=>!l.removed)
    const nv=st.setVoice(doc,'narrator','Warm','Maya Ortiz'); const qv=st.setVoice(doc,'quote','Second voice, warm','Maya Ortiz')
    const nNeeds=nv.lines.filter(l=>l.audio==='Needs audio'); const qNeeds=qv.lines.filter(l=>l.audio==='Needs audio')
    const edited=st.editLine(doc,live.find(l=>l.key==='theme:t-price:n').id,'Price creep was raised by '+sc.numbersCheck(live.find(l=>l.key==='theme:t-price:n').text,live.find(l=>l.key==='theme:t-price:n').source,live.find(l=>l.key==='theme:t-price:n').cites,ctx)[0].text+' people.','Maya Ortiz',ctx).doc
    const r=st.regenerateAudio(edited,undefined,'Maya Ortiz'); const before=edited.lines.filter(l=>l.audio==='Needs audio').length
    const one=st.regenerateAudio(nv,[live.find(l=>l.type==='quote').id],'Maya Ortiz')
    return {nOnly:nNeeds.every(l=>l.type!=='quote')&&nNeeds.length===live.filter(l=>l.type!=='quote').length,qOnly:qNeeds.every(l=>l.type==='quote')&&qNeeds.length===live.filter(l=>l.type==='quote').length,textSame:JSON.stringify(nv.lines.map(l=>l.text))===JSON.stringify(doc.lines.map(l=>l.text)),statesSame:JSON.stringify(nv.lines.map(l=>l.state))===JSON.stringify(doc.lines.map(l=>l.state)),before,made:r.made,after:r.doc.lines.filter(l=>l.audio==='Needs audio').length,untouched:r.doc.lines.filter(l=>l.audio==='Current').length===live.length,oneMade:one.made,oneLeft:one.doc.lines.filter(l=>l.audio==='Needs audio').length,nonQuote:live.filter(l=>l.type!=='quote').length,total:live.length}`)
  ok('changing the narrator voice marks every narrator-read line “Needs audio” and nothing else; the quote voice only the quotes', au.nOnly && au.qOnly && au.textSame && au.statesSame, au)
  ok('regenerating audio touches only lines that need it: one edited line, one regenerated, none left', au.before === 1 && au.made === 1 && au.after === 0 && au.untouched, au)
  ok('regenerating a line whose audio is current does nothing: after a narrator voice change, a quote line makes none and leaves all the narrator lines waiting', au.oneMade === 0 && au.oneLeft === au.nonQuote, au)

  // ═══ Remove, restore, rebuild, start over ═══
  const rb = await run(`const ctx=mk(); let doc=st.newDoc('pet-food-churn',sc.buildDraft(ctx,10),10,'Maya Ortiz'); const k=(key)=>doc.lines.find(l=>l.key===key)
    const approvedKey='theme:t-price:n', editedKey='theme:t-pet:n', removedKey='headline-keep'
    doc=st.approve(doc,k(approvedKey).id,'Maya Ortiz',ctx)
    const realText=sc.numbersCheck(k(editedKey).text,k(editedKey).source,k(editedKey).cites,ctx)[0].text
    doc=st.editLine(doc,k(editedKey).id,'The pet decides was raised by '+realText+' people.','Maya Ortiz',ctx).doc
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
    const line=doc.lines.find(l=>l.key==='headline-reason'); const real=sc.numbersCheck(line.text,line.source,line.cites,ctx)[0].text
    const edited=st.editLine(doc,line.id,'“Price went up” was given by '+real+' people.','Maya Ortiz',ctx).doc
    const draft2=sc.buildDraft(ctx2,10); const kept=st.chooseUpdate(edited,line.id,'mine',draft2,'Maya Ortiz',ctx2); const taken=st.chooseUpdate(edited,line.id,'new',draft2,'Maya Ortiz',ctx2)
    return {allCurrentBefore:before.every(([,s])=>s==='current'),changed,was:after.find(x=>x.key==='headline-reason').s,tensionState:ts,keptText:kept.lines.find(l=>l.id===line.id).text===edited.lines.find(l=>l.id===line.id).text,keptFlag:!!kept.lines.find(l=>l.id===line.id).keptAs,keptNotStale:!st.isOutOfDate(kept.lines.find(l=>l.id===line.id),ctx2),takenText:taken.lines.find(l=>l.id===line.id).text,takenState:taken.lines.find(l=>l.id===line.id).state,untouchedNoOp:st.updateLine(edited,'nope',draft2,'x')===edited}`)
  ok('before anything changes, no line is out of date', ch.allCurrentBefore)
  ok('lowering a count marks exactly the lines built from it (and no others), with the old and new values', ch.changed.includes('headline-reason') && ch.changed.includes('theme:t-price:code') && ch.was.state === 'changed' && /^Was 8 of 20, now 7 of 20$/.test(ch.was.why) && !ch.changed.includes('frame-open') && !ch.changed.includes('theme:t-pet:n'), ch)
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
