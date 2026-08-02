import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import type { RouteState } from '@/app/router';
import { beginPreviewNavLock, endPreviewNavLock, navigate } from '@/app/router';
import { PageEnter } from '@/ui/motion';
import { Camera, Check, Download, FlaskConical } from '@/ui/icons';
import { PageView as LabKitView } from '@/features/lab/view';
import { ReadmeHeaderArt } from '@/features/visuals/header-stage';
import { downloadSeparatePngs } from '@/features/visuals/export-shots';
import { PageView as OverviewView } from '@/features/overview/view';
import { PageView as LiveView } from '@/features/live/view';
import { PageView as IssuesView } from '@/features/issues/view';
import { PageView as CrashesView } from '@/features/crashes/view';
import { PageView as ModsView } from '@/features/mods/view';
import { PageView as SparkView } from '@/features/spark/view';
import { PageView as BackupsView } from '@/features/backups/view';
import { PageView as InsightsView } from '@/features/insights/view';
import './shots.css';

type ShotDef = {
  id: string;
  title: string;
  hint: string;
  filename: string;
  render: ComponentType<{ route: RouteState }>;
};

const PAGE_SHOTS: ShotDef[] = [
  { id: 'overview', title: 'Overview', hint: 'Mission status + what needs attention', filename: 'Overview.png', render: OverviewView },
  { id: 'live', title: 'Live', hint: 'TPS and host charts while the server runs', filename: 'Live-Metrics.png', render: LiveView },
  { id: 'issues', title: 'Issues', hint: 'Fix inbox with clear next steps', filename: 'Issues.png', render: IssuesView },
  { id: 'crashes', title: 'Crashes', hint: 'Grouped crash reports', filename: 'Crash-Logs.png', render: CrashesView },
  { id: 'mods', title: 'Mods', hint: 'Installed mods and updates', filename: 'Mods.png', render: ModsView },
  { id: 'spark', title: 'Spark', hint: 'Lag profile reader', filename: 'spark.png', render: SparkView },
  { id: 'backups', title: 'Backups', hint: 'Backup freshness tracking', filename: 'Backups.png', render: BackupsView },
  { id: 'insights', title: 'Insights', hint: 'Patterns and storage', filename: 'Insights.png', render: InsightsView },
];

function emptyRoute(tab: string): RouteState {
  return {
    tab,
    raw: new URLSearchParams({ tab }),
  };
}

/** Stop embedded pages (Spark/Issues/…) from stealing the URL via navigate(). */
function PreviewNavLock({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    beginPreviewNavLock();
    return () => endPreviewNavLock();
  }, []);
  return children;
}

function useShotScale(frameRef: React.RefObject<HTMLElement | null>) {
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / 1280);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [frameRef]);

  return scale;
}

function ShotSection({
  title,
  hint,
  captureRef,
  children,
  header,
}: {
  title: string;
  hint: string;
  captureRef: (el: HTMLDivElement | null) => void;
  children: ReactNode;
  header?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const scale = useShotScale(frameRef);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-wt-text-mid">{hint}</p>
      </div>
      <div ref={frameRef} className={header ? 'wt-shot-frame wt-shot-frame--header' : 'wt-shot-frame'}>
        <div
          ref={captureRef}
          className="wt-shot-capture"
          style={{ ['--wt-shot-scale' as string]: String(scale) }}
          data-shot-title={title}
        >
          {header ? children : <PreviewNavLock>{children}</PreviewNavLock>}
        </div>
      </div>
    </section>
  );
}

