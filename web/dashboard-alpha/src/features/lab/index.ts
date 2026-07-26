import { registerPage } from '@/app/registry';
import { PageView } from '@/features/lab/view';

registerPage({
  id: 'lab',
  title: 'Visual Lab',
  group: 'system',
  order: 90,
  icon: 'flask-conical',
  subtitle: 'Every chart, motion primitive, and UI pattern in one interactive gallery.',
  render: PageView,
});
