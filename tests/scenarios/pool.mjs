const clearPending = `(s)=>{const a=s.audiences['moisturizer-concept'];a.screening={log:['A-1008','A-1017','A-1019','A-1027'].map((id,i)=>({id:'sl-'+i,applicantId:id,at:'2026-10-30T10:00:00-04:00',by:'Maya Ortiz',kind:'outcome',from:'Pending review',to:'Ineligible',reason:'Dev: cleared for the probe'}))}}`
export default async ({ b, out, stage, mutate, open, text, prefix }) => {
  await stage('Mid-way')
  await open('/audience/pool')
  out.pending = await b.evaluate(`document.querySelector('[data-testid=pending-note]')?.innerText`)
  out.finalizeDisabled = await b.evaluate(`[...document.querySelectorAll('button')].find(x=>x.innerText==='Finalize pool')?.disabled`)
  await mutate(clearPending)
  await open('/audience/pool')
  out.figures = await b.evaluate(`['pool','reserve'].map(k=>document.querySelector('[data-testid=pool-figure-'+k+']').innerText.replace(/\\s+/g,' '))`)
  out.panel = await b.evaluate(`document.querySelector('[data-testid=short-panel]')?.innerText.replace(/\\s+/g,' ')`)
  out.rowsPool = await b.evaluate(`[...document.querySelectorAll('[data-testid=list-pool] tbody tr')].slice(0,3).map(r=>r.innerText.replace(/\\s+/g,' '))`)
  await b.shot(`${prefix}-r11-1440`, true)
  // source more -> R8 top-up
  await b.evaluate(`document.querySelector('[data-testid=source-more]').click(); true`); await b.sleep(900)
  out.r8 = await b.evaluate(`location.pathname+location.search`)
  out.r8card = await b.evaluate(`document.querySelector('[data-testid=source-more-card]')?.innerText.replace(/\\s+/g,' ')`)
  await b.evaluate(`document.querySelector('[data-testid=add-more]').click(); true`); await b.sleep(500)
  await b.evaluate(`[...document.querySelectorAll('button')].find(x=>x.innerText.startsWith('Send screener invites')).click(); true`); await b.sleep(900)
  out.afterSend = await b.evaluate(`location.pathname+location.search`)
  // return redirect with nobody pending
  await mutate(`(s)=>{const a=s.audiences['moisturizer-concept'];const ids=['A-1008','A-1017','A-1019','A-1027'];}`)
  // lower target to exercise moves
  await mutate(`(s)=>{const a=s.audiences['moisturizer-concept'];a.def.total=5;a.confirmed.def.total=5;a.sourcing.candidates=a.sourcing.candidates.slice(0,28)}`)
  await open('/audience/screening?return=pool')
  await b.sleep(600)
  out.redirected = await b.evaluate(`location.pathname`)
  out.fig2 = await b.evaluate(`['pool','reserve'].map(k=>document.querySelector('[data-testid=pool-figure-'+k+']').innerText.replace(/\\s+/g,' '))`)
  const ids = (k) => b.evaluate(`[...document.querySelectorAll('[data-testid=list-${k}] tbody tr')].map(r=>r.children[0].innerText)`)
  out.before = { pool: await ids('pool'), reserve: await ids('reserve') }
  // move the first pool person to reserve: first reserve person steps in
  await b.evaluate(`document.querySelector('[data-testid=list-pool] tbody tr button').click(); true`); await b.sleep(400)
  out.afterOut = { pool: await ids('pool'), reserve: await ids('reserve') }
  // move the last reserve person into the full pool: last screened in pool steps out
  await b.evaluate(`[...document.querySelectorAll('[data-testid=list-reserve] tbody tr')].pop().querySelector('button').click(); true`); await b.sleep(400)
  out.afterIn = { pool: await ids('pool'), reserve: await ids('reserve') }
  // finalize full pool
  await b.evaluate(`document.querySelector('[data-testid=finalize-pool]').click(); true`); await b.sleep(500)
  out.finalized = (await text()).includes('Pool finalized by')
  await stage('Ready to launch')
  await open('/launch/readiness')
  out.r15seed = await b.evaluate(`[...document.querySelectorAll('[aria-label="Entry contract"] li')].map(l=>l.innerText.replace(/\\s+/g,' ')).filter(t=>/pool/i.test(t))`)
  out.r15mark = await b.evaluate(`[...document.querySelectorAll('[aria-label="Entry contract"] li')].find(l=>/pool/i.test(l.innerText)).querySelector('[role=img]').getAttribute('aria-label')`)
  await b.shot(`${prefix}-r15-1440`, false)
  // reopen and finalize short with a reason
  await mutate(clearPending)
  await open('/audience/pool')
  out.reopenVisible = (await text()).includes('Reopen pool')
  await b.evaluate(`[...document.querySelectorAll('button')].find(x=>x.innerText==='Reopen pool').click(); true`); await b.sleep(400)
  await b.evaluate(`document.querySelector('[data-testid=finalize-pool]').click(); true`); await b.sleep(400)
  out.confirmDisabled = await b.evaluate(`document.querySelector('[data-testid=confirm-finalize]').disabled`)
  await b.evaluate(`(()=>{const ta=document.querySelector('[role=dialog] textarea');const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(ta,'Launch with 8 of 24');ta.dispatchEvent(new Event('input',{bubbles:true}));return true})()`); await b.sleep(200)
  await b.evaluate(`document.querySelector('[data-testid=confirm-finalize]').click(); true`); await b.sleep(500)
  out.banner = await b.evaluate(`document.body.innerText.match(/Pool finalized by[^\\n]*\\n[^\\n]*\\n[^\\n]*/)?.[0]`)
  out.inv = await b.evaluate(`window.__invariants`)
}
