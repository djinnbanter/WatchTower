import { registerPage } from '@/app/registry';
import { PageView } from '@/features/activity/view';

registerPage({
  id: 'activity',
  title: 'Activity',
  group: 'ops',
  order: 30,
  icon: 'activity',
  subtitle: 'Commands, joins, lag, and jobs from the latest ops scan.',
  render: PageView,
});
