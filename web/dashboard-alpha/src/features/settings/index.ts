import { registerPage } from '@/app/registry';
import { PageView } from '@/features/settings/view';

registerPage({
  id: 'settings',
  title: 'Settings',
  group: 'system',
  order: 30,
  icon: 'settings',
  subtitle: 'Tune thresholds, retention, and integrations.',
  render: PageView,
});
