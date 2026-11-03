const setIn = (sel, v) => `(()=>{const i=document.querySelector(${JSON.stringify(sel)});const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,${JSON.stringify(v)});i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`
export default async ({ b, out, stage, mutate, open, text, prefix }) => {
  await stage('Mid-way')
  await open('/guide/moderator')
  await b.evaluate(`__click('Human moderator','label')`); await b.sleep(400)
  const modal = await b.evaluate(`!!document.querySelector('[role=dialog]')`)
  if (modal) { await b.evaluate(`[...document.querySelectorAll('[role=dialog] button')].find(x=>/Switch|Replace|Confirm|Continue/.test(x.innerText))?.click(); true`); await b.sleep(500) }
  out.cards = await b.evaluate(`[...document.querySelectorAll('[data-testid=human-moderators] section[aria-label="Moderator options"] > div > div')].map(d=>d.innerText.replace(/\\s+/g,' '))`)
  out.emptyCoverage = await b.evaluate(`document.querySelector('[data-testid=coverage-line]')?.innerText.replace(/\\s+/g,' ')`)
  // myself
  await b.evaluate(`document.querySelector('[data-testid=add-myself]').click(); true`); await b.sleep(400)
  // PulseAI assign 2
  await b.evaluate(`document.querySelector('[data-testid=open-pulseai]').click(); true`); await b.sleep(300)
  await b.evaluate(setIn('[data-testid=pulseai-panel] input[type=number]', '2')); await b.sleep(200)
  await b.evaluate(`document.querySelector('[data-testid=request-pulseai]').click(); true`); await b.sleep(400)
  // choose specific: Sam
  await b.evaluate(`[...document.querySelectorAll('[role=radio]')].find(x=>x.innerText.startsWith('Choose specific')).click(); true`); await b.sleep(300)
  await b.evaluate(`document.querySelector('[aria-label="Request Sam Okafor"]').click(); true`); await b.sleep(400)
  // team: two people
  await b.evaluate(`document.querySelector('[data-testid=open-team]').click(); true`); await b.sleep(300)
  await b.evaluate(setIn('[aria-label="Name 1"]', 'Dana Whitfield')); await b.evaluate(setIn('[aria-label="Email 1"]', 'dana@verdane.com'))
  await b.evaluate(`document.querySelector('[data-testid=add-another]').click(); true`); await b.sleep(300)
  await b.evaluate(setIn('[aria-label="Name 2"]', 'Ben Ortiz')); await b.evaluate(setIn('[aria-label="Email 2"]', 'ben@verdane.com')); await b.sleep(200)
  await b.evaluate(`document.querySelector('[data-testid=send-invites]').click(); true`); await b.sleep(500)
  out.rows = await b.evaluate(`[...document.querySelectorAll('[data-testid=moderator-row]')].map(r=>r.innerText.replace(/\\s+/g,' '))`)
  out.coverage = await b.evaluate(`document.querySelector('[data-testid=coverage-line]')?.innerText.replace(/\\s+/g,' ')`)
  out.guideVersionBanner = await b.evaluate(`document.body.innerText.match(/Version \\d+[^\\n]*/)?.[0]`)
  await b.evaluate(`window.scrollTo(0,0); true`)
  await b.shot(`${prefix}-r12-1440`, true)
  // dev controls
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  out.devButtons = await b.evaluate(`[...document.querySelectorAll('[role=dialog] button')].map(x=>x.innerText).filter(t=>/Accept|Decline|confirms/.test(t))`)
  await b.evaluate(`document.querySelector('[data-testid=sim-pulseai-confirms]').click(); true`); await b.sleep(300)
  await b.evaluate(`document.querySelectorAll('[data-testid=sim-accept]')[0].click(); true`); await b.sleep(300)
  await b.evaluate(`document.querySelectorAll('[data-testid=sim-decline]')[0].click(); true`); await b.sleep(300)
  await b.evaluate(`document.querySelector('[aria-label="Close screen jump"]')?.click(); true`); await b.sleep(300)
  out.rowsAfter = await b.evaluate(`[...document.querySelectorAll('[data-testid=moderator-row]')].map(r=>r.innerText.replace(/\\s+/g,' ').slice(0,110))`)
  out.coverageAfter = await b.evaluate(`document.querySelector('[data-testid=coverage-line]')?.innerText.replace(/\\s+/g,' ')`)
  out.mismatch = await b.evaluate(`document.querySelectorAll('[data-testid=language-warning]').length`)
  // R15 with no accepted, then with one accepted + pending
  await stage('Ready to launch')
  const guideMut = (team) => `(s)=>{const g=s.guides['moisturizer-concept'];g.moderator.mode='human';g.moderator.agentId=null;g.moderator.style=null;g.moderator.team=${JSON.stringify(team)};g.moderator.humanIds=g.moderator.team.filter(t=>t.status==='Accepted').map(t=>t.rosterId||t.name)}`
  const mk = (id, name, status, extra = {}) => ({ id, name, source: 'My team', language: 'English (US)', status, weeklyHours: 6, by: 'Maya Ortiz', sentAt: '2026-10-30T10:00:00-04:00', ...extra })
  await mutate(guideMut([mk('a', 'Dana Whitfield', 'Invited')]))
  await open('/launch/readiness')
  out.r15none = await b.evaluate(`[...document.querySelectorAll('[aria-label="Entry contract"] li')].map(l=>l.innerText.replace(/\\s+/g,' ')).filter(t=>/^Moderator/.test(t))`)
  out.continueNone = await b.evaluate(`[...document.querySelectorAll('button,a')].find(x=>x.innerText.startsWith('Continue to authorize'))?.disabled`)
  await mutate(guideMut([mk('a', 'Dana Whitfield', 'Accepted', { weeklyHours: 2 }), mk('b', 'Ben Ortiz', 'Invited'), mk('c', 'Rao', 'Accepted', { language: 'Hindi', weeklyHours: 1 })]))
  await open('/launch/readiness')
  out.r15warn = await b.evaluate(`[...document.querySelectorAll('[aria-label="Entry contract"] li')].map(l=>l.innerText.replace(/\\s+/g,' ')).filter(t=>/^Moderator/.test(t))`)
  await b.shot(`${prefix}-r15-1440`, false)
  out.inv = await b.evaluate(`window.__invariants`)
}
