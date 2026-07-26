import { registerPage } from '@/app/registry';
import { PageView } from '@/features/live/view';

registerPage({
  id: 'live',
  title: 'Live',
  group: 'monitor',
  order: 20,
  icon: 'radio',
  subtitle: 'Ops console for tick health, host load, and right-now signals.',
  hideShellTitle: true,
  render: PageView,
});
