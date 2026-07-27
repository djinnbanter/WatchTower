import { registerPage } from '@/app/registry';
import { PageView } from '@/features/help/view';

// Hidden alias — deep links `?tab=help` redirect to Help Center (docs) in the router.
registerPage({
  id: 'help',
  title: 'Help',
  group: 'system',
  order: 5,
  icon: 'life-buoy',
  rail: false,
  subtitle: 'Redirects to Help Center',
  render: PageView,
});
