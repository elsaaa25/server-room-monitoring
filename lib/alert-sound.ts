"use client"

let sharedAudioContext: AudioContext | null = null

function getAudioContext() {
  if (typeof window === "undefined") {
    return null
  }

  const AudioContextConstructor =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext
      }
    ).webkitAudioContext

  if (!AudioContextConstructor) {
    return null
  }

  sharedAudioContext ??= new AudioContextConstructor()

  return sharedAudioContext
}

async function ensureAudioContext() {
  const context = getAudioContext()

  if (!context) {
    throw new Error("Browser tidak mendukung Web Audio API.")
  }

  if (context.state === "suspended") {
    await context.resume()
  }

  return context
}

function createTone(
  context: AudioContext,
  startAt: number,
  duration: number,
  frequency: number,
  volume: number,
) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = "square"
  oscillator.frequency.setValueAtTime(frequency, startAt)

  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02)
  gain.gain.setValueAtTime(volume, startAt + Math.max(duration - 0.04, 0.03))
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  oscillator.connect(gain)
  gain.connect(context.destination)

  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.02)
}

export async function playAlertSound(
  mode: "preview" | "danger" = "danger",
) {
  const context = await ensureAudioContext()
  const now = context.currentTime + 0.03

  if (mode === "preview") {
    createTone(context, now, 0.16, 880, 0.08)
    createTone(context, now + 0.22, 0.16, 1175, 0.08)
    return
  }

  const pattern = [
    { offset: 0, frequency: 880 },
    { offset: 0.25, frequency: 1175 },
    { offset: 0.5, frequency: 880 },
    { offset: 0.75, frequency: 1175 },
    { offset: 1.0, frequency: 880 },
    { offset: 1.25, frequency: 1175 },
  ]

  for (const tone of pattern) {
    createTone(
      context,
      now + tone.offset,
      0.18,
      tone.frequency,
      0.12,
    )
  }
}