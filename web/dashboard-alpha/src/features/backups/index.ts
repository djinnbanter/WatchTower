import { registerPage } from '@/app/registry';
import { PageView } from '@/features/backups/view';

registerPage({
  id: 'backups',
  title: 'Backups',
  group: 'ops',
  order: 20,
  icon: 'archive',
  subtitle: 'Freshness, archive inventory, and setup checklist.',
  render: PageView,
});
