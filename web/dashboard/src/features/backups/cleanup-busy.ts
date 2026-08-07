export function isCleanupDisabled(opts: {
  canWrite: boolean;
  cleanupPending: boolean;
  jobStatus: string;
}): boolean {
  if (!opts.canWrite) return true;
  if (opts.cleanupPending) return true;
  if (opts.jobStatus === 'running') return true;
  return false;
}
