import { ShiftLog } from '@/components/shift-log/log';
import { WelcomeEntry } from '@/components/entries/welcome';
import { LiveEntry } from '@/components/entries/live';
import { IssuesEntry } from '@/components/entries/issues';
import { CrashesEntry } from '@/components/entries/crashes';
import { OverviewEntry } from '@/components/entries/overview';
import { InsightsEntry } from '@/components/entries/insights';
import { CloseEntry } from '@/components/entries/close-entry';

export default function HomePage() {
  return (
    <main>
      <ShiftLog>
        <WelcomeEntry />
        <LiveEntry />
        <IssuesEntry />
        <CrashesEntry />
        <OverviewEntry />
        <InsightsEntry />
        <CloseEntry />
      </ShiftLog>
    </main>
  );
}
