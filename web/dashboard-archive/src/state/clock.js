import { signal } from '../lib/signals.js';

export const now = signal(Date.now());

let _timer = null;

export function startClock() {
  if (_timer !== null) return;
  _timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
}

export function stopClock() {
  if (_timer !== null) {
    clearInterval(_timer);
    _timer = null;
  }
}
