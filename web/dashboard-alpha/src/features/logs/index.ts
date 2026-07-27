import { registerPage } from '@/app/registry';
import { PageView } from '@/features/logs/view';

registerPage({
  id: 'logs',
  title: 'Logs',
  group: 'triage',
  order: 40,
  icon: 'file-text',
  subtitle: 'Browse server logs with severity filters and searchable entries.',
  render: PageView,
});
