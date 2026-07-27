import { registerPage } from '@/app/registry';
import { PageView } from '@/features/crashes/view';

registerPage({
  id: 'crashes',
  title: 'Crashes',
  group: 'triage',
  order: 20,
  icon: 'bug',
  subtitle: 'Resolve crashes quickly — fingerprint groups with clear next steps.',
  hideShellTitle: true,
  render: PageView,
});
