"use client";

/** Tiny Web Audio chimes — no external library needed. */
let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, gain = 0.12) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  osc.connect(g).connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + dur + 0.05);
}

export function chime(kind: "tap" | "success" | "alert" | "order" = "tap") {
  if (kind === "tap") tone(660, 0, 0.12, 0.06);
  if (kind === "success") { tone(523, 0, 0.15); tone(784, 0.1, 0.25); }
  if (kind === "alert") { tone(880, 0, 0.15, 0.18); tone(1318, 0.13, 0.3, 0.18); }
  if (kind === "order") { tone(659, 0, 0.18, 0.2); tone(880, 0.16, 0.18, 0.2); tone(1046, 0.32, 0.35, 0.2); }
}

/** Call from a click handler so browsers allow sound later. */
export function unlockAudio() {
  audio();
}
