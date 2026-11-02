// Regression for cloud/mountain ghosting at every extremum of the long cloud drift cycle.
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.env.FLUX_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.FLUX_PLAYWRIGHT_MODULE).href : 'playwright')
const browser = await chromium.launch({headless:true,executablePath:process.env.FLUX_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'})
const page = await browser.newPage({viewport:{width:1440,height:900}})
await page.addInitScript(() => {
  localStorage.setItem('portfolio-scene-motion','reduced'); localStorage.setItem('portfolio-language','en')
  // Render UV coordinates and blend weight instead of beauty colors, only in this test context.
  const source = WebGL2RenderingContext.prototype.shaderSource
  WebGL2RenderingContext.prototype.shaderSource = function(shader, text) {
    if (text.includes('vec2 plantUV=') && text.includes('float sky=region.r;')) {
      text = text.replace('gl_FragColor=vec4(color,1.);','gl_FragColor=vec4(p+wind*sky,sky,1.);')
    }
    source.call(this,shader,text)
  }
  const draw = WebGL2RenderingContext.prototype.drawElements
  WebGL2RenderingContext.prototype.drawElements = function(...args) {
    const program = this.getParameter(this.CURRENT_PROGRAM)
    const time = !this.canvas.isConnected && program ? this.getUniformLocation(program,'time') : null
    const previous = time ? this.getUniform(program,time) : null
    if (time) this.uniform1f(time,window.__cloudTime || 0)
    draw.apply(this,args)
    if (time) {
      const w=this.drawingBufferWidth,h=this.drawingBufferHeight,pixels=new Uint8Array(w*h*4)
      this.readPixels(0,0,w,h,this.RGBA,this.UNSIGNED_BYTE,pixels)
      let maxWeightStep=0,maxUvStep=0
      for(let y=1;y<h;y++)for(let x=1;x<w;x++){
        const k=(y*w+x)*4
        for(const neighbor of [k-4,k-w*4]){
          maxWeightStep=Math.max(maxWeightStep,Math.abs(pixels[k+2]-pixels[neighbor+2]))
          maxUvStep=Math.max(maxUvStep,Math.abs(pixels[k]-pixels[neighbor]),Math.abs(pixels[k+1]-pixels[neighbor+1]))
        }
      }
      window.__cloudDiagnostics={width:w,height:h,maxWeightStep,maxUvStep}
      this.uniform1f(time,previous)
    }
  }
})
try {
  await page.goto(process.env.PORTFOLIO_TEST_URL || 'http://127.0.0.1:4177')
  await page.locator('.hero-atmosphere-canvas[data-ready=true]').waitFor()
  await page.locator('.scene-trigger').click()
  await page.getByRole('button',{name:'Day',exact:true}).click()
  await page.getByRole('combobox',{name:'Weather',exact:true}).selectOption('clear')
  await page.getByRole('button',{name:'Close scene settings',exact:true}).click()
  for(const [width,height] of [[1440,900],[390,844]]){
    await page.setViewportSize({width,height})
    for(const time of [0,26,52,79,105]){
      const result=await page.evaluate(t=>{window.__cloudTime=t;dispatchEvent(new Event('resize'));return window.__cloudDiagnostics},time)
      console.log(width<700?'Portrait':'Desktop','cloud time',time,result)
      assert.ok(result.maxWeightStep<=6,'cloud blend must be smooth, without a second mountain-shaped edge')
      assert.ok(result.maxUvStep<=3,'texture sampling must remain continuous across the skyline buffer')
    }
  }
  console.log('PASS: no sharp cloud-mask silhouette or UV seam over the full cloud drift cycle')
} finally { await browser.close() }
