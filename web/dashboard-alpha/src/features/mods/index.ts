import { registerPage } from '@/app/registry';
import { PageView } from '@/features/mods/view';

registerPage({
  id: 'mods',
  title: 'Mods',
  group: 'ops',
  order: 10,
  icon: 'boxes',
  subtitle: 'Inventory, updates, conflicts, and forensic diagnostics.',
  render: PageView,
});
