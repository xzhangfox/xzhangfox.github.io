// Visible regression checks for sunset, the separate tail appendage, and isolated device blinking.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.env.FLUX_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.FLUX_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({headless:true,executablePath:process.env.FLUX_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'})
const base=process.env.PORTFOLIO_TEST_URL || 'http://127.0.0.1:4177', errors=[]
fs.mkdirSync('artifacts',{recursive:true})
function change(a,b){let sum=0,n=0;for(let i=0;i<a.length;i++)if(i%4!==3){sum+=Math.abs(a[i]-b[i]);n++}return sum/n}
async function sample(page){return page.locator('.hero-atmosphere-canvas').evaluate(canvas=>{
 const mobile=innerWidth<700,rw=mobile?720:1280,rh=mobile?1280:720,a=+canvas.dataset.cameraScale,tx=+canvas.dataset.cameraX,ty=+canvas.dataset.cameraY
 const c=document.createElement('canvas');c.width=rw;c.height=rh;const ctx=c.getContext('2d');ctx.setTransform(1/a,0,0,1/a,-tx/a,-ty/a);ctx.drawImage(canvas,0,0,canvas.width,canvas.height,0,0,innerWidth,innerHeight)
 const areas=mobile?{sky:[240,180,240,250],fall:[596,834,15,42],robot:[344,1009,12,12],cat:[389,1019,12,12],tail:[405,1008,34,42],field:[140,1000,90,50]}:{sky:[430,100,320,180],fall:[949,412,20,45],robot:[548,564,14,14],cat:[604,575,12,12],tail:[620,558,34,40],field:[300,550,140,50]}
 return Object.fromEntries(Object.entries(areas).map(([name,rect])=>{const data=ctx.getImageData(...rect).data,sums=[0,0,0];let count=0;for(let i=0;i<data.length;i+=4){sums[0]+=data[i];sums[1]+=data[i+1];sums[2]+=data[i+2];count++}return[name,{mean:sums.map(v=>v/count),pixels:name==='sky'?[]:Array.from(data)}]}))
})}
try{
for(const [width,height] of [[1440,900],[390,844]]){
 const page=await browser.newPage({viewport:{width,height}})
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/THREE.WebGLProgram|shader error/i.test(m.text()))errors.push(m.text())})
 await page.addInitScript(()=>{
  localStorage.setItem('portfolio-scene-motion','reduced');localStorage.setItem('portfolio-language','en')
  const draw=WebGL2RenderingContext.prototype.drawElements
  WebGL2RenderingContext.prototype.drawElements=function(...args){
   const p=this.getParameter(this.CURRENT_PROGRAM),u=!this.canvas.isConnected&&window.__devicePulse&&p?this.getUniformLocation(p,'componentPulse'):null,old=u?this.getUniform(p,u):null
   if(u)this.uniform2fv(u,window.__devicePulse);draw.apply(this,args);if(u)this.uniform2fv(u,old)
  }
 })
 await page.goto(base);await page.locator('.hero-atmosphere-canvas[data-ready=true]').waitFor();await page.waitForTimeout(600)
 await page.locator('.scene-trigger').click();await page.getByRole('combobox',{name:'Weather',exact:true}).selectOption('clear')
 await page.getByRole('button',{name:'Day',exact:true}).click();const day=await sample(page)
 await page.getByRole('button',{name:'Dusk',exact:true}).click();const dusk=await sample(page)
 const warming=(dusk.sky.mean[0]-dusk.sky.mean[2])-(day.sky.mean[0]-day.sky.mean[2])
 console.log(width,'sunset cloud warming:',warming.toFixed(2),dusk.sky.mean)
 assert.ok(warming>25,'dusk must visibly warm the existing cloud texture')
 let waterPixels=0,waterWarmth=0
 for(let i=0;i<day.fall.pixels.length;i+=4){
  const r=day.fall.pixels[i],g=day.fall.pixels[i+1],b=day.fall.pixels[i+2]
  if(Math.min(r,g,b)>120&&b>=r&&g>=r*.98){waterPixels++;waterWarmth+=dusk.fall.pixels[i]-dusk.fall.pixels[i+2]}
 }
 console.log(width,'dusk waterfall warmth:',waterWarmth/Math.max(1,waterPixels),'water pixels:',waterPixels)
 assert.ok(waterPixels>8&&waterWarmth/waterPixels>12,'photographed waterfall foam must inherit warm dusk light, without a blue-white overlay')
 assert.equal(await page.locator('.hero-atmosphere-canvas').getAttribute('data-sunset'),'1.000')
 await page.getByRole('button',{name:'Close scene settings',exact:true}).click();await page.screenshot({path:'artifacts/sunset-verified-'+width+'.png'})
 await page.locator('.scene-trigger').click();await page.getByRole('button',{name:'Deep night',exact:true}).click();await page.getByRole('button',{name:'Close scene settings',exact:true}).click()
 const lit=await sample(page)
 await page.evaluate(()=>{window.__devicePulse=[.42,1];dispatchEvent(new Event('resize'))});const robotDim=await sample(page)
 await page.evaluate(()=>{window.__devicePulse=[1,.42];dispatchEvent(new Event('resize'))});const catDim=await sample(page)
 const robotBlink=change(lit.robot.pixels,robotDim.robot.pixels),catBlink=change(lit.cat.pixels,catDim.cat.pixels),fieldBlink=change(lit.field.pixels,robotDim.field.pixels)
 console.log(width,'isolated device blinking:',{robotBlink,catBlink,fieldBlink})
 assert.ok(robotBlink>1&&catBlink>.5,'both devices must visibly change light intensity')
 assert.ok(change(lit.cat.pixels,robotDim.cat.pixels)<.4&&change(lit.robot.pixels,catDim.robot.pixels)<.4,'devices have separate light channels')
 assert.ok(fieldBlink<.4,'device blinking must not pulse the meadow')
 await page.evaluate(()=>{delete window.__devicePulse;dispatchEvent(new Event('resize'))})
 assert.equal(await page.locator('.hero-atmosphere-canvas').getAttribute('data-tail-angle'),'0.0000')
 assert.equal(await page.locator('.hero-atmosphere-canvas').getAttribute('data-robot-pulse'),'1.0000')
 assert.equal(await page.locator('.hero-atmosphere-canvas').getAttribute('data-cat-pulse'),'1.0000')
 await page.locator('.scene-trigger').click();await page.getByRole('button',{name:'Day',exact:true}).click();const resting=await sample(page)
 await page.getByRole('checkbox',{name:'Reduce motion',exact:true}).uncheck();await page.getByRole('button',{name:'Close scene settings',exact:true}).click()
 await page.waitForFunction(()=>+document.querySelector('.hero-atmosphere-canvas').dataset.tailAngle>.2,{timeout:18000})
 const moving=await sample(page),tailMotion=change(resting.tail.pixels,moving.tail.pixels)
 console.log(width,'visible tail movement:',tailMotion.toFixed(3))
 assert.ok(tailMotion>1.3,'tail gesture must change actual image pixels independently of the camera')
 await page.screenshot({path:'artifacts/tail-moving-'+width+'.png'})
 await page.waitForFunction(()=>{const c=document.querySelector('.hero-atmosphere-canvas');return +c.dataset.renderTime>11&&+c.dataset.tailAngle===0},{timeout:12000})
 assert.ok(+await page.locator('.hero-atmosphere-canvas').getAttribute('data-render-time')<29,'tail returns to rest within the first gesture')
 await page.close()
}
assert.deepEqual(errors,[])
console.log('PASS: fiery sunset, separate occasional tail gesture, isolated robot/kitten blinking and reduced-motion steady lights')
}finally{await browser.close()}
