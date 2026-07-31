import type { Metadata } from 'next';
import { ShiftLog } from '@/components/shift-log/log';
import { HowDropEntry } from '@/components/entries/how/drop';
import { HowWizardEntry } from '@/components/entries/how/wizard';
import { HowLoopEntry } from '@/components/entries/how/loop';
import { HowDiskEntry } from '@/components/entries/how/disk';
import { HowDeskEntry } from '@/components/entries/how/desk';
import { HowCliEntry } from '@/components/entries/how/cli';
import { HowCloseEntry } from '@/components/entries/how/close';

export const metadata: Metadata = { title: 'How it works' };

export default function HowItWorksPage() {
  return (
    <main>
      <ShiftLog ariaLabel="How it works">
        <HowDropEntry />
        <HowWizardEntry />
        <HowLoopEntry />
        <HowDiskEntry />
        <HowDeskEntry />
        <HowCliEntry />
        <HowCloseEntry />
      </ShiftLog>
    </main>
  );
}
