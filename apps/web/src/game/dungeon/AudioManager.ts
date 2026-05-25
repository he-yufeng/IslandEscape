// ============================================================
// Island Escape — Audio Manager (Web Audio API chiptune SFX)
// ============================================================

let audioCtx: AudioContext | null = null
let bgmPlaying = false
let bgmGain: GainNode | null = null
let bgmOscillators: OscillatorNode[] = []

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

function ensureResumed() {
  const ctx = getCtx()
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
}

// ---- Helpers ----

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = 'square',
  volume = 0.12,
  freqEnd?: number,
  delay = 0,
) {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay)
  if (freqEnd) {
    osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + delay + duration)
  }
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(ctx.currentTime + delay)
  osc.stop(ctx.currentTime + delay + duration)
}

function playNoise(duration: number, volume = 0.08) {
  const ctx = getCtx()
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize)
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  source.connect(gain)
  gain.connect(ctx.destination)
  source.start()
}

// ---- SFX ----

export function playShoot() {
  ensureResumed()
  playTone(800, 0.06, 'square', 0.06, 200)
}

export function playFlash() {
  ensureResumed()
  playTone(300, 0.2, 'sawtooth', 0.08, 1200)
  playTone(600, 0.15, 'square', 0.04, 100, 0.05)
}

export function playUltimate() {
  ensureResumed()
  playTone(200, 0.5, 'sawtooth', 0.1, 1600)
  for (let i = 0; i < 5; i++) {
    playTone(600 + i * 200, 0.08, 'square', 0.05, 0, i * 0.08)
  }
}

export function playBossHit() {
  ensureResumed()
  playNoise(0.04, 0.06)
  playTone(120, 0.1, 'triangle', 0.08, 60)
}

export function playPlayerHit() {
  ensureResumed()
  playNoise(0.08, 0.1)
  playTone(200, 0.15, 'square', 0.1, 80)
}

export function playBossShoot() {
  ensureResumed()
  playTone(600, 0.08, 'sawtooth', 0.05, 150)
  playTone(400, 0.1, 'square', 0.04, 100, 0.04)
}

export function playCardPick() {
  ensureResumed()
  playTone(523, 0.1, 'square', 0.08, 0, 0)
  playTone(659, 0.1, 'square', 0.08, 0, 0.08)
  playTone(784, 0.15, 'square', 0.08, 0, 0.16)
}

export function playXPCollect() {
  ensureResumed()
  playTone(1200, 0.03, 'sine', 0.04, 1600)
}

export function playBossDefeated() {
  ensureResumed()
  const notes = [523, 659, 784, 1047]
  notes.forEach((f, i) => {
    playTone(f, 0.2, 'square', 0.1, 0, i * 0.15)
  })
}

export function playPlayerDied() {
  ensureResumed()
  const notes = [392, 349, 311, 261]
  notes.forEach((f, i) => {
    playTone(f, 0.25, 'triangle', 0.08, 0, i * 0.2)
  })
}

// ---- BGM ----

type BGMTrack = 'none' | 'island' | 'dungeon'
let currentTrack: BGMTrack = 'none'
let bgmTimeout: ReturnType<typeof setTimeout> | null = null

// Island: cheerful major-key melody, relaxed tempo
const ISLAND_MELODY = [
  392, 440, 523, 392, 440, 523, 587, 523,
  440, 392, 349, 330, 294, 330, 349, 392,
  392, 440, 523, 587, 659, 587, 523, 440,
  392, 349, 330, 294, 262, 294, 330, 262,
]
const ISLAND_BASS = [196, 196, 261, 261, 220, 220, 175, 175,
  196, 196, 261, 261, 220, 220, 175, 175]
const ISLAND_NOTE_LEN = 0.22

// Dungeon: tense minor-key, faster tempo, driving bass
const DUNGEON_MELODY = [
  175, 196, 233, 196, 175, 233, 262, 233,
  196, 233, 262, 311, 262, 233, 196, 175,
  175, 196, 233, 262, 311, 262, 233, 196,
  233, 262, 311, 349, 311, 262, 233, 196,
]
const DUNGEON_BASS = [87, 87, 87, 98, 98, 98, 117, 117,
  87, 87, 87, 98, 98, 98, 117, 78]
const DUNGEON_NOTE_LEN = 0.18

