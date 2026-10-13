
// ── AstraPulse 3D Scene — Shared Constants ───────────────────────
// Three.js MIT License © 2010-2024 mrdoob and three.js authors
// R3F MIT License © 2018-2024 Paul Henschel / Poimandres

export const COLORS = {
  core:        0x4da6ff,  // blue
  coreGlow:    0x1a5cc8,
  ring:        0x4dd9d4,  // cyan
  ringGlow:    0x0d8e8a,
  healthy:     0x4ecb91,  // green
  degraded:    0xe8b84d,  // amber
  offline:     0xf07070,  // red
  purple:      0x9b7ce8,
  bg:          0x060c16,
  particle:    0x7fd4ff,
  link:        0x2a5a8a,
  linkActive:  0x4da6ff,
  pulse:       0x4dd9d4,
  selected:    0x9b7ce8,
};

// Worker ring radius from center
export const RING_RADIUS = 5.5;

// Angular positions for up to 8 workers (evenly spaced)
export function workerAngle(index, total) {
  return (index / total) * Math.PI * 2 - Math.PI / 2;
}

// Worker 3D position on a ring
export function workerPosition(index, total, radius = RING_RADIUS) {
  const angle = workerAngle(index, total);
  return [
    Math.cos(angle) * radius,
    (index % 2 === 0 ? 0.3 : -0.3), // slight vertical variation
    Math.sin(angle) * radius,
  ];
}

// Map health → color
export function healthColor(status) {
  if (status === "healthy")  return COLORS.healthy;
  if (status === "degraded") return COLORS.degraded;
  return COLORS.offline;
}

// Queue pressure 0..1
export function queuePressure(worker) {
  const cap = Number(worker.capacity) || 1;
  const q   = Number(worker.queued_requests) || 0;
  return Math.min(q / cap, 1);
}
