/** Rest timer settings, persistence and the "rest over" alert. */

export const REST_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300]
export const DEFAULT_REST_SEC = 90

export interface RestState {
  /** Epoch ms when the rest ends. Using an end time keeps the countdown right after the app was in the background. */
  endAt: number
  /** Total length, for the progress bar. */
  totalSec: number
}

const SEC_KEY = 'fitness-tracker:rest-sec'
const SOUND_KEY = 'fitness-tracker:rest-sound'
const STATE_KEY = 'fitness-tracker:rest'

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* preference just won't persist */
  }
}

export function readRestSec(): number {
  const n = Number(read(SEC_KEY))
  return REST_OPTIONS.includes(n) ? n : DEFAULT_REST_SEC
}
export const saveRestSec = (sec: number) => write(SEC_KEY, String(sec))

export const readRestSound = (): boolean => read(SOUND_KEY) !== 'off'
export const saveRestSound = (on: boolean) => write(SOUND_KEY, on ? 'on' : 'off')

const FLASH_KEY = 'fitness-tracker:rest-flash'
export const readRestFlash = (): boolean => read(FLASH_KEY) !== 'off'
export const saveRestFlash = (on: boolean) => write(FLASH_KEY, on ? 'on' : 'off')

/** A running timer from before the app was closed, if it hasn't long finished. */
export function readRestState(now = Date.now()): RestState | null {
  try {
    const v = JSON.parse(read(STATE_KEY) ?? 'null') as RestState | null
    return v && typeof v.endAt === 'number' && typeof v.totalSec === 'number' && v.endAt > now - 15_000 ? v : null
  } catch {
    return null
  }
}
export const saveRestState = (s: RestState | null) => write(STATE_KEY, s ? JSON.stringify(s) : null)

type AudioCtor = typeof AudioContext
let audio: AudioContext | undefined

/** Must run inside a tap: iPhone only allows sound from audio that was started by the user. */
export function unlockAudio(): void {
  try {
    const AC = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext) as
      | AudioCtor
      | undefined
    if (!AC) return
    audio ??= new AC()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    /* no sound available */
  }
}

interface Tone {
  freq: number
  /** Seconds from now. */
  at: number
  dur: number
}

/** Triangle waves sound round and bell-like but still carry on a phone speaker (a sine is too quiet, a square too harsh). */
const WAVE: OscillatorType = 'triangle'

/** Plays chime-like tones (quick attack, bell-style fade) through a compressor to keep them loud but clean. */
function playTones(tones: Tone[], level = 1): void {
  if (!audio) return
  if (audio.state === 'suspended') void audio.resume()
  const t0 = audio.currentTime + 0.01
  const out = audio.createDynamicsCompressor()
  out.threshold.value = -12
  out.ratio.value = 6
  out.connect(audio.destination)
  for (const tone of tones) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = WAVE
    osc.frequency.value = tone.freq
    const start = t0 + tone.at
    const end = start + tone.dur
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(level, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(level * 0.35, start + tone.dur * 0.45)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)
    osc.connect(gain).connect(out)
    osc.start(start)
    osc.stop(end + 0.02)
  }
}

/** "Rest over": a rising three-note chime (about 1.2 s), plus a vibration where supported. */
export function restOverAlert(sound: boolean, vibrate = true): void {
  if (vibrate) {
    try {
      navigator.vibrate?.([300, 150, 300, 150, 500])
    } catch {
      /* not supported */
    }
  }
  if (!sound) return
  try {
    playTones([
      { freq: 1319, at: 0, dur: 0.35 },
      { freq: 1568, at: 0.22, dur: 0.35 },
      { freq: 2093, at: 0.44, dur: 0.8 },
    ])
  } catch {
    /* no sound available */
  }
}

/** Short pip for the last 3 seconds of rest. */
export function countdownPip(sound: boolean): void {
  if (!sound) return
  try {
    playTones([{ freq: 1047, at: 0, dur: 0.15 }], 0.7)
  } catch {
    /* no sound available */
  }
}

/** For the Settings "Test sound" button (a tap, so it can also unlock audio on iPhone). */
export function testRestAlert(): void {
  unlockAudio()
  restOverAlert(true)
}
