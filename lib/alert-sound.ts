"use client"

let sharedAudioContext: AudioContext | null = null

type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null
  }

  const AudioContextConstructor =
    window.AudioContext ??
    (window as WindowWithWebkitAudio)
      .webkitAudioContext

  if (!AudioContextConstructor) {
    return null
  }

  if (!sharedAudioContext) {
    sharedAudioContext =
      new AudioContextConstructor()
  }

  return sharedAudioContext
}

async function prepareAudioContext() {
  const context = getAudioContext()

  if (!context) {
    throw new Error(
      "Browser tidak mendukung Web Audio API.",
    )
  }

  if (context.state === "suspended") {
    await context.resume()
  }

  return context
}

function createSirenBurst(
  context: AudioContext,
  startTime: number,
  duration: number,
  volume: number,
) {
  const oscillator =
    context.createOscillator()
  const gain = context.createGain()

  oscillator.type = "sawtooth"

  // Frekuensi sirene naik dan turun.
  oscillator.frequency.setValueAtTime(
    650,
    startTime,
  )

  oscillator.frequency.exponentialRampToValueAtTime(
    1450,
    startTime + duration / 2,
  )

  oscillator.frequency.exponentialRampToValueAtTime(
    650,
    startTime + duration,
  )

  // Suara masuk dan keluar secara halus.
  gain.gain.setValueAtTime(
    0.0001,
    startTime,
  )

  gain.gain.exponentialRampToValueAtTime(
    volume,
    startTime + 0.04,
  )

  gain.gain.setValueAtTime(
    volume,
    startTime + duration - 0.06,
  )

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    startTime + duration,
  )

  oscillator.connect(gain)
  gain.connect(context.destination)

  oscillator.start(startTime)
  oscillator.stop(startTime + duration + 0.05)
}

function createWarningBeep(
  context: AudioContext,
  startTime: number,
  frequency: number,
) {
  const oscillator =
    context.createOscillator()
  const gain = context.createGain()

  oscillator.type = "square"
  oscillator.frequency.setValueAtTime(
    frequency,
    startTime,
  )

  gain.gain.setValueAtTime(
    0.0001,
    startTime,
  )

  gain.gain.exponentialRampToValueAtTime(
    0.08,
    startTime + 0.02,
  )

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    startTime + 0.18,
  )

  oscillator.connect(gain)
  gain.connect(context.destination)

  oscillator.start(startTime)
  oscillator.stop(startTime + 0.2)
}

export async function playAlertSound(
  mode: "preview" | "danger" = "danger",
) {
  const context =
    await prepareAudioContext()

  const startTime =
    context.currentTime + 0.05

  if (mode === "preview") {
    // Tes singkat saat toggle suara diaktifkan.
    createSirenBurst(
      context,
      startTime,
      0.7,
      0.1,
    )

    createWarningBeep(
      context,
      startTime + 0.8,
      1200,
    )

    return
  }

  // Sirene bahaya selama sekitar 4 detik.
  const sirenDuration = 0.75
  const sirenCount = 5

  for (
    let index = 0;
    index < sirenCount;
    index += 1
  ) {
    createSirenBurst(
      context,
      startTime +
        index * sirenDuration,
      sirenDuration,
      0.14,
    )
  }

  // Bunyi penutup sebagai penegasan bahaya.
  const warningStart =
    startTime +
    sirenCount * sirenDuration +
    0.1

  createWarningBeep(
    context,
    warningStart,
    1350,
  )

  createWarningBeep(
    context,
    warningStart + 0.25,
    1350,
  )

  createWarningBeep(
    context,
    warningStart + 0.5,
    1350,
  )
}