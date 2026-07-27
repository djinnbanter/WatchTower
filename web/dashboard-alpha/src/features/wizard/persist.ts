const KEY = 'wt.setupWizard';

export type SetupWizardRecord = {
  completed?: boolean;
  completedAt?: number;
  pauseReason?: string | null;
  pausedAt?: number;
  stepIdx?: number;
  discovery?: 'ok' | 'pending' | 'failed' | 'skipped';
  skipped?: boolean;
  securityDeferred?: boolean;
  [key: string]: unknown;
};

export type SetupWizardState = SetupWizardRecord | boolean | null;

function readRaw(): SetupWizardState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return null;
    return JSON.parse(raw) as SetupWizardState;
  } catch {
    return null;
  }
}

export function readSetupWizard(): SetupWizardRecord | null {
  const raw = readRaw();
  if (raw == null || typeof raw === 'boolean') return raw === true ? { completed: true } : null;
  return raw;
}

export function isSetupWizardComplete(wiz: SetupWizardState = readRaw()): boolean {
  if (wiz == null) return false;
  if (typeof wiz === 'boolean') return wiz;
  return wiz.completed === true;
}

/** Full-screen wizard only when never started (or after relaunch cleared storage). */
export function shouldShowSetupWizard(wiz: SetupWizardState = readRaw()): boolean {
  return wiz == null;
}

export function isSetupWizardPaused(wiz: SetupWizardState = readRaw()): boolean {
  if (wiz == null || typeof wiz === 'boolean') return false;
  return wiz.completed !== true;
}

export function completeSetupWizard(extra: Record<string, unknown> = {}) {
  const prev = readSetupWizard() ?? {};
  localStorage.setItem(
    KEY,
    JSON.stringify({
      ...prev,
      completed: true,
      completedAt: Date.now(),
      pauseReason: null,
      ...extra,
    }),
  );
}

export function relaunchSetupWizard() {
  localStorage.removeItem(KEY);
}

/** Resume a paused wizard, or clear storage so boot shows the full wizard again. */
export function resumeSetupWizard(): 'resume' | 'relaunch' {
  const wiz = readSetupWizard();
  if (wiz && wiz.completed !== true) return 'resume';
  relaunchSetupWizard();
  return 'relaunch';
}

export function pauseSetupWizard(reason: string, stepIdx = 0, extra: Record<string, unknown> = {}) {
  const prev = readSetupWizard() ?? {};
  localStorage.setItem(
    KEY,
    JSON.stringify({
      ...prev,
      completed: false,
      pausedAt: Date.now(),
      pauseReason: reason,
      stepIdx,
      ...extra,
    }),
  );
}

export function patchSetupWizard(extra: Record<string, unknown>) {
  const prev = readSetupWizard() ?? {};
  localStorage.setItem(KEY, JSON.stringify({ ...prev, ...extra }));
}
