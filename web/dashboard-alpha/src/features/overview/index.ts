import { registerPage } from '@/app/registry';
import { PageView } from '@/features/overview/view';

registerPage({
  id: 'overview',
  title: 'Overview',
  group: 'monitor',
  order: 10,
  icon: 'layout-dashboard',
  subtitle: 'Mission control for the server — health, attention queue, and where to look next.',
  hideShellTitle: true,
  render: PageView,
});
