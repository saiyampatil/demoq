// Minimal Chrome DevTools Protocol driver (rebuilt). Every call is bounded.
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
const SP = process.env.SP ?? new URL('./.out', import.meta.url).pathname
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export const BASE = 'http://localhost:5199'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export async function launch() {
  mkdirSync(SP, { recursive: true })
  rmSync(`${SP}/profile`, { recursive: true, force: true })
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=9333', `--user-data-dir=${SP}/profile`, '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' })
  let list
  for (let i = 0; i < 60; i++) { try { list = await (await fetch('http://localhost:9333/json/list')).json(); if (list.find((t) => t.type === 'page')) break } catch {} await sleep(200) }
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r))
  let id = 0; const pending = new Map()
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}, ms = 20000) => new Promise((res, rej) => { const i = ++id; const t = setTimeout(() => { pending.delete(i); rej(new Error('CDP timeout ' + method)) }, ms); pending.set(i, (m) => { clearTimeout(t); res(m) }); ws.send(JSON.stringify({ id: i, method, params })) })
  await send('Page.enable'); await send('Runtime.enable')
  const viewport = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 })
  await viewport(1440, 1000)
  const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'eval error'); return r.result?.result?.value }
  const helpers = `window.__q=(sel,text)=>[...document.querySelectorAll(sel)].find(e=>e.innerText?.trim().replace(/\\s+/g,' ').startsWith(text)); window.__click=(text,sel='button,a,[role=tab],label')=>{const e=__q(sel,text); if(!e) throw new Error('no element: '+text); e.click(); return true}; true`
  const poll = async (expr, ms = 10000) => { const end = Date.now() + ms; while (Date.now() < end) { try { const v = await evaluate(expr); if (v) return v } catch {} await sleep(150) } return false }
  const goto = async (path) => { await send('Page.navigate', { url: BASE + path }); await sleep(300); await poll(`document.readyState==='complete'`); await evaluate(helpers) }
  const waitFor = async (text, ms = 15000) => { const ok = await poll(`document.body.innerText.includes(${JSON.stringify(text)})`, ms); if (!ok) throw new Error('Timed out waiting for: ' + text); await evaluate(helpers) }
  const shot = async (name, full = false) => {
    let clip
    if (full) { const m = await send('Page.getLayoutMetrics'); const c = m.result.cssContentSize; clip = { x: 0, y: 0, width: c.width, height: Math.min(c.height, 6000), scale: 1 } }
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(clip ? { clip } : {}) }, 45000)
    writeFileSync(`${SP}/${name}.png`, Buffer.from(r.result.data, 'base64'))
  }
  const close = () => { try { ws.close() } catch {} proc.kill() }
  return { viewport, evaluate, poll, goto, shot, waitFor, sleep, close, refreshHelpers: () => evaluate(helpers) }
}
