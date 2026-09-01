#!/usr/bin/env node
/**
 * Fetches free, no-key daily market data (Stooq equity/index prices, FRED
 * credit-spread and rate series) and computes the AI Bubble Monitor's
 * composite indicator set. Writes data/ai-bubble/latest.json (today's
 * snapshot) and data/ai-bubble/history.json (trailing time series for the
 * trend chart). Designed to run daily from GitHub Actions.
 *
 * No lookahead: every historical percentile is computed against an
 * expanding window of only the data available up to and including that day.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.AI_BUBBLE_DATA_DIR || path.join(__dirname, '..', 'data', 'ai-bubble')
const HISTORY_MAX_DAYS = 1095 // ~3 years kept for the chart

const AI_BASKET = ['nvda.us', 'msft.us', 'googl.us', 'amzn.us', 'meta.us', 'avgo.us', 'orcl.us']
const STOOQ_SYMBOLS = { vix: '^vix', rut: '^rut' }
const FRED_SERIES = { hySpread: 'BAMLH0A0HYM2', dgs10: 'DGS10' }

const MOMENTUM_LOOKBACK = 252 // ~1 trading year
const TREND_WINDOW = 200
const BREADTH_LOOKBACK = 126 // ~6 trading months
const VOLUME_SHORT = 20
const VOLUME_LONG = 252
const MIN_WARMUP_DAYS = MOMENTUM_LOOKBACK + 30 // extra buffer before an indicator is trusted

const RETRIES = 3
const RETRY_DELAY_MS = 2000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchText(url) {
  let lastErr
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ai-bubble-monitor/1.0; +https://xzhangfox.github.io)' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      const text = await res.text()
      if (!text || !text.trim()) throw new Error(`Empty response for ${url}`)
      return text
    } catch (err) {
      lastErr = err
      if (attempt < RETRIES) await sleep(RETRY_DELAY_MS * attempt)
    }
  }
  throw new Error(`Failed to fetch ${url} after ${RETRIES} attempts: ${lastErr?.message}`)
}

function parseStooqCsv(csv) {
  const lines = csv.trim().split('\n').slice(1)
  const rows = []
  for (const line of lines) {
    const parts = line.split(',')
    const [date, , , , close, volume] = parts
    const c = Number(close)
    if (!date || !Number.isFinite(c)) continue
    const v = Number(volume)
    rows.push({ date, close: c, volume: Number.isFinite(v) ? v : null })
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : 1))
  return rows
}

function parseFredCsv(csv) {
  const lines = csv.trim().split('\n').slice(1)
  const rows = []
  for (const line of lines) {
    const [date, val] = line.split(',')
    if (!date || val === undefined || val === '.' || val === '') continue
    const v = Number(val)
    if (!Number.isFinite(v)) continue
    rows.push({ date, value: v })
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : 1))
  return rows
}

function toSeriesMap(rows, valueKey) {
  const map = new Map()
  for (const row of rows) map.set(row.date, row[valueKey])
  return map
}

/** Forward-fill a sparse date->value map onto a canonical ascending date list. */
function alignToCalendar(dates, seriesMap) {
  const aligned = new Array(dates.length).fill(null)
  let last = null
  for (let i = 0; i < dates.length; i++) {
    const v = seriesMap.get(dates[i])
    if (v !== undefined) last = v
    aligned[i] = last
  }
  return aligned
}

function sma(values, window, i) {
  if (i < window - 1) return null
  let sum = 0
  for (let k = i - window + 1; k <= i; k++) {
    const v = values[k]
    if (v === null) return null
    sum += v
  }
  return sum / window
}

/** Maintains a sorted array and reports, for each inserted value in order,
 *  its percentile rank (0-100) among all values inserted so far (inclusive). */
function makeExpandingPercentileTracker() {
  const sorted = []
  return function pushAndRank(value) {
    if (value === null || Number.isNaN(value)) return null
    let lo = 0
    let hi = sorted.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (sorted[mid] <= value) lo = mid + 1
      else hi = mid
    }
    sorted.splice(lo, 0, value)
    return (lo / (sorted.length - 1 || 1)) * 100
  }
}

