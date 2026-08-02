import { toPng } from 'html-to-image';

export type ShotCapture = {
  /** Download filename, e.g. Overview.png — not drawn into the image. */
  filename: string;
  el: HTMLElement;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function bgColor() {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--wt-bg0').trim() || '#0b0d11'
  );
}

/**
 * Capture a preview node at full width/height (no scale, no crop).
 * Titles are never drawn — caller supplies filename only for the download.
 */
export async function captureNodePng(el: HTMLElement): Promise<string> {
  const prev = {
    transform: el.style.transform,
    width: el.style.width,
    height: el.style.height,
    minHeight: el.style.minHeight,
    maxHeight: el.style.maxHeight,
    overflow: el.style.overflow,
  };

  el.style.transform = 'none';
  el.style.width = '1280px';
  el.style.height = 'auto';
  el.style.minHeight = '0';
  el.style.maxHeight = 'none';
  el.style.overflow = 'visible';

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // Charts / fonts often need a beat after layout
  await sleep(80);

  const height = Math.max(el.scrollHeight, el.offsetHeight, 1);

  try {
    return await toPng(el, {
      pixelRatio: 1.5,
      backgroundColor: bgColor(),
      width: 1280,
      height,
      cacheBust: true,
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true;
        return !node.classList.contains('wt-shot-export-hide');
      },
    });
  } finally {
    el.style.transform = prev.transform;
    el.style.width = prev.width;
    el.style.height = prev.height;
    el.style.minHeight = prev.minHeight;
    el.style.maxHeight = prev.maxHeight;
    el.style.overflow = prev.overflow;
  }
}

/** Download each shot as its own PNG (no titles burned in). */
export async function downloadSeparatePngs(shots: ShotCapture[]) {
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i]!;
    const dataUrl = await captureNodePng(shot.el);
    downloadDataUrl(dataUrl, shot.filename);
    // Browsers throttle multi-download bursts
    if (i < shots.length - 1) await sleep(350);
  }
}
