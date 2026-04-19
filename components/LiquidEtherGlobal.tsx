'use client'

import LiquidEther from './LiquidEther'

export default function LiquidEtherGlobal() {
  return (
    <LiquidEther
      colors={['#C9A84C', '#D4A843', '#E8C15A', '#F0D080', '#C9A84C']}
      mouseForce={22}
      cursorSize={110}
      resolution={0.45}
      autoDemo={true}
      autoSpeed={0.38}
      autoIntensity={1.6}
      autoRampDuration={0.8}
      autoResumeDelay={1200}
      style={{
        position: 'fixed',
        zIndex: 2,
        opacity: 0.55,
        mixBlendMode: 'screen',
      }}
    />
  )
}
