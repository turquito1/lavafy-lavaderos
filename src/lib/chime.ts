/**
 * Sonido corto para avisar un turno nuevo (Web Audio, sin archivos).
 * Los navegadores solo dejan reproducir audio después de que el usuario tocó la página,
 * por eso "desbloqueamos" el contexto en el primer toque.
 */
let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* navegador sin Web Audio */
  }
}

export function playChime() {
  if (!ctx || ctx.state !== "running") return;
  const start = ctx.currentTime;
  [880, 1318.5].forEach((freq, i) => {
    const t = start + i * 0.18;
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  });
}
