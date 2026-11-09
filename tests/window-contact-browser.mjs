import assert from 'node:assert/strict'
import fs from 'node:fs'
import {pathToFileURL} from 'node:url'
const {chromium}=await import(process.env.FLUX_PLAYWRIGHT_MODULE?pathToFileURL(process.env.FLUX_PLAYWRIGHT_MODULE).href:'file:///C:/Project/Self-development/.browser-tools/node_modules/playwright/index.mjs')
const browser=await chromium.launch({headless:true,executablePath:process.env.FLUX_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'})
const context=await browser.newContext({viewport:{width:1440,height:960},timezoneId:'America/Los_Angeles'})
await context.addInitScript(()=>{
 localStorage.setItem('portfolio-language','en');localStorage.setItem('portfolio-scene-motion','reduced')
 const D=Date,epoch=Date.parse('2026-11-09T20:00:00Z');window.Date=class extends D{constructor(...a){super(...(a.length?a:[epoch]))}static now(){return epoch}}
 window.createdCanvases=[];const original=document.createElement.bind(document)
 document.createElement=function(tag,...args){const el=original(tag,...args);if(tag==='canvas')window.createdCanvases.push(el);return el}
})
const page=await context.newPage(),errors=[]
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|shader/.test(m.text()))errors.push(m.text())})
fs.mkdirSync('artifacts',{recursive:true})
try{
 await page.goto(process.env.PORTFOLIO_TEST_URL||'http://127.0.0.1:4240/');await page.locator('.hero-atmosphere-canvas[data-ready=true][data-clouds=ready]').waitFor();await page.waitForTimeout(900)
 await page.locator('.scene-trigger').click();await page.getByRole('button',{name:'Day',exact:true}).click();await page.getByRole('combobox').selectOption('clear')
 // Read the real raster mask. Find a long continuous aperture (the I), rather than inventing a rectangle.
 const target=await page.evaluate(()=>{
  const mask=window.createdCanvases[0],ctx=mask.getContext('2d'),data=ctx.getImageData(0,0,mask.width,mask.height).data
  const rect=document.querySelector('[data-sky-word]').getBoundingClientRect(),ratio=mask.width/innerWidth
  let best={length:0,x:0,top:0,bottom:0};const runs=[]
  for(let x=Math.ceil((rect.left+20)*ratio);x<Math.floor(rect.right*ratio);x++){
   let begin=-1
   for(let y=Math.floor(rect.top*ratio);y<=Math.ceil(rect.bottom*ratio);y++){
    const filled=y<mask.height&&data[(y*mask.width+x)*4+3]>245
    if(filled&&begin<0)begin=y
    if(!filled&&begin>=0){const run={length:y-begin,x:x/ratio,top:begin/ratio,bottom:y/ratio};runs.push(run);if(run.length>best.length)best=run;begin=-1}
   }
  }
  const core=runs.filter(r=>r.length>=best.length-1&&Math.abs(r.x-best.x)<35)
  return core[Math.floor(core.length/2)]||best
 })
 assert.ok(target.length>100,'test uses a real, tall opening')
 await page.evaluate(({x,top})=>{
  const canvas=document.querySelector('.hero-atmosphere-canvas'),chunks=[]
  if(canvas.captureStream&&window.MediaRecorder){const type=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';window.recorder=new MediaRecorder(canvas.captureStream(24),{mimeType:type,videoBitsPerSecond:1800000});window.recorder.ondataavailable=e=>chunks.push(e.data);window.videoDone=new Promise(resolve=>window.recorder.onstop=async()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}))});window.recorder.start()}
  window.nativeRandom=Math.random;let call=0
  Math.random=()=>{const bead=Math.floor(call/3),part=call++%3;if(part===0)return bead===0?.96:.12;if(part===1)return bead===0?x/innerWidth:.96;return bead===0?(top-27)/innerHeight:.88}
 },target)
 await page.getByRole('combobox').selectOption('storm');await page.getByRole('checkbox',{name:'Reduce motion',exact:true}).uncheck();await page.keyboard.press('Escape');await page.evaluate(()=>document.activeElement?.blur())
 const clip={x:Math.floor(target.x-46),y:Math.floor(target.top-42),width:94,height:Math.ceil(target.bottom-target.top+105)}
 const seen=[]
 for(const [stage,condition]of [
  ['rim',()=>+document.querySelector('.hero-atmosphere-canvas').dataset.rimContacts>0&&+document.querySelector('.hero-atmosphere-canvas').dataset.rimDrops>0],
  ['air',()=>+document.querySelector('.hero-atmosphere-canvas').dataset.cavityDrops>0],
  ['sill',()=>+document.querySelector('.hero-atmosphere-canvas').dataset.landings>0],
  ['fall',()=>+document.querySelector('.hero-atmosphere-canvas').dataset.detached>=2]
 ]){
  await page.waitForFunction(condition,{},{timeout:20000});await page.screenshot({path:`artifacts/window-contact-${stage}.png`,clip});seen.push(stage)
 }
 await page.screenshot({path:'artifacts/window-v2-rain.png'})
 await page.evaluate(()=>{Math.random=window.nativeRandom})
 const metrics=await page.locator('.hero-atmosphere-canvas').evaluate(c=>({...c.dataset}));assert.ok(+metrics.rimContacts>0);assert.ok(+metrics.landings>0);assert.ok(+metrics.detached>=2)
 await page.waitForTimeout(1500)
 const video=await page.evaluate(async()=>{if(!window.recorder)return null;window.recorder.stop();return await window.videoDone});if(video)fs.writeFileSync('artifacts/window-contact.webm',Buffer.from(video,'base64'))
 fs.writeFileSync('artifacts/window-contact-result.json',JSON.stringify({passed:true,target,seen,metrics,errors},null,2));assert.deepEqual(errors,[])
 console.log('PASS: real distorted letter -> pinned rim -> cavity drop -> lower sill -> free fall',JSON.stringify(metrics))
}finally{await browser.close()}
