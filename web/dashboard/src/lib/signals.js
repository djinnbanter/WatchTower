/**
 * Preact signals + a SCU patch.
 *
 * Stock @preact/signals installs a shouldComponentUpdate that, on older Preact
 * builds, treats the hooks-pending bit as a reason to *bail* unless a signal
 * dirty bit is also set. That freezes useState, route changes, modals, inbox,
 * etc. — navigation looks like it "sometimes won't switch pages".
 *
 * Replacing SCU after the signals import restores normal updates while keeping
 * signal-driven re-renders.
 */
import { Component } from '../../vendor/preact.module.js';

export {
  signal,
  computed,
  effect,
  batch,
  useSignal,
  useComputed,
  useSignalEffect,
} from '../../vendor/signals.module.js';

Component.prototype.shouldComponentUpdate = function (props, state) {
  // forceUpdate / internal resume
  if (this.__e || this.__R) return true;
  // Signal-driven setState({}) — dirty bit set by the signals runtime
  if (this.__$f & 1) return true;
  // Class setState with a real next-state object
  if (state != null && state !== this.state) return true;
  // Hooks pending (useState / useReducer) — stock signals SCU wrongly bails here
  if (this.__$f & 2) return true;
  // Props changed
  for (const key in props) {
    if (key !== '__source' && props[key] !== this.props[key]) return true;
  }
  for (const key in this.props) {
    if (!(key in props)) return true;
  }
  return false;
};
