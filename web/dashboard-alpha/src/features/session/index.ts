import { registerPage } from '@/app/registry';
import { PageView } from '@/features/session/view';

registerPage({
  id: 'session',
  title: 'Session',
  group: 'monitor',
  order: 40,
  icon: 'users',
  subtitle: "Who's online, peaks, playtime, and the player directory.",
  hideShellTitle: true,
  render: PageView,
});
