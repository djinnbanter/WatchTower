import { registerPage } from '@/app/registry';
import { PageView } from '@/features/wizard/view';

registerPage({
  id: 'wizard',
  title: 'Setup Wizard',
  group: 'system',
  order: 80,
  icon: 'settings',
  subtitle: 'Initial server configuration',
  rail: false,
  render: PageView,
});