const INDICATOR_DEFS = [
  {
    id: 'momentum',
    name: 'AI Basket Momentum Extension',
    framework: 'Minsky / Dalio',
    description:
      'Trailing 12-month return of an equal-weighted basket of major AI-capex-linked stocks (NVDA, MSFT, GOOGL, AMZN, META, AVGO, ORCL). Large, persistent gains reflect prices "discounting future rapid appreciation from today\'s already-high levels" — Dalio\'s second bubble hallmark, and the euphoric phase of Minsky\'s financial instability cycle.',
    format: (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}% (1yr)`,
  },
  {
    id: 'trendExtension',
    name: 'Valuation Stretch vs 200-Day Trend',
    framework: 'Dalio',
    description:
      'How far the AI basket trades above its own 200-day moving average, a free daily proxy for Dalio\'s first hallmark — "prices high relative to traditional measures" — in the absence of a live free earnings feed.',
    format: (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}% above 200D MA`,
  },
  {
    id: 'concentration',
    name: 'Narrow Leadership vs Small Caps',
    framework: 'Minsky / market breadth',
    description:
      '6-month return of the AI basket minus the Russell 2000. Bubbles concentrate gains in a small set of leaders while the broader market lags — a breadth-divergence warning flagged by Shiller and Grantham alike.',
    format: (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)} pts vs Russell 2000`,
  },
  {
    id: 'complacency',
    name: 'Volatility Complacency (VIX)',
    framework: 'Dalio',
    description:
      'Inverted VIX level. A historically low VIX signals the "broad bullish sentiment" that is Dalio\'s third bubble hallmark — investors pricing in little downside risk.',
    format: (v) => `VIX ${(-v).toFixed(1)}`,
  },
  {
    id: 'creditAppetite',
    name: 'Credit Risk Appetite (HY Spread)',
    framework: 'Dalio',
    description:
      'Inverted ICE BofA US High-Yield Option-Adjusted Spread. Historically tight spreads mean risk premia are compressed and leverage is cheap — Dalio\'s fourth hallmark, "purchases financed by high leverage."',
    format: (v) => `OAS ${(-v).toFixed(2)}%`,
  },
  {
    id: 'monetaryStimulus',
    name: 'Monetary Backdrop (10Y Yield)',
    framework: 'Dalio',
    description:
      'Inverted 10-year Treasury yield. Lower long-term rates ease the discount-rate math that justifies speculative valuations — Dalio\'s hallmark that "stimulative monetary policy threatens to inflate the bubble further."',
    format: (v) => `10Y ${(-v).toFixed(2)}%`,
  },
  {
    id: 'volumeSurge',
    name: 'Speculative Volume Surge',
    framework: 'Dalio / Minsky',
    description:
      '20-day average trading volume in the AI basket relative to its own 252-day average. A sustained surge suggests "new buyers, who were formerly not in the market, being drawn in" — Dalio\'s sixth hallmark, and the Ponzi-finance stage of Minsky\'s cycle.',
    format: (v) => `${v.toFixed(2)}x normal volume`,
  },
]

const CATEGORY_BANDS = [
  { max: 24, label: 'Low', color: '#4ADE80' },
  { max: 44, label: 'Moderate', color: '#C9A84C' },
  { max: 64, label: 'Elevated', color: '#E8934A' },
  { max: 84, label: 'High', color: '#E8623C' },
  { max: Infinity, label: 'Extreme', color: '#E23C4E' },
]

function categoryFor(score) {
  return CATEGORY_BANDS.find((b) => score <= b.max)
}

async function main() {
  console.log('Fetching Stooq series...')
  const stooqEntries = await Promise.all(
    [...AI_BASKET, ...Object.values(STOOQ_SYMBOLS)].map(async (symbol) => {
      const csv = await fetchText(`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`)
      return [symbol, parseStooqCsv(csv)]
    })
  )
  const stooq = Object.fromEntries(stooqEntries)

  console.log('Fetching FRED series...')
  const fredEntries = await Promise.all(
    Object.entries(FRED_SERIES).map(async ([key, id]) => {
      const csv = await fetchText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`)
      return [key, parseFredCsv(csv)]
    })
  )
  const fred = Object.fromEntries(fredEntries)

  // Canonical trading-day calendar: dates present for every basket ticker.
  const calendarSets = AI_BASKET.map((sym) => new Set(stooq[sym].map((r) => r.date)))
  const referenceDates = stooq[AI_BASKET[0]].map((r) => r.date)
  const dates = referenceDates.filter((d) => calendarSets.every((s) => s.has(d)))

  if (dates.length < MIN_WARMUP_DAYS + HISTORY_MAX_DAYS / 2) {
    throw new Error(`Only ${dates.length} aligned trading days returned — data source may be degraded`)
  }

  // Equal-weighted AI basket index, rebased to 100 at the first common date.
  const basketPerTicker = AI_BASKET.map((sym) => {
    const map = toSeriesMap(stooq[sym], 'close')
    const base = map.get(dates[0])
    return dates.map((d) => (map.get(d) / base) * 100)
  })
  const basketIndex = dates.map((_, i) => basketPerTicker.reduce((sum, series) => sum + series[i], 0) / AI_BASKET.length)

  const volumePerTicker = AI_BASKET.map((sym) => {
    const map = toSeriesMap(stooq[sym], 'volume')
    return dates.map((d) => map.get(d) ?? null)
  })
  const basketVolume = dates.map((_, i) => {
    const vals = volumePerTicker.map((series) => series[i]).filter((v) => v !== null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null
  })

  const rutMap = toSeriesMap(stooq[STOOQ_SYMBOLS.rut], 'close')
  const rutAligned = alignToCalendar(dates, rutMap)
  const vixMap = toSeriesMap(stooq[STOOQ_SYMBOLS.vix], 'close')
  const vixAligned = alignToCalendar(dates, vixMap)
  const hySpreadAligned = alignToCalendar(dates, toSeriesMap(fred.hySpread, 'value'))
  const dgs10Aligned = alignToCalendar(dates, toSeriesMap(fred.dgs10, 'value'))

  const rutBase = rutAligned.find((v) => v !== null)
  const rutIndex = rutAligned.map((v) => (v !== null && rutBase ? (v / rutBase) * 100 : null))

  // Raw indicator values per day, then no-lookahead expanding percentile ranks.
  const trackers = Object.fromEntries(INDICATOR_DEFS.map((d) => [d.id, makeExpandingPercentileTracker()]))
  const rawSeries = Object.fromEntries(INDICATOR_DEFS.map((d) => [d.id, new Array(dates.length).fill(null)]))
  const scoreSeries = Object.fromEntries(INDICATOR_DEFS.map((d) => [d.id, new Array(dates.length).fill(null)]))

  for (let i = 0; i < dates.length; i++) {
    if (i >= MOMENTUM_LOOKBACK) {
      rawSeries.momentum[i] = basketIndex[i] / basketIndex[i - MOMENTUM_LOOKBACK] - 1
    }
    const trendMa = sma(basketIndex, TREND_WINDOW, i)
    if (trendMa) rawSeries.trendExtension[i] = basketIndex[i] / trendMa - 1
    if (i >= BREADTH_LOOKBACK && rutIndex[i] !== null && rutIndex[i - BREADTH_LOOKBACK] !== null) {
      const aiRet = basketIndex[i] / basketIndex[i - BREADTH_LOOKBACK] - 1
      const rutRet = rutIndex[i] / rutIndex[i - BREADTH_LOOKBACK] - 1
      rawSeries.concentration[i] = aiRet - rutRet
    }
    if (vixAligned[i] !== null) rawSeries.complacency[i] = -vixAligned[i]
    if (hySpreadAligned[i] !== null) rawSeries.creditAppetite[i] = -hySpreadAligned[i]
    if (dgs10Aligned[i] !== null) rawSeries.monetaryStimulus[i] = -dgs10Aligned[i]
    const volShort = sma(basketVolume, VOLUME_SHORT, i)
    const volLong = sma(basketVolume, VOLUME_LONG, i)
    if (volShort && volLong) rawSeries.volumeSurge[i] = volShort / volLong

    for (const def of INDICATOR_DEFS) {
      scoreSeries[def.id][i] = trackers[def.id](rawSeries[def.id][i])
    }
  }

  const compositeSeries = dates.map((_, i) => {
    const scoresToday = INDICATOR_DEFS.map((d) => scoreSeries[d.id][i]).filter((v) => v !== null)
    if (scoresToday.length < INDICATOR_DEFS.length) return null
    return scoresToday.reduce((a, b) => a + b, 0) / scoresToday.length
  })

  const lastIdx = dates.length - 1
  const asOf = dates[lastIdx]

  const latestIndicators = INDICATOR_DEFS.map((def) => {
    const raw = rawSeries[def.id][lastIdx]
    const score = scoreSeries[def.id][lastIdx]
    return {
      id: def.id,
      name: def.name,
      framework: def.framework,
      description: def.description,
      score: score === null ? null : Number(score.toFixed(1)),
      rawValue: raw,
      rawFormatted: raw === null ? 'n/a' : def.format(raw),
    }
  })

  const compositeScore = compositeSeries[lastIdx]
  const composite = compositeScore === null ? null : Number(compositeScore.toFixed(1))
  const category = composite === null ? null : categoryFor(composite)

  const latest = {
    asOf,
    generatedAt: new Date().toISOString(),
    compositeScore: composite,
    category: category?.label ?? null,
    categoryColor: category?.color ?? null,
    indicators: latestIndicators,
    basket: AI_BASKET.map((s) => s.replace('.us', '').toUpperCase()),
    methodologyNote:
      "Composite score is the equal-weighted average of the percentile ranks below, each computed against its own trailing history up to that day (no lookahead). It is a simplified, transparent proxy inspired by Ray Dalio's six classic bubble hallmarks, Robert Shiller's work on valuation extremes and market narratives, and Hyman Minsky's financial instability hypothesis — it is not Dalio's proprietary bubble gauge, not a trading signal, and not investment advice. One hallmark Dalio names — buyers making unusually extended forward purchases for speculation or hedging, e.g. hyperscaler AI-capex commitments running far ahead of current revenue — has no free daily data feed and is intentionally left out of the composite; track it via quarterly hyperscaler earnings instead.",
    dataSources: [
      'Stooq.com daily equity & index prices (NVDA, MSFT, GOOGL, AMZN, META, AVGO, ORCL, VIX, Russell 2000)',
      'FRED: ICE BofA US High Yield Index Option-Adjusted Spread (BAMLH0A0HYM2)',
      'FRED: 10-Year Treasury Constant Maturity Rate (DGS10)',
    ],
  }

  const historyStart = Math.max(0, dates.length - HISTORY_MAX_DAYS)
  const history = {
    series: dates.slice(historyStart).map((date, offset) => {
      const i = historyStart + offset
      const c = compositeSeries[i]
      return {
        date,
        compositeScore: c === null ? null : Number(c.toFixed(1)),
        indicatorScores: Object.fromEntries(
          INDICATOR_DEFS.map((def) => [def.id, scoreSeries[def.id][i] === null ? null : Number(scoreSeries[def.id][i].toFixed(1))])
        ),
      }
    }),
  }

  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(path.join(DATA_DIR, 'latest.json'), JSON.stringify(latest, null, 2) + '\n')
  await fs.writeFile(path.join(DATA_DIR, 'history.json'), JSON.stringify(history, null, 2) + '\n')

  console.log(`Wrote data for ${asOf}: composite score ${composite} (${category?.label})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
