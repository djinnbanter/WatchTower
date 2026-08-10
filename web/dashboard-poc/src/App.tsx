import { Backups } from './components/Backups';
import { Issues } from './components/Issues';
import { Kit } from './components/Kit';
import { DeskShell } from './components/layout/DeskShell';
import { Live } from './components/Live';
import { Overview } from './components/Overview';
import { Startup } from './components/Startup';
import { NavProvider, useNav } from './nav';
import { ThemeProvider } from './theme';

function Main() {
  const { page } = useNav();
  if (page === 'issues') return <Issues />;
  if (page === 'live') return <Live />;
  if (page === 'startup') return <Startup />;
  if (page === 'backups') return <Backups />;
  if (page === 'kit') return <Kit />;
  return <Overview />;
}

export function App() {
  return (
    <ThemeProvider>
      <NavProvider>
        <DeskShell>
          <Main />
        </DeskShell>
      </NavProvider>
    </ThemeProvider>
  );
}
