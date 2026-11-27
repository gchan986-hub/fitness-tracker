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

/**
 * Plays tones as a square wave at high pitch through a compressor: much louder on a phone speaker than a soft
 * sine beep, without distorting.
 */
function playTones(tones: Tone[], level = 0.9): void {
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
    osc.type = 'square'
    osc.frequency.value = tone.freq
    const start = t0 + tone.at
    const end = start + tone.dur
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(level, start + 0.01)
    gain.gain.setValueAtTime(level, end - 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)
    osc.connect(gain).connect(out)
    osc.start(start)
    osc.stop(end + 0.02)
  }
}

/** "Rest over": beep-beep-BEEEP (about 1 s), plus a vibration where supported. */
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
      { freq: 2093, at: 0, dur: 0.15 },
      { freq: 2093, at: 0.25, dur: 0.15 },
      { freq: 2637, at: 0.5, dur: 0.45 },
    ])
  } catch {
    /* no sound available */
  }
}

/** Short pip for the last 3 seconds of rest. */
export function countdownPip(sound: boolean): void {
  if (!sound) return
  try {
    playTones([{ freq: 1568, at: 0, dur: 0.08 }], 0.6)
  } catch {
    /* no sound available */
  }
}

/** For the Settings "Test sound" button (a tap, so it can also unlock audio on iPhone). */
export function testRestAlert(): void {
  unlockAudio()
  restOverAlert(true)
}
