import { registerPage } from '@/app/registry';
import { PageView } from '@/features/sources/view';

registerPage({
  id: 'sources',
  title: 'Sources',
  group: 'ops',
  order: 40,
  icon: 'database',
  subtitle: 'Watchtower pollers, feed freshness, and next data pulls.',
  render: PageView,
});