function scheduleBGMLoop() {
  const ctx = getCtx()
  if (!bgmPlaying || currentTrack === 'none') return

  let melody: number[]
  let bass: number[]
  let noteLen: number
  let melodyVol: number
  let bassVol: number
  let melodyType: OscillatorType
  let bassType: OscillatorType
  let drumPattern: boolean

  if (currentTrack === 'island') {
    melody = ISLAND_MELODY
    bass = ISLAND_BASS
    noteLen = ISLAND_NOTE_LEN
    melodyVol = 0.025
    bassVol = 0.04
    melodyType = 'sine'
    bassType = 'triangle'
    drumPattern = false
  } else {
    melody = DUNGEON_MELODY
    bass = DUNGEON_BASS
    noteLen = DUNGEON_NOTE_LEN
    melodyVol = 0.035
    bassVol = 0.06
    melodyType = 'sawtooth'
    bassType = 'sawtooth'
    drumPattern = true
  }

  const now = ctx.currentTime
  const loopDuration = melody.length * noteLen

  for (let i = 0; i < melody.length; i++) {
    const t = now + i * noteLen
    const freq = melody[i]!

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = melodyType
    osc.frequency.value = freq
    gain.gain.setValueAtTime(melodyVol, t)
    gain.gain.setValueAtTime(melodyVol, t + noteLen * 0.7)
    gain.gain.exponentialRampToValueAtTime(0.001, t + noteLen)
    osc.connect(gain)
    gain.connect(bgmGain!)
    osc.start(t)
    osc.stop(t + noteLen)
    bgmOscillators.push(osc)

    // Bass (every 2 notes)
    const bassIdx = Math.floor(i / 2)
    if (i % 2 === 0 && bassIdx < bass.length) {
      const bassOsc = ctx.createOscillator()
      const bassGainNode = ctx.createGain()
      bassOsc.type = bassType
      bassOsc.frequency.value = bass[bassIdx]!
      bassGainNode.gain.setValueAtTime(bassVol, t)
      bassGainNode.gain.exponentialRampToValueAtTime(0.001, t + noteLen * 2)
      bassOsc.connect(bassGainNode)
      bassGainNode.connect(bgmGain!)
      bassOsc.start(t)
      bassOsc.stop(t + noteLen * 2)
      bgmOscillators.push(bassOsc)
    }

    // Dungeon drum: kick on beats
    if (drumPattern && i % 4 === 0) {
      const noiseDuration = 0.06
      const bufferSize = ctx.sampleRate * noiseDuration
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let s = 0; s < bufferSize; s++) {
        data[s] = (Math.random() * 2 - 1) * Math.exp(-s / (ctx.sampleRate * 0.015))
      }
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const drumGain = ctx.createGain()
      drumGain.gain.setValueAtTime(0.06, t)
      drumGain.gain.exponentialRampToValueAtTime(0.001, t + noiseDuration)
      source.connect(drumGain)
      drumGain.connect(bgmGain!)
      source.start(t)
      bgmOscillators.push(source as unknown as OscillatorNode)
    }

    // Dungeon hi-hat: noise on off-beats
    if (drumPattern && i % 2 === 1) {
      const hhDuration = 0.03
      const hhBuffer = ctx.createBuffer(1, ctx.sampleRate * hhDuration, ctx.sampleRate)
      const hhData = hhBuffer.getChannelData(0)
      for (let s = 0; s < hhBuffer.length; s++) {
        hhData[s] = (Math.random() * 2 - 1) * Math.exp(-s / (ctx.sampleRate * 0.005))
      }
      const hhSource = ctx.createBufferSource()
      hhSource.buffer = hhBuffer
      const hhGain = ctx.createGain()
      hhGain.gain.setValueAtTime(0.03, t)
      hhGain.gain.exponentialRampToValueAtTime(0.001, t + hhDuration)
      hhSource.connect(hhGain)
      hhGain.connect(bgmGain!)
      hhSource.start(t)
      bgmOscillators.push(hhSource as unknown as OscillatorNode)
    }
  }

  bgmTimeout = setTimeout(() => {
    scheduleBGMLoop()
  }, loopDuration * 1000 - 100)
}

function startTrack(track: BGMTrack) {
  if (currentTrack === track) return
  stopBGM()
  ensureResumed()
  const ctx = getCtx()
  currentTrack = track
  bgmGain = ctx.createGain()
  bgmGain.gain.value = track === 'island' ? 0.4 : 0.55
  bgmGain.connect(ctx.destination)
  bgmPlaying = true
  scheduleBGMLoop()
}

export function startBGM() { startTrack('dungeon') }
export function startDungeonBGM() { startTrack('dungeon') }
export function startIslandBGM() { startTrack('island') }

export function stopBGM() {
  bgmPlaying = false
  currentTrack = 'none'
  if (bgmTimeout) {
    clearTimeout(bgmTimeout)
    bgmTimeout = null
  }
  for (const osc of bgmOscillators) {
    try { osc.stop() } catch { /* already stopped */ }
  }
  bgmOscillators = []
  if (bgmGain) {
    bgmGain.disconnect()
    bgmGain = null
  }
}
