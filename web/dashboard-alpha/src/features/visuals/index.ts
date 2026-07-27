import { registerPage } from '@/app/registry';
import { PageView } from '@/features/visuals/view';
import { syncCaptureModeFromStorage } from '@/app/capture-mode';

syncCaptureModeFromStorage();

registerPage({
  id: 'visuals',
  title: 'Visuals',
  group: 'system',
  order: 95,
  icon: 'camera',
  subtitle: 'README screenshot studio — header banner + page shots (preview only).',
  hideShellTitle: true,
  render: PageView,
});
