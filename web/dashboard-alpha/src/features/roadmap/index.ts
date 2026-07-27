import { registerPage } from '@/app/registry';
import { PageView } from '@/features/roadmap/view';

registerPage({
  id: 'roadmap',
  title: 'Roadmap',
  group: 'system',
  order: 20,
  icon: 'map',
  subtitle: 'What works today, what is coming next, and what we intentionally skip.',
  render: PageView,
});
