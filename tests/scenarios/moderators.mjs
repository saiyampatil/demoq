// R12 moderator setup after "add instead of request". Every check waits on state (b.poll) and throws when it fails.
// Run: npx vite --port 5199 --strictPort &   then   node tests/setup-flow.mjs mod moderators
const setIn = (sel, v) => `(()=>{const i=document.querySelector(${JSON.stringify(sel)});const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,${JSON.stringify(v)});i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`
const GUIDE = 'moisturizer-concept'

export default async ({ b, out, stage, mutate, open, prefix }) => {
  out.checks = {}
  const expect = async (label, expr, ms = 6000) => {
    const ok = await b.poll(expr, ms)
    out.checks[label] = !!ok
    if (!ok) {
      console.error(JSON.stringify(out, null, 1))
      throw new Error(`FAILED: ${label}`)
    }
  }
  const click = async (sel) => {
    const ok = await b.poll(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e||e.disabled)return false;e.click();return true})()`)
    out.checks[`click ${sel}`] = !!ok
    if (!ok) {
      console.error(JSON.stringify(out, null, 1))
      throw new Error(`FAILED: nothing to click for ${sel}`)
    }
  }
  const rows = (tid = 'moderator-row') => `[...document.querySelectorAll('[data-testid=${tid}]')].map(r=>r.innerText.replace(/\\s+/g,' '))`
  const rowHas = (name, ...bits) => `${rows()}.some(r=>r.includes(${JSON.stringify(name)})&&${JSON.stringify(bits)}.every(x=>r.includes(x)))`
  const standbyHas = (name, ...bits) => `${rows('standby-row')}.some(r=>r.includes(${JSON.stringify(name)})&&${JSON.stringify(bits)}.every(x=>r.includes(x)))`
  const clickInRow = (name, sel) => `(()=>{const r=[...document.querySelectorAll('[data-testid=moderator-row]')].find(r=>r.innerText.includes(${JSON.stringify(name)}));const b=r?.querySelector(${JSON.stringify(sel)});if(!b)return false;b.click();return true})()`
  const state = (path) => b.evaluate(`(()=>{const s=JSON.parse(localStorage.getItem('pulseai-qual:v2'));return (${path})(s)})()`)
  const team = () => b.evaluate(`JSON.parse(localStorage.getItem('pulseai-qual:team-moderators')||'[]')`)
  const pickMode = async (label) => {
    await b.poll(`(()=>{const e=__q('label',${JSON.stringify(label)});if(!e)return false;e.click();return true})()`)
    await b.sleep(400)
    // With a guide in place, switching asks first.
    await b.evaluate(`[...document.querySelectorAll('[role=dialog] button')].find(x=>/Switch|Replace|Confirm|Continue/.test(x.innerText))?.click(); true`)
    await b.sleep(400)
  }
  const addNew = async (name, email, tags) => {
    await click('[data-testid=team-add-new]')
    await expect('modal opens', `!!document.querySelector('[role=dialog] [data-testid=team-add-form]')`)
    await b.evaluate(`(()=>{const f=document.querySelector('[data-testid=team-add-form]');const ins=[...f.querySelectorAll('input')];const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;[${JSON.stringify(name)},${JSON.stringify(email)},${JSON.stringify(tags)}].forEach((v,i)=>{set.call(ins[i],v);ins[i].dispatchEvent(new Event('input',{bubbles:true}))});return true})()`)
    await click('[data-testid=team-add-submit]')
    await expect('modal closes', `!document.querySelector('[role=dialog]')`)
  }

  // ───────────────── Human-led ─────────────────
  await stage('Mid-way')
  await open('/guide/moderator')
  await pickMode('Human moderator')
  await expect('human setup shows', `!!document.querySelector('[data-testid=human-moderators]')`)
  await expect('no Request button anywhere in the moderators section', `![...document.querySelectorAll('[data-testid=human-moderators] button,[data-testid=human-moderators] label')].some(x=>/^Request\\b/.test(x.innerText.trim()))`)
  await expect('empty coverage line', `document.querySelector('[data-testid=coverage-line]')?.innerText.includes('No one counts yet')`)

  // 1. I'll moderate: added at once
  await click('[data-testid=add-myself]')
  await expect('myself added at once', rowHas('Myself', 'Added'))

  // 2. PulseAI roster: Add and Remove only
  await click('[data-testid=open-pulseai]')
  await expect('roster open', `!!document.querySelector('[data-testid=roster]')`)
  await expect('roster has no Request or create/edit', `![...document.querySelectorAll('[data-testid=roster] button')].some(x=>!/^(Add|Remove)$/.test(x.innerText.trim()))`)
  await expect('study-language filter kept', `!!document.querySelector('[data-testid=show-other-languages]')`)
  await click('[aria-label="Add Sam Okafor"]')
  await expect('PulseAI moderator added at once', rowHas('Sam Okafor', 'PulseAI', 'Added'))
  await expect('roster now offers Remove', `!!document.querySelector('[aria-label="Remove Sam Okafor"]')&&!document.querySelector('[aria-label="Add Sam Okafor"]')`)
  out.afterPulse = await b.evaluate(`document.querySelector('[data-testid=coverage-line]')?.innerText.replace(/\\s+/g,' ')`)
  await expect('coverage counted them at once', `/Added moderators have \\d+ hours/.test(document.querySelector('[data-testid=coverage-line]')?.innerText)`)
  await expect('no language column', `![...document.querySelectorAll('[data-testid=moderator-table] th')].some(x=>/Language/.test(x.innerText))`)

  // 3. Someone from my team: the shared list
  await click('[data-testid=open-team]')
  await expect('team list seeded: 4 people (the Moderator view\'s mock team moderator, Ravi Menon, is one of them)', `document.querySelectorAll('[data-testid=team-person]').length===4`)
  await expect('team list has 3 Active and 1 Invited', `document.querySelectorAll('[data-testid=team-person][data-status=Active]').length===3&&document.querySelectorAll('[data-testid=team-person][data-status=Invited]').length===1`)
  await click('[aria-label="Add Dana Whitfield"]')
  await expect('Active team person is added and counts', rowHas('Dana Whitfield', 'My team', 'Added'))

  // Add new: three fields only, no language
  await click('[data-testid=team-add-new]')
  await expect('add-new modal opens', `!!document.querySelector('[role=dialog] [data-testid=team-add-form]')`)
  out.modalLabels = await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].map(l=>l.innerText.trim())`)
  await expect('modal has Name, Email, Expertise tags and no language', `(()=>{const l=[...document.querySelectorAll('[role=dialog] label')].map(x=>x.innerText);return l.length===3&&/Name/.test(l[0])&&/Email/.test(l[1])&&/Expertise tags/.test(l[2])&&!l.some(x=>/language/i.test(x))})()`)
  await click('[aria-label="Close"]')
  await expect('modal closes', `!document.querySelector('[role=dialog]')`)
  await addNew('Priya Menon', 'priya.menon@verdane.com', 'Skincare, Pricing, skincare')
  await expect('new person is Invited on the study', rowHas('Priya Menon', 'Invited', 'Counts once they accept', 'Not counted yet'))
  await expect('company list grew to 4', `document.querySelectorAll('[data-testid=team-person]').length===4`)
  const priya = (await team()).find((p) => p.email === 'priya.menon@verdane.com')
  out.priya = priya
  if (!priya || priya.status !== 'Invited' || priya.createdBy !== 'Maya Ortiz' || priya.tags.join() !== 'Skincare,Pricing') throw new Error('FAILED: new team person stored as Invited with de-duplicated tags')
  out.checks['new person stored as Invited with tags'] = true
  await expect('coverage line mentions invited people not counted', `/1 invited person has not accepted yet and isn.t counted/.test(document.querySelector('[data-testid=coverage-line]')?.innerText)`)
  out.coverageWithInvited = await b.evaluate(`document.querySelector('[data-testid=coverage-line]')?.innerText.replace(/\\s+/g,' ')`)

  // Duplicate email, any case: reuse, never a second person
  const before = (await team()).length
  await addNew('Dana Again', 'DANA.WHITFIELD@Verdane.com', '')
  await expect('duplicate of someone already on the study makes no row', `${rows()}.filter(r=>r.includes('Dana')).length===1`)
  await addNew('Benny', 'BEN.ORTIZ@VERDANE.COM', 'Different tags')
  await expect('duplicate of someone not on the study reuses them', rowHas('Ben Ortiz', 'My team', 'Added'))
  const after = await team()
  if (after.length !== before) throw new Error('FAILED: a duplicate email created a second person')
  if (after.find((p) => p.id === 'tm-ben').name !== 'Ben Ortiz' || after.find((p) => p.id === 'tm-ben').tags.join() !== 'Consumer goods') throw new Error('FAILED: reused person was changed')
  out.checks['duplicate email reuses the person and leaves them as they were'] = true

  // Dev: accept invite. The same person is on Pet Food too, and counts there as well.
  await b.evaluate(`window.scrollTo(0,0); true`)
  await b.shot(`${prefix}-r12-human-1440`, true)
  await mutate(`(s)=>{const g=s.guides['pet-food-churn'];g.moderator.mode='human';g.moderator.agentId=null;g.moderator.style=null;g.moderator.team=[{id:'pf-1',name:'Priya Menon',email:'priya.menon@verdane.com',source:'My team',language:'English (US)',status:'Invited',weeklyHours:6,teamId:${JSON.stringify(priya.id)},by:'Maya Ortiz',sentAt:'2026-11-08T10:00:00-05:00'}];g.moderator.humanIds=[]}`)
  await open('/guide/moderator')
  await expect('this study still lists the team after a reload', rowHas('Priya Menon', 'Invited'))
  await expect('Dev accept button is there in dev', `!!document.querySelector('[data-testid=moderator-row] [data-testid=dev-accept-invite]')`)
  await expect('Dev accept clicked on their row', clickInRow('Priya Menon', '[data-testid=dev-accept-invite]'))
  await expect('accepting makes them Added here', rowHas('Priya Menon', 'Added'))
  await expect('and Active in the company list', `JSON.parse(localStorage.getItem('pulseai-qual:team-moderators')).find(p=>p.email==='priya.menon@verdane.com').status==='Active'`)
  await b.goto('/researcher/studies/pet-food-churn/guide/moderator')
  await expect('the same person counts in the other study', rowHas('Priya Menon', 'Added'), 8000)
  await open('/guide/moderator')

  // Remove
  await expect('back on the first study', rowHas('Sam Okafor', 'Added'))
  await click('[aria-label="Remove Priya Menon"]')
  await expect('removing takes them off the study', `!${rows()}.some(r=>r.includes('Priya Menon'))`)
  await expect('removing leaves them on the company list', `document.querySelectorAll('[data-testid=team-person]').length===4`)
  await click('[aria-label="Remove Sam Okafor"]')
  await expect('removing a PulseAI moderator', `!${rows()}.some(r=>r.includes('Sam Okafor'))`)
  out.rowsAfterRemove = await b.evaluate(rows())
  out.coverageEnd = await b.evaluate(`document.querySelector('[data-testid=coverage-line]')?.innerText.replace(/\\s+/g,' ')`)

  // ───────────────── AI-led standby ─────────────────
  await stage('Mid-way')
  await open('/guide/moderator')
  await pickMode('AI moderator')
  await expect('standby section shows', `!!document.querySelector('[data-testid=standby-moderators]')`)
  out.standbyCards = await b.evaluate(`[...document.querySelectorAll('[data-testid=standby-moderators] section[aria-label="Moderator options"] > div > div')].map(d=>d.innerText.replace(/\\s+/g,' '))`)
  await expect('three options: myself, PulseAI, team', `(()=>{const t=[...document.querySelectorAll('[data-testid=standby-moderators] section[aria-label="Moderator options"] > div > div')].map(d=>d.innerText);return t.length===3&&/standby/i.test(t[0])&&/PulseAI/.test(t[1])&&/my team/i.test(t[2])})()`)
  await click('[data-testid=add-myself]')
  await expect('standby: myself added', standbyHas('Myself', 'Added'))
  // The panel opens by itself when the study already has PulseAI people on standby (the seed does).
  await expect('PulseAI panel is open for the seeded people', `!!document.querySelector('[data-testid=roster]')`)
  await expect('standby: the seeded PulseAI people are Added', standbyHas('Priya Shah', 'PulseAI', 'Added') + '&&' + standbyHas('Jordan Lee', 'PulseAI', 'Added'))
  await click('[aria-label="Add Sam Okafor"]')
  await expect('standby: PulseAI added', standbyHas('Sam Okafor', 'PulseAI', 'Added'))
  await click('[data-testid=open-team]')
  await click('[aria-label="Add Dana Whitfield"]')
  await expect('standby: team person added', standbyHas('Dana Whitfield', 'Added'))
  await addNew('Lena Fischer', 'lena.fischer@verdane.com', 'Concept testing')
  await expect('standby: new person is Invited', standbyHas('Lena Fischer', 'Invited', 'Counts once they accept'))
  out.standbyLine = await b.evaluate(`document.querySelector('[data-testid=standby-line]')?.innerText.replace(/\\s+/g,' ')`)
  await expect('standby line counts only people who count', `/^5 added/.test(document.querySelector('[data-testid=standby-line]')?.innerText)&&/1 invited person has not accepted/.test(document.querySelector('[data-testid=standby-line]')?.innerText)`)
  out.standbyLine = await b.evaluate(`document.querySelector('[data-testid=standby-line]')?.innerText.replace(/\\s+/g,' ')`)
  await b.evaluate(`window.scrollTo(0,0); true`)
  await b.shot(`${prefix}-r12-standby-1440`, true)
  const mod = await state(`(s)=>{const m=s.guides[${JSON.stringify(GUIDE)}].moderator;return {mode:m.mode,standby:(m.standby||[]).length,team:(m.team||[]).length,humanIds:m.humanIds}}`)
  out.aiModerator = mod
  if (mod.mode !== 'ai' || mod.standby !== 6 || mod.team !== 0 || mod.humanIds.length !== 0) throw new Error('FAILED: standby people must stay out of team and humanIds')
  out.checks['standby people stay out of team and humanIds'] = true

  // ───────────────── Versions: adding is a setup edit, accepting is not ─────────────────
  await stage('Ready to launch')
  const invitedNisha = { id: 'v-1', name: 'Nisha Kapoor', email: 'nisha.kapoor@verdane.com', source: 'My team', language: 'English (US)', status: 'Invited', weeklyHours: 6, teamId: 'tm-nisha', by: 'Maya Ortiz', sentAt: '2026-11-08T10:00:00-05:00' }
  await mutate(`(s)=>{const g=s.guides[${JSON.stringify(GUIDE)}];g.moderator.mode='human';g.moderator.agentId=null;g.moderator.style=null;g.moderator.team=[${JSON.stringify(invitedNisha)}];g.moderator.humanIds=[]}`)
  await open('/guide/moderator')
  const v0 = await state(`(s)=>{const g=s.guides[${JSON.stringify(GUIDE)}];return {v:g.version,st:g.status}}`)
  out.v0 = v0
  if (v0.st !== 'Approved') throw new Error('FAILED: the Ready to launch seed should have an approved guide, got ' + v0.st)
  await expect('Nisha is Invited', rowHas('Nisha Kapoor', 'Invited'))
  await expect('Dev accept clicked on their row', clickInRow('Nisha Kapoor', '[data-testid=dev-accept-invite]'))
  await expect('accepting counts them', rowHas('Nisha Kapoor', 'Added'))
  await b.sleep(600)
  const afterAccept = await state(`(s)=>{const g=s.guides[${JSON.stringify(GUIDE)}];return {v:g.version,st:g.status}}`)
  out.afterAccept = afterAccept
  if (afterAccept.v !== v0.v || afterAccept.st !== 'Approved') throw new Error('FAILED: accepting an invitation must not start a new version')
  out.checks['accepting an invitation leaves an approved guide approved, same version'] = true
  // The team list opens by itself when someone from the team is already on the study.
  await expect('team list is open', `!!document.querySelector('[data-testid=team-roster]')`)
  await click('[aria-label="Add Dana Whitfield"]')
  await expect('adding on an approved guide starts a new version', `(()=>{const s=JSON.parse(localStorage.getItem('pulseai-qual:v2'));const g=s.guides[${JSON.stringify(GUIDE)}];return g.version===${v0.v + 1}&&g.status==='Draft'})()`)
  await click('[aria-label="Remove Dana Whitfield"]')
  await expect('removing is a setup edit too (same new Draft)', `(()=>{const s=JSON.parse(localStorage.getItem('pulseai-qual:v2'));const g=s.guides[${JSON.stringify(GUIDE)}];return g.version===${v0.v + 1}&&g.status==='Draft'&&g.moderator.team.length===1})()`)

  // A fresh Ready to launch study (approved guide, seeded team list), for the old-study and Launch checks.
  await stage('Ready to launch')
  // ───────────────── An old saved study still loads ─────────────────
  const old = (id, name, status, extra = {}) => ({ id, name, source: 'PulseAI', language: 'English (US)', status, weeklyHours: 10, by: 'Maya Ortiz', sentAt: '2026-10-30T10:00:00-04:00', ...extra })
  await mutate(`(s)=>{const g=s.guides[${JSON.stringify(GUIDE)}];g.moderator.mode='human';g.moderator.agentId=null;g.moderator.style=null;g.moderator.team=${JSON.stringify([
    old('o1', 'PulseAI moderator 1', 'Requested', { assign: true }),
    old('o2', 'Sam Okafor', 'Declined', { rosterId: 'u-sam' }),
    old('o3', 'Rao', 'Invited', { source: 'My team', email: 'rao@verdane.com', language: 'Hindi', weeklyHours: 1 }),
    old('o4', 'Jordan Lee', 'Accepted', { rosterId: 'u-jordan', weeklyHours: 20 }),
  ])};g.moderator.humanIds=['u-jordan']}`)
  await open('/guide/moderator')
  await expect('old rows load with their old statuses', `${rows()}.length===4&&${rowHas('PulseAI moderator 1', 'Requested')}&&${rowHas('Sam Okafor', 'Declined')}&&${rowHas('Jordan Lee', 'Added')}`)
  await expect('old requests carry the note', `document.querySelectorAll('[data-testid=legacy-note]').length===2&&/From before requests were removed. Remove and add them again./.test(document.querySelector('[data-testid=legacy-note]').innerText)`)
  await expect('an old invitation can still be accepted (dev)', clickInRow('Rao', '[data-testid=dev-accept-invite]'))
  await expect('and then counts', rowHas('Rao', 'Added'))

  // ───────────────── Launch and Fieldwork still read who counts ─────────────────
  const mk = (id, name, status, extra = {}) => ({ id, name, source: 'My team', language: 'English (US)', status, weeklyHours: 6, by: 'Maya Ortiz', sentAt: '2026-10-30T10:00:00-04:00', ...extra })
  const guideMut = (list, ids) => `(s)=>{const g=s.guides[${JSON.stringify(GUIDE)}];g.moderator.mode='human';g.moderator.agentId=null;g.moderator.style=null;g.moderator.team=${JSON.stringify(list)};g.moderator.humanIds=${JSON.stringify(ids)}}`
  await mutate(guideMut([mk('a', 'Nisha Kapoor', 'Accepted', { teamId: 'tm-nisha' })], ['Nisha Kapoor']))
  await open('/launch/readiness')
  out.r15none = await b.evaluate(`[...document.querySelectorAll('[aria-label="Entry contract"] li')].map(l=>l.innerText.replace(/\\s+/g,' ')).filter(t=>/^Moderator/.test(t))`)
  await expect('R15: an Invited team person does not count, whatever the saved status says', `[...document.querySelectorAll('[aria-label="Entry contract"] li')].some(l=>/^Moderator/.test(l.innerText)&&l.innerText.includes('No moderator counts yet'))`)
  await expect('R15: the Moderator row needs attention, so launch is not ready', `(()=>{const li=[...document.querySelectorAll('[aria-label="Entry contract"] li')].find(l=>/^Moderator/.test(l.innerText));return !!li?.querySelector('[aria-label="Needs attention"]')})()`)
  await mutate(guideMut([mk('a', 'Dana Whitfield', 'Invited', { teamId: 'tm-dana', weeklyHours: 2 }), mk('b', 'Nisha Kapoor', 'Invited', { teamId: 'tm-nisha' })], []))
  await open('/launch/readiness')
  await expect('R15: an Active team person counts, whatever the saved status says, and the Invited one only warns', `[...document.querySelectorAll('[aria-label="Entry contract"] li')].some(l=>/^Moderator/.test(l.innerText)&&l.innerText.includes('Human: Dana Whitfield')&&/1 invitation is still pending/.test(l.innerText))`)
  out.r15warn = await b.evaluate(`[...document.querySelectorAll('[aria-label="Entry contract"] li')].map(l=>l.innerText.replace(/\\s+/g,' ')).filter(t=>/^Moderator/.test(t))`)
  await b.shot(`${prefix}-r15-1440`, false)
  // Fieldwork assigns sessions to the people who count now, even when the saved humanIds list is out of date.
  const ids = await b.evaluate(`import('/src/state/guide.ts').then(g=>g.humanIdsOf(JSON.parse(localStorage.getItem('pulseai-qual:v2')).guides[${JSON.stringify(GUIDE)}].moderator))`)
  out.humanIds = ids
  if (JSON.stringify(ids) !== JSON.stringify(['Dana Whitfield'])) throw new Error('FAILED: humanIdsOf must follow the team list: ' + JSON.stringify(ids))
  out.checks['humanIdsOf follows the team list, not the saved humanIds'] = true

  // ───────────────── Standby people off the roster still offer times (mock default window) ─────────────────
  await stage('Ready to launch')
  const me = { id: 'sb-me', name: 'Maya Ortiz', source: 'Myself', language: 'English (US)', status: 'Accepted', weeklyHours: 8, by: 'Maya Ortiz', sentAt: '2026-11-08T10:00:00-05:00' }
  await mutate(`(s)=>{const g=s.guides[${JSON.stringify(GUIDE)}];g.moderator.mode='ai';g.moderator.standby=[${JSON.stringify(me)}]}`)
  await open('/launch/readiness')
  const standbyRow = `[...document.querySelectorAll('[aria-label="Entry contract"] li')].find(l=>/^Human standby/.test(l.innerText))`
  await expect('R15: only the researcher on standby still has open times', `(()=>{const li=${standbyRow};const m=li?.innerText.match(/(\\d+) open times? in the next 7 days/);return !!m&&Number(m[1])>0&&!/No open times/.test(li.innerText)})()`)
  out.r15standby = await b.evaluate(`${standbyRow}?.innerText.replace(/\\s+/g,' ')`)
  await open('/guide/moderator')
  await expect('R12: their availability is shown, labelled as a mock default', `(()=>{const r=[...document.querySelectorAll('[data-testid=standby-row]')].find(r=>r.innerText.includes('Maya Ortiz'));return !!r&&/Mon to Fri, 10:00 to 16:00 ET/.test(r.innerText)&&/Mock default/.test(r.querySelector('[data-testid=availability-mock]')?.innerText||'')})()`)
  const teamMe = { id: 'sb-t', name: 'Dana Whitfield', email: 'dana.whitfield@verdane.com', source: 'My team', language: 'English (US)', status: 'Invited', weeklyHours: 6, teamId: 'tm-dana', by: 'Maya Ortiz', sentAt: '2026-11-08T10:00:00-05:00' }
  await mutate(`(s)=>{const g=s.guides[${JSON.stringify(GUIDE)}];g.moderator.standby=[${JSON.stringify(teamMe)}]}`)
  await open('/launch/readiness')
  await expect('R15: a team person (Active in the list) alone on standby has open times', `(()=>{const li=${standbyRow};const m=li?.innerText.match(/Dana Whitfield on standby, (\\d+) open times?/);return !!m&&Number(m[1])>0})()`)
  const slots = await b.evaluate(`import('/src/state/standby.ts').then(m=>m.openSlots([{id:'Maya Ortiz',name:'Maya Ortiz'}],new Date().toISOString()).map(x=>x.start))`)
  out.defaultSlotCount = slots.length
  const offHours = await b.evaluate(`import('/src/state/standby.ts').then(m=>m.openSlots([{id:'Maya Ortiz',name:'Maya Ortiz'}],new Date().toISOString()).filter(x=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'numeric',minute:'numeric',hourCycle:'h23'}).formatToParts(new Date(x.start));const g=t=>p.find(y=>y.type===t).value;const h=Number(g('hour'))*60+Number(g('minute'));return ['Sat','Sun'].includes(g('weekday'))||h<600||h+45>960}).length)`)
  if (offHours !== 0 || slots.length === 0) throw new Error('FAILED: default slots must be Monday to Friday, 10:00 to 16:00 ET')
  out.checks['default slots are Mon to Fri, 10:00 to 16:00 ET'] = true
  out.inv = await b.evaluate(`window.__invariants`)
}
