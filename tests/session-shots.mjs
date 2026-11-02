// Session page (R19) screenshots at 1440 and 1024: node tests/session-shots.mjs <prefix> <session id>...
import { launch } from './cdp.mjs'
const b = await launch()
const root = '/researcher/studies/moisturizer-concept/fieldwork'
const [prefix, ...ids] = process.argv.slice(2)
const out = {}
try {
  await b.goto('/researcher'); await b.evaluate('localStorage.clear(); sessionStorage.clear(); true'); await b.goto('/researcher'); await b.waitFor('Screen jump')
  await b.evaluate(`__click('Screen jump')`); await b.sleep(300)
  await b.evaluate(`[...document.querySelectorAll('[role=dialog] label')].find(l=>l.textContent.startsWith('Live in fieldwork')).click(); true`); await b.sleep(500)
  await b.evaluate(`__click('Close screen jump')`).catch(() => {})
  for (const id of ids) {
    for (const w of [1440, 1024]) {
      await b.viewport(w, 1000); await b.goto(`${root}/command-center?tab=sessions`); await b.sleep(500)
      await b.goto(`${root}/sessions/${id}`); await b.sleep(1200)
      const text = await b.evaluate(`document.body.innerText`)
      out[`${id}-${w}`] = { overflow: await b.evaluate(`[document.documentElement.scrollWidth, innerWidth]`), dev: /Dev: simulate/.test(text), consented: /\nConsented\n/.test(text), consentRecord: /Consent record/.test(text) }
      await b.shot(`${prefix}-${id}-${w}`, true)
    }
  }
  console.log(JSON.stringify(out, null, 1))
} finally { b.close() }
