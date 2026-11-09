import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const source=fs.readFileSync(new URL('../lib/glassPhysics.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {createApertureField,createWetHistory,glassDrop,dropStats,stepGlassWater}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const fieldFor=(shape,w=140,h=180,step=1)=>createApertureField(Uint8Array.from({length:w*h},(_,i)=>shape(i%w,Math.floor(i/w))?255:0),w,h,step)
const window=()=>fieldFor((x,y)=>x>=20&&x<110&&y>=45&&y<115)

test('one signed field describes the opening, glass, and inward frame normals',()=>{
 const f=window();assert.ok(f.sample(60,70)>10);assert.ok(f.sample(60,20)<-10)
 assert.ok(f.normal(60,45).y>.99);assert.ok(f.normal(60,115).y<-.99)
 assert.ok(f.normal(20,70).x>.99);assert.ok(f.normal(110,70).x<-.99)
 for(const p of [[-50,-50],[400,400],[60,45]])assert.ok(Number.isFinite(f.sample(...p)))
})

test('a sliding bead pins, drips through the opening, lands on the sill, and drops free',()=>{
 const f=window(),d=glassDrop(60,20,7),drops=[d],stats=dropStats(),modes=new Set(),traces=[]
 for(let i=0;i<120*8;i++){
  stepGlassWater(drops,f,0,.6,1/120,stats,(x,y,xx,yy)=>traces.push({x,y,xx,yy,mode:d.mode}))
  modes.add(d.mode)
 }
 assert.ok(stats.contacts>=1);assert.ok(stats.landings>=1);assert.ok(stats.detached>=2)
 for(const mode of ['glass','rim','cavity','falling'])assert.ok(modes.has(mode),mode)
 assert.ok(d.y>180,'detached water accelerates below the sill')
 assert.ok(traces.length>0);assert.ok(traces.every(t=>t.mode==='glass'&&f.sample((t.x+t.xx)/2,(t.y+t.yy)/2)<0),'only contact with glass creates a trail')
})

test('contact and free fall do not depend on the display frame rate',()=>{
 const f=window(),run=fps=>{const drops=[glassDrop(60,20,7)],stats=dropStats();for(let i=0;i<fps*5;i++)stepGlassWater(drops,f,0,.6,1/fps,stats,()=>{});return {drop:drops[0],stats}}
 const a=run(30),b=run(120);assert.equal(a.drop.mode,b.drop.mode)
 assert.ok(Math.abs(a.drop.x-b.drop.x)<.1);assert.ok(Math.abs(a.drop.y-b.drop.y)<.1)
 assert.deepEqual(a.stats,b.stats)
})

test('coalescence conserves three-dimensional volume and linear momentum',()=>{
 const f=fieldFor(()=>false),a=glassDrop(20,20,3),b=glassDrop(21,20,4),drops=[a,b],stats=dropStats()
 a.vx=4;a.vy=3;b.vx=-2;b.vy=7
 const mass=3**3+4**3,px=3**3*4+4**3*(-2),py=3**3*3+4**3*7
 stepGlassWater(drops,f,0,.6,0,stats,()=>{});assert.equal(drops.length,1)
 assert.ok(Math.abs(drops[0].r**3-mass)<1e-10)
 assert.ok(Math.abs(drops[0].vx*mass-px)<1e-10);assert.ok(Math.abs(drops[0].vy*mass-py)<1e-10)
})

test('drops on opposite sides of a cutout cannot merge through empty space',()=>{
 const f=fieldFor((x,y)=>x>=45&&x<55&&y>=20&&y<100)
 const drops=[glassDrop(40,60,12),glassDrop(60,60,12)],stats=dropStats()
 stepGlassWater(drops,f,0,.6,0,stats,()=>{});assert.equal(drops.length,2);assert.equal(stats.merges,0)
})

test('water attached to the same lip can coalesce and overcome capillary retention',()=>{
 const f=window(),a=glassDrop(60,46,4),b=glassDrop(61,46,4),stats=dropStats(),drops=[a,b]
 for(const d of drops)Object.assign(d,{mode:'rim',anchorX:d.x,anchorY:45,nx:0,ny:1,held:.8})
 stepGlassWater(drops,f,0,.6,0,stats,()=>{});assert.equal(drops.length,1);assert.ok(drops[0].r>4.7)
 for(let i=0;i<120;i++)stepGlassWater(drops,f,0,.6,1/120,stats,()=>{})
 assert.ok(stats.detached>0)
})

test('small beads stay pinned instead of sliding like weightless sprites',()=>{
 const f=fieldFor(()=>false),d=glassDrop(30,20,2.5),stats=dropStats()
 for(let i=0;i<120;i++)stepGlassWater([d],f,0,.6,1/30,stats,()=>assert.fail('pinned bead cannot leave a trail'))
 assert.equal(d.x,30);assert.equal(d.y,20);assert.equal(d.vy,0)
})

test('sloped letter frames carry pinned water downhill before detachment',()=>{
 const f=fieldFor((x,y)=>x>=10&&x<120&&y>=35+x*.3&&y<140),d=glassDrop(55,52,6),stats=dropStats()
 Object.assign(d,{mode:'rim',anchorX:55,anchorY:51.5,nx:-.287,ny:.958})
 for(let i=0;i<36;i++)stepGlassWater([d],f,0,.6,1/120,stats,()=>{})
 assert.equal(d.mode,'rim');assert.ok(d.anchorX>55);assert.ok(d.anchorY>51.5)
})

test('wet trails really fade at 30/60/120 FPS without getting stuck in 8-bit rounding',()=>{
 const run=fps=>{
  const history=createWetHistory(10,10);history.deposit(5.5,2,5.5,8,1.2);history.advance(0,38)
  const initial=history.values[55]
  for(let i=0;i<fps*38;i++)history.advance(1/fps,38)
  assert.ok(Math.abs(history.values[55]/initial-Math.exp(-1))<.0001)
  assert.ok(history.pixels[55*4]<80,'displayed residue visibly fades')
  return history.values[55]
 }
 const a=run(30),b=run(60),c=run(120)
 assert.ok(Math.abs(a-b)<.0001&&Math.abs(b-c)<.0001)
})

test('water contacts vertical side frames from both the cavity and glass side',()=>{
 const f=window(),inside=glassDrop(108,70,4),outside=glassDrop(16,70,4.6),a=dropStats(),b=dropStats()
 Object.assign(inside,{mode:'cavity',vx:30});outside.vx=20
 stepGlassWater([inside],f,0,.6,1/120,a,()=>{})
 assert.equal(inside.mode,'rim');assert.equal(a.landings,1)
 for(let i=0;i<60;i++)stepGlassWater([outside],f,0,.6,1/120,b,()=>{})
 assert.ok(b.contacts>0,'a sideways slide cannot pass through the frame')
})
