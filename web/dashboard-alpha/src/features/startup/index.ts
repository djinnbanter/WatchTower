import { registerPage } from '@/app/registry';
import { PageView } from '@/features/startup/view';

registerPage({
  id: 'startup',
  title: 'Startup',
  group: 'monitor',
  order: 50,
  icon: 'rocket',
  subtitle: 'Last boot verdict, issues to fix, phases, and boot-time history.',
  hideShellTitle: true,
  render: PageView,
});
