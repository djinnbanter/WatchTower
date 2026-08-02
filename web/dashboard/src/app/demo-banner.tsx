import { isStaticDemo } from '@/app/runtime';

export function DemoBanner() {
  if (!isStaticDemo()) return null;
  return (
    <div
      role="status"
      className="border-b border-[color:var(--wt-line)] bg-[color:var(--wt-bg2)] px-3 py-2 text-center text-sm text-[color:var(--wt-text-mid)]"
    >
      Interactive demo. Sample data, and nothing you change is saved.
    </div>
  );
}
