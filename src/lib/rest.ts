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

/** Three short beeps (if sound is on) and a vibration where supported. */
export function restOverAlert(sound: boolean): void {
  try {
    navigator.vibrate?.([250, 120, 250])
  } catch {
    /* not supported */
  }
  if (!sound || !audio) return
  try {
    const t = audio.currentTime
    for (let i = 0; i < 3; i++) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, t + i * 0.3)
      gain.gain.exponentialRampToValueAtTime(0.4, t + i * 0.3 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.3 + 0.2)
      osc.connect(gain).connect(audio.destination)
      osc.start(t + i * 0.3)
      osc.stop(t + i * 0.3 + 0.22)
    }
  } catch {
    /* no sound available */
  }
}
