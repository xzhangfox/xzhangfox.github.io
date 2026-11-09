// Browser coverage for the frosted name aperture. Serve out/ at PORTFOLIO_TEST_URL.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
const { chromium }=await import(process.env.FLUX_PLAYWRIGHT_MODULE?pathToFileURL(process.env.FLUX_PLAYWRIGHT_MODULE).href:'playwright')
const browser=await chromium.launch({headless:true,executablePath:process.env.FLUX_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'})
const base=process.env.PORTFOLIO_TEST_URL||'http://127.0.0.1:4240'
fs.mkdirSync('artifacts',{recursive:true})
const context=await browser.newContext({viewport:{width:1440,height:960},timezoneId:'America/Los_Angeles'})
await context.addInitScript(()=>{
  localStorage.setItem('portfolio-language','en');localStorage.setItem('portfolio-scene-motion','reduced')
  const D=Date,epoch=Date.parse('2026-11-09T20:00:00Z');window.Date=class extends D{constructor(...a){super(...(a.length?a:[epoch+performance.now()]))}static now(){return epoch+performance.now()}}
})
const page=await context.newPage(),errors=[],requests=[]
page.on('pageerror',e=>errors.push(e.message))
page.on('console',m=>{if(m.type()==='error'&&/shader|THREE|hydrat|match/i.test(m.text()))errors.push(m.text())})
page.on('request',r=>requests.push(r.url()))
const canvas=page.locator('.hero-atmosphere-canvas')
const open=async()=>{if(await page.locator('.scene-trigger').getAttribute('aria-expanded')!=='true')await page.locator('.scene-trigger').click()}
const close=async()=>{await page.keyboard.press('Escape');await page.evaluate(()=>document.activeElement?.blur());await page.waitForTimeout(550)}
const phase=async name=>{await open();await page.getByRole('button',{name,exact:true}).click();await close()}
const weather=async value=>{await open();await page.getByRole('combobox',{name:'Weather',exact:true}).selectOption(value);await close()}
const snap=async name=>{await page.screenshot({path:`artifacts/glass-${name}.png`})}
async function apertureAlignment(){
  const png=(await page.screenshot()).toString('base64')
  return await page.evaluate(async data=>{
     const image=new Image();image.src='data:image/png;base64,'+data;await image.decode()
     const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0)
     const pixels=ctx.getImageData(0,0,c.width,c.height).data,rects=[...document.querySelectorAll('[data-sky-word]')].map(e=>e.getBoundingClientRect())
     let inside=0,outside=0
     for(let y=70;y<c.height-80;y++)for(let x=0;x<c.width;x++){
       const i=(y*c.width+x)*4;if(pixels[i+2]-pixels[i]<55)continue
       if(rects.some(r=>x>=r.left-12&&x<=r.right+12&&y>=r.top-12&&y<=r.bottom+12))inside++;else outside++
     }
     return {inside,outside}
   },png)
}
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.hero-atmosphere-canvas[data-ready=true][data-clouds=ready]').waitFor({timeout:45000});await page.waitForTimeout(1200)
 assert.equal(await page.getByRole('heading',{level:1,name:'Xi Zhang',exact:true}).count(),1)
 assert.equal(await page.locator('.hero-atmosphere video').count(),0)
 await weather('clear')
 for(const [name,id]of [['Before dawn','predawn'],['Morning','morning'],['Day','day'],['Dusk','dusk'],['Night','night'],['Deep night','deep']]){
   await phase(name);assert.equal(await canvas.getAttribute('data-phase'),id);await snap(id)
   if(id==='predawn')assert.equal(await page.locator('html').getAttribute('data-sky-dark'),'false','gray dawn glass uses dark text')
 }
 assert.ok(!requests.some(u=>/valley-|hero-bg|robot-cat|night-sky/.test(u)),'old scene assets are not loaded')
 console.log('PASS: six palettes, accessible name, old scenery removed, no shader or hydration errors')
 await phase('Day')
 for(const viewport of [{width:390,height:844},{width:320,height:640},{width:1440,height:960}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(700)
   const alignment=await apertureAlignment()
   assert.ok(alignment.inside>200,'clear blue sky is visible inside the heading')
   assert.ok(alignment.outside<alignment.inside*.025,'aperture follows the heading after GPU texture resize: '+JSON.stringify(alignment))
   if(viewport.width===390){
     await snap('phone-clear');await page.getByRole('button',{name:'Switch language',exact:true}).click();await page.waitForTimeout(500)
     const translated=await apertureAlignment();assert.ok(translated.outside<translated.inside*.025,'aperture follows Chinese content reflow')
     await page.getByRole('button',{name:'Switch language',exact:true}).click();await page.waitForTimeout(300)
   }
 }
 await page.evaluate(()=>window.scrollTo({top:120,behavior:'instant'}));await page.waitForTimeout(400)
 const scrolled=await apertureAlignment();assert.ok(scrolled.outside<scrolled.inside*.025,'aperture scrolls with its heading')
 await snap('scroll-position');await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(300)
 console.log('PASS: rendered letter apertures remain aligned across desktop/phone texture resizes')
 await open();await page.getByRole('checkbox',{name:'Reduce motion',exact:true}).uncheck();await close()
 const start=+(await canvas.getAttribute('data-render-time'));await snap('cloud-motion-before');await page.waitForTimeout(4500);await snap('cloud-motion-after')
 assert.ok(+(await canvas.getAttribute('data-render-time'))>start+1,'cloud clock advances')
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))})
 const hiddenTime=await canvas.getAttribute('data-render-time');await page.waitForTimeout(300);assert.equal(await canvas.getAttribute('data-render-time'),hiddenTime)
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))})
 await phase('Morning');await weather('mist');assert.ok(+(await canvas.getAttribute('data-fog'))>.5);assert.ok(+(await canvas.getAttribute('data-drops'))>5)
 await page.waitForTimeout(3000);await snap('dew')
 await phase('Day');await weather('storm');const slides=+(await canvas.getAttribute('data-slides'))
 await page.waitForTimeout(9000);assert.ok(+(await canvas.getAttribute('data-slides'))>slides,'gravity moves large drops')
 assert.ok(+(await canvas.getAttribute('data-wetness'))>.1);await snap('rain')
 const wet=+(await canvas.getAttribute('data-wetness')),drops=+(await canvas.getAttribute('data-drops'))
 await weather('clear');assert.ok(+(await canvas.getAttribute('data-wetness'))>wet*.85,'glass does not instantly dry');assert.ok(+(await canvas.getAttribute('data-drops'))>drops*.5,'beads remain after rain');await snap('after-rain')
 await open();await page.getByRole('checkbox',{name:'Reduce motion',exact:true}).check();await close()
 const stopped=await canvas.getAttribute('data-render-time');await page.waitForTimeout(600);assert.equal(await canvas.getAttribute('data-render-time'),stopped)
 await phase('Dusk');assert.equal(await canvas.getAttribute('data-phase'),'dusk')
 console.log('PASS: cloud movement, condensation, gravity, lingering droplets and reduced-motion repaint')
 await page.getByRole('button',{name:'Switch language',exact:true}).click();await open();await page.getByRole('button',{name:'清晨',exact:true}).click();await page.getByRole('combobox',{name:'天气',exact:true}).selectOption('mist');await close()
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(900);await snap('phone-dew')
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'phone has no horizontal overflow')
 assert.ok(await page.locator('.sky-actions').evaluate(e=>e.getBoundingClientRect().bottom<innerHeight-70),'phone actions clear weather control')
 await open();await page.getByRole('button',{name:'白天',exact:true}).click();await page.getByRole('combobox',{name:'天气',exact:true}).selectOption('storm');await close();await snap('phone-rain')
 await page.setViewportSize({width:320,height:640});await page.waitForTimeout(600);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await snap('small-phone')
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(600);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await snap('landscape')
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500)
 await open();await page.getByRole('button',{name:'恢复当地时间与自然天气',exact:true}).click();assert.match(await page.locator('.scene-trigger').innerText(),/当地时间/);await close()
 const beforeExit=await apertureAlignment()
 await page.getByRole('button',{name:'查看项目',exact:true}).click();await page.waitForTimeout(1500)
 assert.equal(await canvas.getAttribute('data-paused'),'true');assert.equal(await page.locator('.scene-trigger').isVisible(),false)
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(600)
 assert.equal(await page.locator('.scene-trigger').isVisible(),true)
 // Refractive water can legitimately reveal blue sky outside the letters. Compare the same wet scene.
 const returned=await apertureAlignment()
 assert.ok(returned.outside<beforeExit.outside+returned.inside*.025&&returned.inside>beforeExit.inside*.95,'static aperture refreshes when returning home: '+JSON.stringify({beforeExit,returned}))
 console.log('PASS: Chinese controls, 320/390 px phones, landscape, real CTA, local time and offscreen pause')
 const recoveryContext=await browser.newContext({viewport:{width:640,height:760}})
 await recoveryContext.addInitScript(()=>{localStorage.setItem('portfolio-language','en');localStorage.setItem('portfolio-scene-motion','reduced')})
 const rp=await recoveryContext.newPage();rp.on('pageerror',e=>errors.push(e.message));await rp.goto(base);await rp.locator('.hero-atmosphere-canvas[data-ready=true]').waitFor()
 await rp.locator('.scene-trigger').click();await rp.getByRole('button',{name:'Day',exact:true}).click();await rp.getByRole('combobox').selectOption('clear')
 // Overlapping rain hits provide a deterministic collision check, without a production-only test hook.
 await rp.evaluate(()=>{window.savedRandom=Math.random;Math.random=()=>.9})
 await rp.getByRole('combobox').selectOption('storm');await rp.getByRole('checkbox',{name:'Reduce motion',exact:true}).uncheck();await rp.waitForTimeout(600)
 await rp.evaluate(()=>{Math.random=window.savedRandom});assert.ok(+(await rp.locator('.hero-atmosphere-canvas').getAttribute('data-merges'))>5,'nearby water beads coalesce')
 await rp.locator('.hero-atmosphere-canvas').evaluate(c=>{window.contextLoss=c.getContext('webgl2').getExtension('WEBGL_lose_context');window.contextLoss.loseContext()})
 await rp.locator('.hero-atmosphere-canvas[data-renderer=fallback]').waitFor();await rp.waitForTimeout(1100);await rp.evaluate(()=>window.contextLoss.restoreContext())
 await rp.locator('.hero-atmosphere-canvas[data-renderer=webgl]').waitFor({timeout:20000});await recoveryContext.close()
 console.log('PASS: deterministic drop merging, hidden-tab pause and GPU context restoration')
 // Simulate unavailable WebGL while retaining Canvas 2D.
 const fallbackContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
 await fallbackContext.addInitScript(()=>{localStorage.setItem('portfolio-language','en');const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(/webgl|experimental-webgl/.test(type))return null;return get.call(this,type,...args)}})
 const fp=await fallbackContext.newPage();fp.on('pageerror',e=>errors.push(e.message));await fp.goto(base);await fp.locator('.hero-atmosphere-canvas[data-ready=true][data-renderer=canvas]').waitFor()
 await fp.waitForTimeout(800);await fp.screenshot({path:'artifacts/glass-canvas-fallback.png'});await fallbackContext.close()
 const blockedContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
 await blockedContext.route('**/scene/glass-clouds-v1.webp',route=>route.abort())
 const bp=await blockedContext.newPage();bp.on('pageerror',e=>errors.push(e.message));await bp.goto(base);await bp.locator('.hero-atmosphere-canvas[data-ready=true][data-clouds=fallback]').waitFor();await blockedContext.close()
 assert.deepEqual(errors,[])
 fs.writeFileSync('artifacts/glass-browser-result.json',JSON.stringify({passed:true,errors,legacyAssetsLoaded:requests.filter(u=>/valley-|hero-bg|robot-cat/.test(u))},null,2))
 console.log('PASS: Canvas fallback, failed cloud-image fallback, no application errors')
}finally{await browser.close()}