export function PageView({ route }: { route: RouteState }) {
  const kit = route.view === 'kit';
  const captureEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const setCaptureRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) captureEls.current.set(id, el);
      else captureEls.current.delete(id);
    },
    [],
  );

  const saveAll = async () => {
    setExportError(null);
    setExporting(true);
    document.documentElement.classList.add('wt-shot-exporting');
    try {
      // Let CSS lift max-height / overflow before measuring
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const fileById = new Map<string, string>([
        ['header', 'readme-header.png'],
        ...PAGE_SHOTS.map((s) => [s.id, s.filename] as const),
      ]);
      const order = ['header', ...PAGE_SHOTS.map((s) => s.id)];
      const shots = order
        .map((id) => {
          const el = captureEls.current.get(id);
          const filename = fileById.get(id);
          if (!el || !filename) return null;
          return { filename, el };
        })
        .filter((s): s is { filename: string; el: HTMLDivElement } => !!s);

      if (!shots.length) throw new Error('Nothing to export yet — wait for previews to load.');
      await downloadSeparatePngs(shots);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      document.documentElement.classList.remove('wt-shot-exporting');
      setExporting(false);
    }
  };

  if (kit) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-xl border border-wt-line bg-wt-bg2 px-3 py-2 text-sm text-wt-text-mid hover:text-wt-text"
            onClick={() => navigate({ tab: 'visuals', view: null })}
          >
            ← Back to screenshot studio
          </button>
          <span className="text-xs text-wt-text-low">UI kit gallery (fixture demos only)</span>
        </div>
        <LabKitView route={route} />
      </div>
    );
  }

  return (
    <PageEnter className={`space-y-10 ${exporting ? 'wt-shot-exporting' : ''}`}>
      <section className="rounded-[var(--radius-wt-lg)] border border-wt-line bg-wt-bg1/80 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-[var(--radius-wt-lg)] bg-wt-accent/15 text-wt-accent">
              <Camera size={20} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-wt-text-low">
                Preview only
              </div>
              <h2 className="text-xl font-bold tracking-tight">README screenshot studio</h2>
              <p className="mt-1 max-w-2xl text-sm text-wt-text-mid">
                Live previews of the header and main pages. When they look right, save each as its own PNG.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={exporting}
            onClick={() => void saveAll()}
            className="inline-flex items-center gap-2 rounded-xl border border-wt-accent/40 bg-wt-accent/15 px-4 py-2.5 text-sm font-semibold text-wt-text hover:bg-wt-accent/25 disabled:opacity-60"
          >
            <Download size={16} />
            {exporting ? 'Saving…' : 'Save all as PNGs'}
          </button>
        </div>
        {exportError ? <p className="mt-3 text-sm text-wt-danger">{exportError}</p> : null}
        <p className="mt-3 text-xs text-wt-text-low">
          Downloads separate PNGs (no titles): <code className="rounded bg-wt-bg2 px-1">readme-header.png</code>,{' '}
          <code className="rounded bg-wt-bg2 px-1">Overview.png</code>, … — full page height, not cropped. Allow
          multiple downloads if the browser asks.
        </p>
      </section>

      <ShotSection
        title="README header"
        hint="Banner for the top of the GitHub README"
        header
        captureRef={setCaptureRef('header')}
      >
        <ReadmeHeaderArt />
      </ShotSection>

      {PAGE_SHOTS.map((shot) => {
        const View = shot.render;
        return (
          <ShotSection
            key={shot.id}
            title={shot.title}
            hint={shot.hint}
            captureRef={setCaptureRef(shot.id)}
          >
            <View route={emptyRoute(shot.id)} />
          </ShotSection>
        );
      })}

      <section className="rounded-[var(--radius-wt-lg)] border border-dashed border-wt-line bg-wt-bg2/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="text-wt-accent" />
            <div>
              <div className="text-sm font-semibold">UI kit gallery</div>
              <p className="text-xs text-wt-text-mid">Charts / motion playground — not part of the JPG export.</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-wt-line bg-wt-bg1 px-3 py-2 text-sm text-wt-text-mid hover:text-wt-text"
            onClick={() => navigate({ tab: 'visuals', view: 'kit' })}
          >
            Open kit
          </button>
        </div>
      </section>

      <p className="flex items-center gap-2 text-xs text-wt-text-low">
        <Check size={12} /> Preview-only · gated out of production builds
      </p>
    </PageEnter>
  );
}
