import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const source = fs.readFileSync(new URL('../lib/sceneEnvironment.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { phaseAt, lightAt, rainfallAt, environmentAt, approach, sunsetAt } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

test('all six phases wrap correctly at midnight without a lighting jump', () => {
  for (const [hour, phase] of [[0,'deep'],[3.99,'deep'],[4,'predawn'],[6,'morning'],[9,'day'],[17,'dusk'],[20,'night'],[24,'deep'],[-1,'night']]) assert.equal(phaseAt(hour), phase)
  assert.deepEqual(lightAt(0), lightAt(24))
  for (const boundary of [4,6,8,12,16,18,20,22]) {
    const before=lightAt(boundary-.0001), after=lightAt(boundary+.0001)
    assert.ok(Math.abs(before.brightness-after.brightness)<.001)
    assert.ok(Math.abs(before.night-after.night)<.001)
  }
})

test('weather is deterministic, bounded, and does not reroll on refresh', () => {
  const date = new Date('2026-10-29T12:00:00Z')
  assert.deepEqual(environmentAt(date), environmentAt(new Date(date.getTime())))
  let clear=0, wet=0, storms=0
  for(let minute=0;minute<30*24*60;minute+=3){
    const rain=rainfallAt(date.getTime()+minute*60000)
    assert.ok(Number.isFinite(rain)&&rain>=0&&rain<=1)
    if(rain===0)clear++;else wet++
    if(rain>.5)storms++
  }
  assert.ok(clear>wet*8,'clear skies dominate')
  assert.ok(wet>0 && storms>0,'both light and heavy rain occur')
  assert.ok(storms<wet/2,'heavy rain is less common')
})

test('glass stays wet after rain stops', () => {
  let peak
  for(let minute=0;minute<80*24*60;minute+=2){
    const stamp=Date.UTC(2026,0,1)+minute*60000
    if(rainfallAt(stamp)>.85){peak=stamp;break}
  }
  assert.ok(peak)
  const stopped=environmentAt(new Date(peak+45*60000))
  assert.equal(stopped.rain,0)
  assert.ok(stopped.wetness>0,'glass stays wet after rain')
  assert.equal(environmentAt(new Date(peak+6*3600000),null,'clear').rain,0)
})

test('preview changes the lighting without changing local time or persisting a fake forecast', () => {
  const date=new Date(2026,9,29,12,0)
  const base=environmentAt(date)
  const night=environmentAt(date,1.5,'storm')
  assert.equal(night.phase,'deep');assert.equal(night.weather,'storm');assert.equal(night.preview,true)
  assert.ok(night.light.night>.99)
  assert.equal(date.getHours(),12)
  assert.equal(environmentAt(date).preview,false)
  assert.deepEqual(environmentAt(date),base)
  assert.equal(environmentAt(date,7,'mist').weather,'mist')
  assert.equal(environmentAt(date,7,'clear').fog,0)
})

test('wetness response is independent of frame rate and does not instantly dry', () => {
  let stepped=0
  for(let i=0;i<600;i++)stepped=approach(stepped,1,75,.1)
  assert.ok(Math.abs(stepped-approach(0,1,75,60))<1e-10)
  assert.ok(approach(.8,0,420,1)>.79)
  assert.ok(approach(0,1,150,10)<approach(0,1,75,10))
})

test('sunset color has a smooth evening window and disappears by night', () => {
  assert.equal(sunsetAt(12), 0); assert.equal(sunsetAt(0), 0)
  assert.equal(sunsetAt(18.5), 1); assert.equal(sunsetAt(21), 0)
  assert.ok(sunsetAt(17) > 0 && sunsetAt(17) < 1)
  assert.ok(sunsetAt(20) > 0 && sunsetAt(20) < 1)
  for (const h of [16.25,17.5,19.25,20.5]) assert.ok(Math.abs(sunsetAt(h+.001)-sunsetAt(h-.001)) < .005)
})
