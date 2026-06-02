import { computed } from 'vue'

// ── Constants ──────────────────────────────────────────────
const FS = 48000

const FREQ_MIN = 20
const FREQ_MAX = 20000
const GAIN_MIN = -15
const GAIN_MAX = 15

// SVG layout
const PL = 34
const PR = 8
const PT = 12
const PB = 30
const SVG_W = 700
const SVG_H = 420
const PW = SVG_W - PL - PR
const PH = SVG_H - PT - PB

// ── Frequency/Gain coordinate conversion ────────────────────
export function freqToX(f) {
  return (Math.log10(Math.max(FREQ_MIN, f) / FREQ_MIN) / Math.log10(FREQ_MAX / FREQ_MIN)) * PW
}

export function gainToY(g) {
  return (1 - (g - GAIN_MIN) / (GAIN_MAX - GAIN_MIN)) * PH
}

export function xToFreq(x) {
  return (
    FREQ_MIN * Math.pow(10, (Math.max(0, Math.min(PW, x)) / PW) * Math.log10(FREQ_MAX / FREQ_MIN))
  )
}

export function yToGain(y) {
  return GAIN_MAX - (Math.max(0, Math.min(PH, y)) / PH) * (GAIN_MAX - GAIN_MIN)
}

// ── Biquad filter coefficients ──────────────────────────────
export function shelfCoeffs(type, freq, gainDb, q) {
  const A = Math.pow(10, gainDb / 40)
  const w0 = (2 * Math.PI * Math.min(freq, FS * 0.499)) / FS
  const cosW = Math.cos(w0)
  const sinW = Math.sin(w0)
  const sqA = Math.sqrt(Math.max(0, A))
  const S = Math.max(0.1, q)
  const al = (sinW / 2) * Math.sqrt(Math.max(0, (A + 1 / A) * (1 / S - 1) + 2))

  let b0, b1, b2, a0, a1, a2

  if (type === 'low_shelf') {
    b0 = A * (A + 1 - (A - 1) * cosW + 2 * sqA * al)
    b1 = 2 * A * (A - 1 - (A + 1) * cosW)
    b2 = A * (A + 1 - (A - 1) * cosW - 2 * sqA * al)
    a0 = A + 1 + (A - 1) * cosW + 2 * sqA * al
    a1 = -2 * (A - 1 + (A + 1) * cosW)
    a2 = A + 1 + (A - 1) * cosW - 2 * sqA * al
  } else {
    b0 = A * (A + 1 + (A - 1) * cosW + 2 * sqA * al)
    b1 = -2 * A * (A - 1 + (A + 1) * cosW)
    b2 = A * (A + 1 + (A - 1) * cosW - 2 * sqA * al)
    a0 = A + 1 - (A - 1) * cosW + 2 * sqA * al
    a1 = 2 * (A - 1 - (A + 1) * cosW)
    a2 = A + 1 - (A - 1) * cosW - 2 * sqA * al
  }

  if (Math.abs(a0) < 1e-10) return null
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
}

export function peakCoeffs(freq, gainDb, q) {
  const A = Math.pow(10, gainDb / 40)
  const w0 = (2 * Math.PI * Math.min(freq, FS * 0.499)) / FS
  const cosW = Math.cos(w0)
  const sinW = Math.sin(w0)
  const alpha = sinW / (2 * Math.max(0.01, q))
  const b0 = 1 + alpha * A
  const b1 = -2 * cosW
  const b2 = 1 - alpha * A
  const a0 = 1 + alpha / A
  const a1 = -2 * cosW
  const a2 = 1 - alpha / A

  if (Math.abs(a0) < 1e-10) return null
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
}

export function bandCoeffs(b) {
  if (b.type === 'low_shelf' || b.type === 'high_shelf')
    return shelfCoeffs(b.type, b.freq, b.gain, b.q)
  return peakCoeffs(b.freq, b.gain, b.q)
}

// ── HPF biquad (Butterworth) ───────────────────────────────
export function hpfBiquad(freq) {
  const Q = 1 / Math.sqrt(2)
  const w0 = (2 * Math.PI * Math.min(freq, FS * 0.499)) / FS
  const cosW = Math.cos(w0)
  const sinW = Math.sin(w0)
  const alpha = sinW / (2 * Q)
  const b0 = (1 + cosW) / 2
  const b1 = -(1 + cosW)
  const b2 = (1 + cosW) / 2
  const a0 = 1 + alpha
  const a1 = -2 * cosW
  const a2 = 1 - alpha

  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
}

// ── Frequency response magnitude ───────────────────────────
export function magSq(c, f) {
  const w = (2 * Math.PI * f) / FS
  const cw = Math.cos(w)
  const c2w = Math.cos(2 * w)
  const n =
    c.b0 * c.b0 +
    c.b1 * c.b1 +
    c.b2 * c.b2 +
    2 * (c.b0 * c.b1 + c.b1 * c.b2) * cw +
    2 * c.b0 * c.b2 * c2w
  const d = 1 + c.a1 * c.a1 + c.a2 * c.a2 + 2 * (c.a1 + c.a1 * c.a2) * cw + 2 * c.a2 * c2w
  return d > 0 ? Math.max(0, n / d) : 1
}

// ── Factory for creating curve calculation functions ────────
export function useEqCurve(bandsRef, hpfRef, bypassRef) {
  const NUM_PTS = 280

  const curvePts = computed(() => {
    const pts = []
    const coeffsList = []

    if (!bypassRef.value) {
      for (const c of getHpfCoeffsList(hpfRef)) coeffsList.push(c)
      for (const b of bandsRef.value) {
        if (!b.enabled) continue
        const c = bandCoeffs(b)
        if (c) coeffsList.push(c)
      }
    }

    for (let i = 0; i <= NUM_PTS; i++) {
      const f = FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, i / NUM_PTS)
      let ms = 1
      for (const c of coeffsList) ms *= magSq(c, f)
      const db = 10 * Math.log10(Math.max(1e-12, ms))
      pts.push({ x: freqToX(f), y: gainToY(Math.max(GAIN_MIN, Math.min(GAIN_MAX, db))) })
    }
    return pts
  })

  const curvePath = computed(() => {
    const pts = curvePts.value
    return pts.length
      ? 'M ' + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')
      : ''
  })

  const areaPath = computed(() => {
    const pts = curvePts.value
    if (!pts.length) return ''
    const zY = gainToY(0).toFixed(1)
    const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')
    return `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L ${line} L ${pts[pts.length - 1].x.toFixed(1)},${zY} L ${pts[0].x.toFixed(1)},${zY} Z`
  })

  return { curvePts, curvePath, areaPath }
}

// ── Helper function for HPF coefficients ───────────────────
export function getHpfCoeffsList(hpfRef) {
  if (!hpfRef.value.enabled) return []
  const n = (hpfRef.value.slope ?? 12) / 12
  const c = hpfBiquad(hpfRef.value.freq)
  return Array(n).fill(c)
}

// ── Export constants for use in components ──────────────────
export const EQ_CONSTANTS = {
  FS,
  FREQ_MIN,
  FREQ_MAX,
  GAIN_MIN,
  GAIN_MAX,
  PL,
  PR,
  PT,
  PB,
  SVG_W,
  SVG_H,
  PW,
  PH,
}
