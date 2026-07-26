/**
 * Preact signals + a SCU patch.
 *
 * Stock @preact/signals installs a shouldComponentUpdate that, on older Preact
 * builds, treats the hooks-pending bit as a reason to *bail* unless a signal
 * dirty bit is also set. That freezes useState, route changes, modals, inbox,
 * etc. — navigation looks like it "sometimes won't switch pages".
 *
 * We replace SCU with an always-update implementation. Signal subscriptions
 * still drive targeted updates; this only stops false bails.
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
  untracked,
} from '../../vendor/signals.module.js';

// Always allow updates. The stock signals SCU falsely skips renders on this
// Preact build (tabs/subtabs appear stuck until a full reload).
Component.prototype.shouldComponentUpdate = function () {
  return true;
};
