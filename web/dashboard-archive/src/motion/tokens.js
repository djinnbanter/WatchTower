export const DUR = { 1: 90, 2: 140, 3: 220, 4: 320, 5: 480 };

export const EASE = {
  out: 'cubic-bezier(.22,1,.36,1)',
  exp: 'cubic-bezier(.16,1,.3,1)',
  inout: 'cubic-bezier(.65,0,.35,1)',
  spring: 'cubic-bezier(.34,1.56,.64,1)',
};

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
