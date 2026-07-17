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

function createMasterOutput(
  context: AudioContext,
  volume: number,
) {
  const masterGain = context.createGain()
  const compressor =
    context.createDynamicsCompressor()

  /*
   * Compressor membuat suara terasa lebih padat
   * dan keras tanpa mudah pecah.
   */
  compressor.threshold.setValueAtTime(
    -24,
    context.currentTime,
  )
  compressor.knee.setValueAtTime(
    12,
    context.currentTime,
  )
  compressor.ratio.setValueAtTime(
    12,
    context.currentTime,
  )
  compressor.attack.setValueAtTime(
    0.003,
    context.currentTime,
  )
  compressor.release.setValueAtTime(
    0.2,
    context.currentTime,
  )

  masterGain.gain.setValueAtTime(
    volume,
    context.currentTime,
  )

  masterGain.connect(compressor)
  compressor.connect(context.destination)

  return masterGain
}

function createEmergencySiren(
  context: AudioContext,
  output: AudioNode,
  startTime: number,
  duration: number,
) {
  /*
   * Lapisan pertama:
   * suara sirene utama naik dan turun.
   */
  const mainOscillator =
    context.createOscillator()
  const mainGain = context.createGain()

  mainOscillator.type = "sawtooth"

  mainOscillator.frequency.setValueAtTime(
    650,
    startTime,
  )
  mainOscillator.frequency.exponentialRampToValueAtTime(
    1550,
    startTime + duration / 2,
  )
  mainOscillator.frequency.exponentialRampToValueAtTime(
    650,
    startTime + duration,
  )

  mainGain.gain.setValueAtTime(
    0.0001,
    startTime,
  )
  mainGain.gain.exponentialRampToValueAtTime(
    0.55,
    startTime + 0.03,
  )
  mainGain.gain.setValueAtTime(
    0.55,
    startTime + duration - 0.05,
  )
  mainGain.gain.exponentialRampToValueAtTime(
    0.0001,
    startTime + duration,
  )

  mainOscillator.connect(mainGain)
  mainGain.connect(output)

  /*
   * Lapisan kedua:
   * frekuensi tambahan agar sirene terdengar
   * lebih tajam dan mendesak.
   */
  const highOscillator =
    context.createOscillator()
  const highGain = context.createGain()

  highOscillator.type = "square"

  highOscillator.frequency.setValueAtTime(
    900,
    startTime,
  )
  highOscillator.frequency.exponentialRampToValueAtTime(
    1900,
    startTime + duration / 2,
  )
  highOscillator.frequency.exponentialRampToValueAtTime(
    900,
    startTime + duration,
  )

  highGain.gain.setValueAtTime(
    0.0001,
    startTime,
  )
  highGain.gain.exponentialRampToValueAtTime(
    0.22,
    startTime + 0.03,
  )
  highGain.gain.setValueAtTime(
    0.22,
    startTime + duration - 0.05,
  )
  highGain.gain.exponentialRampToValueAtTime(
    0.0001,
    startTime + duration,
  )

  highOscillator.connect(highGain)
  highGain.connect(output)

  /*
   * Lapisan ketiga:
   * suara rendah supaya alarm terasa lebih berat.
   */
  const lowOscillator =
    context.createOscillator()
  const lowGain = context.createGain()

  lowOscillator.type = "square"

  lowOscillator.frequency.setValueAtTime(
    320,
    startTime,
  )
  lowOscillator.frequency.linearRampToValueAtTime(
    520,
    startTime + duration / 2,
  )
  lowOscillator.frequency.linearRampToValueAtTime(
    320,
    startTime + duration,
  )

  lowGain.gain.setValueAtTime(
    0.0001,
    startTime,
  )
  lowGain.gain.exponentialRampToValueAtTime(
    0.18,
    startTime + 0.03,
  )
  lowGain.gain.setValueAtTime(
    0.18,
    startTime + duration - 0.05,
  )
  lowGain.gain.exponentialRampToValueAtTime(
    0.0001,
    startTime + duration,
  )

  lowOscillator.connect(lowGain)
  lowGain.connect(output)

  mainOscillator.start(startTime)
  highOscillator.start(startTime)
  lowOscillator.start(startTime)

  mainOscillator.stop(
    startTime + duration + 0.03,
  )
  highOscillator.stop(
    startTime + duration + 0.03,
  )
  lowOscillator.stop(
    startTime + duration + 0.03,
  )
}

function createEmergencyBeep(
  context: AudioContext,
  output: AudioNode,
  startTime: number,
  frequency: number,
  duration = 0.22,
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
    0.5,
    startTime + 0.015,
  )
  gain.gain.setValueAtTime(
    0.5,
    startTime + duration - 0.03,
  )
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    startTime + duration,
  )

  oscillator.connect(gain)
  gain.connect(output)

  oscillator.start(startTime)
  oscillator.stop(
    startTime + duration + 0.02,
  )
}

export async function playAlertSound(
  mode: "preview" | "danger" = "danger",
) {
  const context =
    await prepareAudioContext()

  const startTime =
    context.currentTime + 0.05

  if (mode === "preview") {
    /*
     * Tes suara saat toggle diaktifkan.
     * Dibuat cukup keras tetapi lebih singkat.
     */
    const output = createMasterOutput(
      context,
      0.8,
    )

    createEmergencySiren(
      context,
      output,
      startTime,
      1.5,
    )

    createEmergencyBeep(
      context,
      output,
      startTime + 1.65,
      1450,
    )

    createEmergencyBeep(
      context,
      output,
      startTime + 1.95,
      1450,
    )

    return
  }

  /*
   * Alarm Bahaya:
   * sekitar 9 detik dengan pola sirene
   * naik-turun yang berulang.
   */
  const output = createMasterOutput(
    context,
    0.95,
  )

  const sirenDuration = 1.15
  const pauseDuration = 0.08
  const sirenCount = 7

  for (
    let index = 0;
    index < sirenCount;
    index += 1
  ) {
    const sirenStart =
      startTime +
      index *
        (sirenDuration + pauseDuration)

    createEmergencySiren(
      context,
      output,
      sirenStart,
      sirenDuration,
    )
  }

  /*
   * Bunyi penutup cepat untuk menegaskan
   * keadaan darurat.
   */
  const beepStart =
    startTime +
    sirenCount *
      (sirenDuration + pauseDuration) +
    0.1

  for (
    let index = 0;
    index < 5;
    index += 1
  ) {
    createEmergencyBeep(
      context,
      output,
      beepStart + index * 0.3,
      index % 2 === 0 ? 1500 : 1100,
      0.22,
    )
  }
}