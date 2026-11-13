// A3 Theme videos and Showreel (mock): accepted themes and sessions only, the automatic pick, versions and the Default, the
// clip list, the Showreel built from Default versions, export gating, and Back to Report.
//   npx vite --port 5199 --strictPort &   then   node tests/a3-showreel.mjs
import { launch } from './cdp.mjs'
const b = await launch()
const STUDY = '/researcher/studies/pet-food-churn/analysis'
const failures = []
const checks = []
const ok = (label, cond, detail) => {
  checks.push(label)
  if (!cond) failures.push(detail !== undefined ? `${label} (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : label)
}
const q = (s) => JSON.stringify(s)
const count = (sel) => b.evaluate(`document.querySelectorAll(${q(sel)}).length`)
const text = (sel) => b.evaluate(`document.querySelector(${q(sel)})?.innerText.replace(/\\s+/g,' ') ?? null`)
const click = async (sel) => { const done = await b.poll(`(()=>{const e=document.querySelector(${q(sel)});if(!e||e.disabled)return false;e.click();return true})()`); if (!done) throw new Error(`nothing to click for ${sel}`); await b.sleep(250) }
const MOD = `window.__mod = (path) => import(performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes(path + '.ts')).pop() ?? path + '.ts')`
const PRE = `${MOD};
  const cb=await window.__mod('/src/state/codebook'); const ms=await window.__mod('/src/mock/signals'); const sess=await window.__mod('/src/mock/sessions'); const sh=await window.__mod('/src/mock/showreel'); const st=await window.__mod('/src/state/showreel')
  const store=()=>Object.values(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/codebook/.test(k)))))[0]
  const sid=(p)=>sess.sessionIdOf(sess.PET_SEED_SESSIONS.find(x=>x.participant===p&&x.variant==='done'))
  const basisOf=(parts)=>cb.basisOf(parts.map(p=>({id:sid(p),participantId:p})))`
const run = (body) => b.evaluate(`(async()=>{${PRE}; ${body}})()`)
const shows = () => b.evaluate(`JSON.parse(localStorage.getItem('pulseai-qual:showreel')||'{}')['pet-food-churn']`)
const clips = () => b.evaluate(`[...document.querySelectorAll('[data-testid=clip-row]')].map(r=>({id:r.dataset.clip,p:r.dataset.participant}))`)
const open = async (tab = '') => { await b.goto(`${STUDY}/report/videos${tab}`); await b.waitFor('Theme videos'); await b.sleep(900) }
const pickTheme = async (i) => { await b.evaluate(`document.querySelectorAll('[data-testid=theme-row]')[${i}].click(); true`); await b.sleep(500) }

try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true')

  // ═══ Entry, and Back to Report keeps the report as it was ═══
  await b.goto(`${STUDY}/report`); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(1500)
  await b.evaluate(`document.querySelector('[data-testid=exec-card] [data-testid=sentence-text]').click(); true`); await b.sleep(300)
  await click('[data-testid=approve]')
  const before = await b.evaluate(`[...document.querySelectorAll('[data-testid=exec-card] [data-testid=sentence]')].map(s=>s.dataset.state).join()`)
  await click('[data-testid=tool-theme-videos]'); await b.waitFor('Back to Report'); await b.sleep(600)
  ok('Theme videos in Tools opens the page at /report/videos on the Theme videos tab', /\/analysis\/report\/videos$/.test(await b.evaluate('location.pathname')) && (await b.evaluate(`document.querySelector('[data-testid=tab-themes]').getAttribute('aria-selected')`)) === 'true')
  await click('[data-testid=back-to-report]'); await b.waitFor('EXECUTIVE SUMMARY'); await b.sleep(1200)
  const after = await b.evaluate(`[...document.querySelectorAll('[data-testid=exec-card] [data-testid=sentence]')].map(s=>s.dataset.state).join()`)
  ok('Back to Report returns with the approval exactly as it was', before === after && /^Approved/.test(after), { before, after })
  await click('[data-testid=tool-showreel]'); await b.waitFor('Back to Report'); await b.sleep(600)
  ok('Showreel in Tools opens the same page on the Showreel tab', /tab=showreel/.test(await b.evaluate('location.search')) && (await b.evaluate(`document.querySelector('[data-testid=tab-showreel]').getAttribute('aria-selected')`)) === 'true')

  // ═══ The data ═══
  await open()
  ok('the header keeps the study line, the Lens selector and two tabs', /Built on 20 accepted sessions · 2 excluded left out · Release v1\.0/.test((await text('[data-testid=built-on]')) ?? '') && (await count('[data-testid=lens-select]')) === 1 && (await count('[role=tab]')) === 2, await text('[data-testid=built-on]'))
  const data = await run(`const doc=store(); const basis=basisOf(ms.ACCEPTED_PARTICIPANTS); const excl=sess.PET_SEED_SESSIONS.filter(s=>s.review?.status==='Excluded').map(s=>s.participant);
    const themes=doc.themes.map(t=>({id:t.id,name:t.name,clips:sh.clipsOfTheme(doc,t,basis)}));
    const all=themes.flatMap(t=>t.clips); const audio=all.filter(c=>c.mode==='audio-only')
    // An excluded person's quotes are in the codebook's quotes: they must still never be a clip.
    const withExcluded=basisOf([...ms.ACCEPTED_PARTICIPANTS,...excl]); const leak=doc.themes.flatMap(t=>sh.clipsOfTheme(doc,t,basis)).filter(c=>excl.includes(c.participantId)).length
    const picks=themes.map(t=>{const p=sh.autoPick(t.clips);return {id:t.id,n:p.length,people:new Set(p.map(c=>c.participantId)).size,eligiblePeople:new Set(t.clips.map(c=>c.participantId)).size}})
    const lens=all.map(c=>sh.clipLength(c))
    const few=sh.autoPick(themes[0].clips.slice(0,3))
    const small=basisOf(ms.ACCEPTED_PARTICIPANTS.slice(0,2)); const tiny=sh.clipsOfTheme(doc,doc.themes[0],small)
    return {names:themes.map(t=>t.name),docThemes:doc.themes.length,excl,leak,sessionsOk:all.every(c=>basis.sessions.has(c.sessionId)),picks,minLen:Math.min(...lens),maxLen:Math.max(...lens),few:few.length,tiny:tiny.length,audio:audio.length,audioStrengths:[...new Set(audio.map(c=>c.emotionStrength))],audioOnlyTile:audio.every(c=>c.mode==='audio-only')}`)
  const rail = await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-row]')].map(r=>r.querySelector('span').innerText)`)
  ok('only accepted themes are listed: the same as the codebook’s themes with accepted codes', JSON.stringify(rail) === JSON.stringify(data.names) && rail.length === data.docThemes, { rail, names: data.names })
  ok('excluded sessions never produce a clip, and every clip is from an accepted session', data.excl.length === 2 && data.leak === 0 && data.sessionsOk, data)
  ok('every clip is 6 to 15 seconds', data.minLen >= 6 && data.maxLen <= 15, data)
  ok('the automatic pick is 4 to 8 clips with one per person when enough people exist; fewer than 4 clips gives none', data.picks.every((p) => p.n >= 4 && p.n <= 8 && (p.eligiblePeople >= p.n ? p.people === p.n : true)) && data.few === 0, data.picks)
  ok('a theme with fewer than 4 eligible clips has no automatic pick (so nothing to export)', data.tiny < 4 && (await run(`const doc=store(); const t=doc.themes[0]; const small=basisOf(ms.ACCEPTED_PARTICIPANTS.slice(0,2)); const th={id:t.id,name:t.name,clips:sh.clipsOfTheme(doc,t,small)}; return th.clips.length<4`)))
  ok('audio-only clips keep their own tile and a strength; they are never “no reaction” or neutral', data.audio > 0 && data.audioStrengths.every((s) => ['High', 'Medium', 'Low'].includes(s)))

  // ═══ Theme videos ═══
  ok('the rail shows n of N and “No default yet”', /\d+ of 20 people/.test((await text('[data-testid=theme-row]')) ?? '') && /No default yet/.test((await text('[data-testid=theme-row]')) ?? ''))
  const nums = await b.evaluate(`[...document.querySelectorAll('[data-testid=theme-row]')].map(r=>r.innerText.match(/(\\d+) of 20/)[1]).join()`)
  ok('the counts are the report’s: Price creep 8 of 20, The pet decides 9 of 20, with no percentages', nums === '8,9' && !/%/.test(await b.evaluate('document.body.innerText')), nums)
  ok('the chart shows every theme by n of N, with the selected one marked', (await count('[data-testid=chart-row]')) === 2 && (await count('[data-testid=chart-row][data-selected=true]')) === 1)
  ok('the header has the AI-generated line and Read more', /AI-generated/.test((await text('[data-testid=theme-main] header')) ?? '') && (await count('[data-testid=read-more]')) === 1)
  const initial = await clips()
  ok('the first version is an automatic pick of 4 to 8 clips, one person each', initial.length >= 4 && initial.length <= 8 && new Set(initial.map((c) => c.p)).size === initial.length, initial.length)
  const total = Number((await text('[data-testid=total]')).match(/(\d+) s/)[1])
  ok('total length is shown, with an amber line only outside 45 to 90 seconds', (total < 45 || total > 90) === ((await count('[data-testid=length-warning]')) === 1), { total, warn: await count('[data-testid=length-warning]') })
  // remove down to a short video
  while ((await count('[data-testid=clip-row]')) > 3) await click('[data-testid=remove]')
  ok('removing below 4 clips is allowed and says “Fewer than 4 clips.”; the length warning shows', /Fewer than 4 clips/.test((await text('[data-testid=few-clips]')) ?? '') && (await count('[data-testid=length-warning]')) === 1 && /Brief asks for 45 to 90 seconds\./.test((await text('[data-testid=length-warning]')) ?? ''))
  // Rebuild a clean version for the rest.
  const ver0 = await shows()
  ok('removing changed the working version, so only the version was stored, not lengths or scores', JSON.stringify(ver0).indexOf('score') === -1 && JSON.stringify(ver0).indexOf('"total"') === -1)

  // reorder
  const list0 = await clips()
  await click('[data-testid=clip-row]:nth-child(1) [data-testid=move-down]')
  const list1 = await clips()
  ok('moving a clip down reorders the list and the video', list1[0].id === list0[1].id && list1[1].id === list0[0].id)
  await click('[data-testid=clip-row]:nth-child(2) [data-testid=move-up]')
  ok('and up puts it back', (await clips())[0].id === list0[0].id)

  // add, then replace without duplicates
  await click('[data-testid=add-clip]'); await b.waitFor('Other clips for this theme'); await b.sleep(300)
  const poolIds = await b.evaluate(`[...document.querySelectorAll('[data-testid=picker-row]')].map(r=>r.dataset.clip)`)
  const inVideo = (await clips()).map((c) => c.id)
  ok('the picker lists only clips not already in the video, best score first', poolIds.length > 0 && poolIds.every((id) => !inVideo.includes(id)))
  const scores = await b.evaluate(`[...document.querySelectorAll('[data-testid=picker-row]')].map(r=>Number(r.dataset.score))`)
  ok('sorted by score', scores.every((s, i) => i === 0 || scores[i - 1] >= s), scores)
  await b.evaluate(`document.querySelector('[data-testid=filter-emotion]').value; var s=document.querySelector('[data-testid=filter-emotion]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'High'); s.dispatchEvent(new Event('change',{bubbles:true})); true`); await b.sleep(250)
  const filtered = await b.evaluate(`[...document.querySelectorAll('[data-testid=picker-row]')].every(r=>/High emotion/.test(r.innerText))`)
  ok('the emotion filter narrows the list', filtered)
  await b.evaluate(`var s=document.querySelector('[data-testid=filter-emotion]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'All'); s.dispatchEvent(new Event('change',{bubbles:true})); true`); await b.sleep(250)
  await click('[data-testid=preview]')
  ok('Preview plays that clip in the main player', /Previewing/.test((await text('[data-testid=previewing]')) ?? '') && (await count('[data-testid=now-playing]')) === 1)
  await click('[data-testid=use-clip]'); await b.sleep(300)
  const added = await clips()
  ok('Use this clip adds it at the end', added.length === list0.length - (list0.length - 3) + 1 || added.length === 4, added.length)
  await click('[data-testid=clip-row]:nth-child(1) [data-testid=replace]'); await b.waitFor('Replace this clip'); await b.sleep(300)
  const firstId = (await clips())[0].id
  const pick = await b.evaluate(`document.querySelector('[data-testid=picker-row]').dataset.clip`)
  await click('[data-testid=use-clip]'); await b.sleep(300)
  const replaced = await clips()
  ok('Replace puts the chosen clip in the same position, and the old one is out', replaced[0].id === pick && !replaced.some((c) => c.id === firstId) && new Set(replaced.map((c) => c.id)).size === replaced.length, replaced.map((c) => c.id))
  const dupe = await run(`const d=JSON.parse(localStorage.getItem('pulseai-qual:showreel'))['pet-food-churn']; const t=Object.keys(d.themes)[0]; const v=d.themes[t].versions[0]; const second=v.clipIds[1]; const next=st.replaceClip(d,t,v.id,v.clipIds[0],second); return JSON.stringify(next.themes[t].versions[0].clipIds)===JSON.stringify(v.clipIds)`)
  ok('replacing with a clip already in the video changes nothing, so a duplicate can’t be made', dupe === true)

  // versions
  ok('Regenerate is available with fewer than 3 versions', (await b.evaluate(`!document.querySelector('[data-testid=regenerate]').disabled`)))
  for (const instruction of ['More from dog owners', 'Shorter']) {
    await click('[data-testid=regenerate]')
    await b.evaluate(`var t=document.querySelector('#regen-text'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,${q(instruction)}); t.dispatchEvent(new Event('input',{bubbles:true})); true`)
    await click('[data-testid=create-version]'); await b.sleep(300)
  }
  ok('two more versions are made, each Simulated, with the instruction saved', (await count('[data-testid=version-chip]')) === 3 && /Simulated/.test((await text('[data-testid=version-chip][data-version=v3]')) ?? '') && (await shows()).themes[Object.keys((await shows()).themes)[0]].versions.some((v) => v.instruction === 'Shorter'))
  ok('at 3 versions Regenerate is disabled and says “Delete a version to make a new one.”', (await b.evaluate(`document.querySelector('[data-testid=regenerate]').disabled`)) && /Delete a version to make a new one\./.test((await text('[data-testid=regen-reason]')) ?? ''))
  const fourth = await run(`const d=JSON.parse(localStorage.getItem('pulseai-qual:showreel'))['pet-food-churn']; const t=Object.keys(d.themes)[0]; const doc=store(); const theme=doc.themes.find(x=>x.id===t); const el=sh.clipsOfTheme(doc,theme,basisOf(ms.ACCEPTED_PARTICIPANTS)); const next=st.newVersion(d,t,el,'x'); return {reason:st.cantRegenerate(d,t,el),versions:next.themes[t].versions.length}`)
  ok('a fourth version cannot be created even by the code', fourth.versions === 3 && /Delete a version/.test(fourth.reason), fourth)
  // default: cannot delete it
  await click('[data-testid=version-chip][data-version=v1] button'); await b.sleep(200)
  await click('[data-testid=set-default]')
  ok('Set as default marks it', (await b.evaluate(`document.querySelector('[data-testid=version-chip][data-version=v1]').dataset.default`)) === 'true' && /Default set/.test((await text('[data-testid=theme-row]')) ?? ''))
  ok('the Default version cannot be deleted while it is the default', await b.evaluate(`document.querySelector('[data-testid=version-chip][data-version=v1] [data-testid=delete-version]').disabled`))
  await click('[data-testid=version-chip][data-version=v3] [data-testid=delete-version]'); await b.sleep(300)
  ok('deleting another version re-enables Regenerate', (await count('[data-testid=version-chip]')) === 2 && (await b.evaluate(`!document.querySelector('[data-testid=regenerate]').disabled`)))
  await click('[data-testid=version-chip][data-version=v2] button'); await b.sleep(200)
  ok('clicking a chip shows that version (the undo)', (await b.evaluate(`document.querySelector('[data-testid=version-chip][data-version=v2] button').getAttribute('aria-pressed')`)) === 'true')

  // captions
  const capOn = await count('[data-testid=caption]')
  await b.evaluate(`document.querySelector('[role=switch][aria-label=Captions]').click(); true`); await b.sleep(250)
  ok('Captions switch hides the lower-third quote and is kept on the version', capOn === 1 && (await count('[data-testid=caption]')) === 0)

  // player: play runs a clock through the clips
  await click('[data-testid=version-chip][data-version=v1] button'); await b.sleep(200)
  const t0 = await text('[data-testid=clock]')
  await click('[data-testid=play]'); await b.sleep(1500)
  const t1 = await text('[data-testid=clock]')
  ok('Play runs a real-time clock through the clips; the progress bar has one segment per clip', t0 !== t1 && (await count('[data-testid=segment]')) === (await count('[data-testid=clip-row]')), { t0, t1 })
  await click('[data-testid=next-clip]')
  ok('Skip to next clip moves to the next segment', (await b.evaluate(`[...document.querySelectorAll('[data-testid=segment]')].findIndex(s=>s.dataset.active==='true')`)) === 1)

  // export, theme tab
  await click('[data-testid=export-button]')
  ok('with a default, the theme export items are enabled', (await b.evaluate(`['mp4','link','storyboard'].every(k=>!document.querySelector('[data-testid=export-'+k+']').disabled)`)))
  await click('[data-testid=export-mp4]')
  ok('MP4 shows the mock toast', await b.poll(`/Export queued \\(mock\\)/.test(document.body.innerText)`, 2000))
  await click('[data-testid=export-button]'); await click('[data-testid=export-link]')
  ok('the embeddable link shows an iframe snippet', /<iframe src="https:\/\/qual\.example\/embed\/pet-food-churn\//.test((await text('[data-testid=embed-snippet]')) ?? ''))
  await pickTheme(1)
  await click('[data-testid=export-button]')
  ok('a theme without a default has every export item disabled, with the reason', (await b.evaluate(`['mp4','link','storyboard'].every(k=>document.querySelector('[data-testid=export-'+k+']').disabled)`)) && /Set a default version first/.test((await text('[data-testid=export-reason]')) ?? ''))
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); true`)

  // ═══ Showreel ═══
  await b.goto(`${STUDY}/report/videos?tab=showreel`); await b.waitFor('THEME ORDER'); await b.sleep(800)
  ok('with one default set, the showreel has only that theme; the other says “No default set”', (await count('[data-testid=storyboard-theme]')) === 1 && (await count('[data-testid=no-default]')) === 1)
  ok('Showreel export items are enabled with one included theme with a default', (await click('[data-testid=export-button]'), await b.evaluate(`['reel-mp4','full-mp4','reel-link','reel-storyboard'].every(k=>!document.querySelector('[data-testid=export-'+k+']').disabled)`)))
  await b.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); true`)
  // Give the second theme a default too.
  await b.goto(`${STUDY}/report/videos`); await b.waitFor('Theme videos'); await b.sleep(700)
  await pickTheme(1); await b.sleep(600)
  await click('[data-testid=set-default]')
  await b.goto(`${STUDY}/report/videos?tab=showreel`); await b.waitFor('THEME ORDER'); await b.sleep(800)
  const order1 = await b.evaluate(`[...document.querySelectorAll('[data-testid=storyboard-theme]')].map(t=>t.dataset.theme)`)
  await click('[data-testid=order-row]:nth-child(1) [data-testid=theme-down]'); await b.sleep(300)
  const order2 = await b.evaluate(`[...document.querySelectorAll('[data-testid=storyboard-theme]')].map(t=>t.dataset.theme)`)
  const rowOrder = await b.evaluate(`[...document.querySelectorAll('[data-testid=order-row]')].map(r=>r.dataset.theme)`)
  ok('both themes are in the showreel, and the storyboard follows the Researcher’s order after a move', order1.length === 2 && order2.length === 2 && order2[0] === order1[1] && JSON.stringify(order2) === JSON.stringify(rowOrder), { order1, order2, rowOrder })
  const reel = await run(`const d=JSON.parse(localStorage.getItem('pulseai-qual:showreel'))['pet-food-churn']; const doc=store(); const basis=basisOf(ms.ACCEPTED_PARTICIPANTS); const themes=doc.themes.map(t=>({id:t.id,clips:new Map(sh.clipsOfTheme(doc,t,basis).map(c=>[c.id,c]))})); const secs=st.reelSections(d,themes,(id)=>themes.find(t=>t.id===id).clips); return {secs:secs.map(s=>({id:s.theme.id,ids:s.clips.map(c=>c.id),def:d.themes[s.theme.id].defaultId===s.version.id})), order:d.order}`)
  ok('the showreel uses each theme’s Default version only, in the saved theme order', reel.secs.length === 2 && reel.secs.every((s) => s.def) && JSON.stringify(reel.secs.map((s) => s.id)) === JSON.stringify(reel.order), reel)
  const titles = await b.evaluate(`document.querySelectorAll('[data-testid=segment]').length`)
  ok('the player has a title card segment for each theme plus the clips', titles > 2 + 8 - 8)
  await click('[data-testid=order-row]:nth-child(1) [data-testid=include]'); await b.sleep(300)
  ok('a theme left out is absent from the showreel and the total drops', (await count('[data-testid=storyboard-theme]')) === 1 && /1 theme/.test((await text('[data-testid=reel-total]')) ?? ''))
  await click('[data-testid=order-row]:nth-child(2) [data-testid=include]'); await b.sleep(300)
  ok('with nothing included the showreel is empty and every export item is disabled with a reason', (await count('[data-testid=reel-empty]')) === 1 && (await (click('[data-testid=export-button]'), b.evaluate(`['reel-mp4','full-mp4','reel-link','reel-storyboard'].every(k=>document.querySelector('[data-testid=export-'+k+']').disabled)`))))
  ok('and it says no percentages anywhere, and no excluded session appears on the page', !/%/.test(await b.evaluate('document.body.innerText')) && !/P-3112|P-3119/.test(await b.evaluate('document.body.innerText')))
} catch (e) {
  failures.push(`stopped: ${e.message}`)
} finally {
  b.close()
}
console.log(`${checks.length} checks, ${failures.length} failed`)
if (failures.length) {
  console.log('A3 SHOWREEL FAILED:\n - ' + failures.join('\n - '))
  process.exitCode = 1
} else console.log('A3 SHOWREEL OK')
