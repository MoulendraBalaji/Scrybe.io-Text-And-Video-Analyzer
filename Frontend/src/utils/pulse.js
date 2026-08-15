/* ============================================================
   pulse — shared signal math for the Pulse Orb.
   A 0..1 confidence reading from telemetry (brightness, contrast,
   edge density, info rate) blended with model confidence.
   ============================================================ */

export function orbSignal(telemetry = {}, confidence = 0.5) {
  const b = telemetry.brightness ?? 50;
  const c = telemetry.contrast ?? 50;
  const e = telemetry.edge_density ?? 50;
  const info = telemetry.info_rate ?? 50;
  return Math.max(0, Math.min(1, ((b + c + e + info) / 400) * 0.65 + confidence * 0.35));
}
