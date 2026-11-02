'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CloudFog, CloudRain, Moon, Sun, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { environmentAt, SCENE_PHASES, WEATHER_NAMES, type SceneWeather } from '@/lib/sceneEnvironment'
import { createHeroScene, type SceneController } from '@/lib/renderHeroScene'

export default function HeroAtmosphere() {
  const { language } = useLanguage()
  const zh = language === 'zh'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const engine = useRef<SceneController | null>(null)
  const [now, setNow] = useState<Date | null>(null)
  const [previewHour, setPreviewHour] = useState<number | null>(null)
  const [weather, setWeather] = useState<SceneWeather>('auto')
  const [reduced, setReduced] = useState(true)
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(true)
  const environment = useMemo(() => {
    if (now) return environmentAt(now, previewHour, weather)
    // Static export may run in UTC; the first client render must not depend on its timezone.
    return { ...environmentAt(new Date(0), 0, 'clear'), preview: false }
  }, [now, previewHour, weather])
  const phase = SCENE_PHASES.find(p => p.id === environment.phase)!
  const weatherName = WEATHER_NAMES[environment.weather]
  const Icon = environment.rain > .02 ? CloudRain : environment.fog > .35 ? CloudFog : environment.light.night > .6 ? Moon : Sun

  useEffect(() => {
    const canvas = canvasRef.current, video = videoRef.current
    if (!canvas || !video) return
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    let preference: string | null = null
    try { preference = localStorage.getItem('portfolio-scene-motion') } catch { /* Optional preference. */ }
    const initialReduced = preference === 'reduced' || (preference !== 'full' && media.matches)
    setReduced(initialReduced); setNow(new Date())
    engine.current = createHeroScene(canvas, video, environmentAt(new Date()), initialReduced)
    const interval = window.setInterval(() => setNow(new Date()), 15000)
    const onMotion = () => {
      let stored: string | null = null
      try { stored = localStorage.getItem('portfolio-scene-motion') } catch { /* Optional preference. */ }
      if (stored !== 'full' && stored !== 'reduced') setReduced(media.matches)
    }
    const onVisibility = () => { if (!document.hidden) setNow(new Date()) }
    media.addEventListener('change', onMotion)
    document.addEventListener('visibilitychange', onVisibility)
    const hero = document.querySelector('[data-home-hero]')
    const observer = new IntersectionObserver(([entry]) => {
      const active = entry.isIntersecting
      engine.current?.setVisible(active); setVisible(active)
      if (!active) setOpen(false)
    }, { threshold: 0 })
    if (hero) observer.observe(hero)
    return () => {
      clearInterval(interval); observer.disconnect(); engine.current?.destroy(); engine.current = null
      media.removeEventListener('change', onMotion); document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => { if (now) engine.current?.update(environment, reduced) }, [environment, reduced, now])

  useEffect(() => {
    if (!open) return
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus() }
    }
    const outside = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', key); document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside) }
  }, [open])

  const toggleReduced = (next: boolean) => {
    setReduced(next)
    try { localStorage.setItem('portfolio-scene-motion', next ? 'reduced' : 'full') } catch { /* Optional preference. */ }
  }
  const restore = () => { setPreviewHour(null); setWeather('auto'); setNow(new Date()) }
  const clock = now ? new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now) : '—'
  return (
    <>
      <div className="hero-atmosphere" aria-hidden="true">
        <canvas ref={canvasRef} className="hero-atmosphere-canvas" />
        <video ref={videoRef} loop muted playsInline preload="none" className="hidden" src="/videos/hero-bg.mp4" />
      </div>
      <div className="scene-controls" ref={controlRef} hidden={!visible || !now}>
        {open && (
          <section className="scene-panel" id="scene-options" role="dialog" aria-label={zh ? '光影与天气' : 'Light & weather'}>
            <div className="scene-panel-head">
              <div><h2>{zh ? '同一片天空' : 'Under the same sky'}</h2><p>{zh ? '山谷有自己的时间与天气。' : 'One valley. Its own time and weather.'}</p></div>
              <button type="button" className="scene-close" aria-label={zh ? '关闭场景设置' : 'Close scene settings'} onClick={() => { setOpen(false); triggerRef.current?.focus() }}><X size={16} aria-hidden="true" /></button>
            </div>
            <fieldset>
              <legend>{zh ? '时段预览' : 'Explore the light'}</legend>
              <div className="scene-phase-grid">
                {SCENE_PHASES.map(item => (
                  <button type="button" key={item.id} aria-pressed={previewHour === item.hour} onClick={() => setPreviewHour(item.hour)}>
                    {zh ? item.zh : item.en}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="scene-weather-label">
              <span>{zh ? '天气' : 'Weather'}</span>
              <select aria-label={zh ? '天气' : 'Weather'} value={weather} onChange={event => setWeather(event.target.value as SceneWeather)}>
                {(Object.keys(WEATHER_NAMES) as SceneWeather[]).map(key => <option key={key} value={key}>{zh ? WEATHER_NAMES[key].zh : WEATHER_NAMES[key].en}</option>)}
              </select>
            </label>
            <label className="scene-motion"><input type="checkbox" checked={reduced} onChange={event => toggleReduced(event.target.checked)} /><span>{zh ? '减少动效' : 'Reduce motion'}</span></label>
            <button type="button" className="scene-restore" onClick={restore} disabled={!environment.preview}>{zh ? '恢复当地时间与自然天气' : 'Use local time & natural weather'}</button>
            <p className="scene-note">{zh ? '天气为氛围模拟，不读取定位。雨停后溪流、瀑布与湿润反光会缓慢回落。' : 'Atmospheric weather, without location access. Water and wet surfaces linger after the rain.'}</p>
          </section>
        )}
        <button ref={triggerRef} type="button" className="scene-trigger" aria-expanded={open} aria-controls="scene-options" onClick={() => setOpen(value => !value)}>
          <Icon size={14} aria-hidden="true" />
          <span>{environment.preview ? (zh ? '预览' : 'Preview') : (zh ? '当地时间' : 'Local time')}{!environment.preview && <span className="scene-clock"> {clock}</span>}</span>
          <span className="scene-dot" aria-hidden="true" />
          <span>{zh ? phase.zh : phase.en}</span>
          <span className="scene-weather-summary"> · {zh ? weatherName.zh : weatherName.en}</span>
        </button>
      </div>
    </>
  )
}
