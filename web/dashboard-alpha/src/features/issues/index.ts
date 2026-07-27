import { registerPage } from '@/app/registry';
import { PageView } from '@/features/issues/view';

registerPage({
  id: 'issues',
  title: 'Issues',
  group: 'triage',
  order: 10,
  icon: 'alert-triangle',
  subtitle: 'Fix queue — live peeks, scanning ledger, boot findings, and crash pointers.',
  hideShellTitle: true,
  render: PageView,
});
