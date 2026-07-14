import { DUR } from './tokens.js';

/** Delay in ms for staggered enter animations (30ms per index). */
export function staggerDelay(index) {
  return index * 30;
}

export const pageEnterClass = 'ui-enter';
export const pageExitClass = 'ui-exit';
export const pressableClass = 'ui-pressable';
export const livePulseClass = 'ui-live-pulse';
export const staggerClass = 'ui-stagger';

export function staggerStyle(index) {
  return { '--ui-stagger-index': String(index) };
}

export function enterTransition(durationMs = DUR[3]) {
  return `opacity ${durationMs}ms var(--ui-ease-exp), transform ${durationMs}ms var(--ui-ease-exp)`;
}

export function exitTransition(durationMs = DUR[2]) {
  return `opacity ${durationMs}ms var(--ui-ease-out)`;
}
