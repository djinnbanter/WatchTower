import { registerPage } from '@/app/registry';
import '@/features/docs/docs.css';
import { PageView } from '@/features/docs/view';

registerPage({
  id: 'docs',
  title: 'Help Center',
  group: 'system',
  order: 10,
  icon: 'life-buoy',
  subtitle: 'Guides, troubleshooting, and the Watchtower wiki.',
  render: PageView,
});
