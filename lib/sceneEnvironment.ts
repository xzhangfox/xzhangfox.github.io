export type ScenePhase = 'predawn' | 'morning' | 'day' | 'dusk' | 'night' | 'deep'
export type SceneWeather = 'auto' | 'clear' | 'mist' | 'drizzle' | 'storm'
export type RGB = readonly [number, number, number]
export const SCENE_PHASES: { id: ScenePhase; hour: number; en: string; zh: string }[] = [
  { id: 'predawn', hour: 5, en: 'Before dawn', zh: '凌晨' },
  { id: 'morning', hour: 7, en: 'Morning', zh: '清晨' },
  { id: 'day', hour: 12, en: 'Day', zh: '白天' },
  { id: 'dusk', hour: 18.5, en: 'Dusk', zh: '傍晚' },
  { id: 'night', hour: 21.5, en: 'Night', zh: '夜晚' },
  { id: 'deep', hour: 1.5, en: 'Deep night', zh: '深夜' },
]
export const WEATHER_NAMES: Record<SceneWeather, { en: string; zh: string }> = {
  auto: { en: 'Natural weather', zh: '自然天气' }, clear: { en: 'Clear', zh: '晴朗' },
  mist: { en: 'Mist & dew', zh: '晨雾与露水' }, drizzle: { en: 'Light rain', zh: '小雨' },
  storm: { en: 'Heavy rain', zh: '暴雨' },
}
export const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n))
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }
export const phaseAt = (hour: number): ScenePhase => {
  const h = ((hour % 24) + 24) % 24
  return h < 4 ? 'deep' : h < 6 ? 'predawn' : h < 9 ? 'morning' : h < 17 ? 'day' : h < 20 ? 'dusk' : 'night'
}
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
/** A deterministic aesthetic weather cycle, not a forecast or a location lookup.
 * A six-hour block has at most one rain event; reopening never rerolls it. */
export function rainfallAt(timestamp: number) {
  const blockMs = 6 * 3600_000, block = Math.floor(timestamp / blockMs)
  const chance = hash(block)
  if (chance > .32) return 0
  const storm = chance < .045
  const start = (40 + hash(block + 17) * 220) * 60_000
  const length = (storm ? 8 + hash(block + 31) * 8 : 16 + hash(block + 31) * 24) * 60_000
  const age = timestamp - block * blockMs - start
  if (age < 0 || age > length) return 0
  const fade = 120_000
  return (storm ? .92 : .24) * smooth(age / fade) * smooth((length - age) / fade)
}
function recentRain(timestamp: number, from: number, to: number) {
  let sum = 0, weight = 0
  for (let minute = from; minute <= to; minute += 3) {
    const w = 1 - (minute - from) / (to - from + 3)
    sum += rainfallAt(timestamp - minute * 60_000) * w; weight += w
  }
  return weight ? clamp(sum / weight * 4) : 0
}
type LightKey = { h: number; night: number; brightness: number; tint: RGB; warmth: number }
const LIGHT: LightKey[] = [
  { h: 0, night: 1, brightness: .34, tint: [27, 41, 71], warmth: 0 },
  { h: 4, night: 1, brightness: .44, tint: [53, 49, 81], warmth: .08 },
  { h: 6, night: .08, brightness: .81, tint: [157, 154, 174], warmth: .26 },
  { h: 8, night: 0, brightness: 1, tint: [255, 223, 175], warmth: .2 },
  { h: 12, night: 0, brightness: 1.04, tint: [234, 244, 255], warmth: 0 },
  { h: 16, night: 0, brightness: .98, tint: [249, 225, 187], warmth: .13 },
  { h: 18, night: .05, brightness: .79, tint: [226, 161, 120], warmth: .4 },
  { h: 20, night: .75, brightness: .44, tint: [58, 61, 99], warmth: .08 },
  { h: 22, night: 1, brightness: .34, tint: [27, 41, 71], warmth: 0 },
  { h: 24, night: 1, brightness: .34, tint: [27, 41, 71], warmth: 0 },
]
/** Warm cloud light peaks around sunset and fades before the late-night sky. */
export function sunsetAt(hour: number) {
  const h = ((hour % 24) + 24) % 24
  return smooth((h - 16.25) / 1.25) * (1 - smooth((h - 19.25) / 1.25))
}
/** Two soft, staggered indicator blinks; no animation at the reduced-motion time of zero. */
export function companionLightPulse(seconds: number, kitten = false) {
  const age = ((Math.max(0, seconds) % (kitten ? 31 : 23)) - (kitten ? 13 : 7))
  if (age < 0 || age > 2) return 1
  return 1 - .58 * Math.exp(-2 * Math.pow((age - .55) / .18, 2)) - .4 * Math.exp(-2 * Math.pow((age - 1.1) / .22, 2))
}
/** A short, eased tail gesture between long resting intervals. */
export function catTailAngle(seconds: number) {
  const age = Math.max(0, seconds) % 29 - 6
  if (age <= 0 || age >= 5) return 0
  return Math.sin(age * 2.1) * .32 * smooth(age / .8) * smooth((5 - age) / 1.2)
}
export function lightAt(hour: number) {
  const h = ((hour % 24) + 24) % 24
  const end = LIGHT.findIndex((v, i) => i > 0 && h <= v.h)
  const b = LIGHT[Math.max(1, end)], a = LIGHT[Math.max(0, end - 1)], t = smooth((h - a.h) / (b.h - a.h))
  return {
    sunset: sunsetAt(h), night: mix(a.night, b.night, t), brightness: mix(a.brightness, b.brightness, t),
    warmth: mix(a.warmth, b.warmth, t), tint: a.tint.map((v, i) => mix(v, b.tint[i], t)) as [number, number, number],
  }
}
export interface SceneEnvironment {
  hour: number; phase: ScenePhase; weather: Exclude<SceneWeather, 'auto'>; rain: number
  fog: number; wetness: number; stream: number; waterfall: number; preview: boolean
  light: ReturnType<typeof lightAt>
}
export function environmentAt(date: Date, previewHour: number | null = null, weather: SceneWeather = 'auto'): SceneEnvironment {
  const hour = previewHour ?? date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  const stamp = date.getTime()
  const rain = weather === 'auto' ? rainfallAt(stamp) : weather === 'storm' ? .92 : weather === 'drizzle' ? .24 : 0
  const dawn = smooth((hour - 3.5) / 2) * (1 - smooth((hour - 7.5) / 2))
  const fog = weather === 'clear' ? 0 : clamp(dawn * .65 + rain * .18 + (weather === 'mist' ? .6 : 0), 0, .9)
  return {
    hour, phase: phaseAt(hour), weather: rain > .5 ? 'storm' : rain > .02 ? 'drizzle' : fog > .35 ? 'mist' : 'clear',
    rain, fog, wetness: recentRain(stamp, 0, 180), stream: recentRain(stamp, 8, 55),
    waterfall: recentRain(stamp, 24, 110), preview: previewHour !== null || weather !== 'auto', light: lightAt(hour),
  }
}
/** Exponential response is frame-rate independent and leaves water after rain stops. */
export function approach(current: number, target: number, seconds: number, dt: number) {
  return mix(current, target, 1 - Math.exp(-Math.max(0, dt) / seconds))
}
