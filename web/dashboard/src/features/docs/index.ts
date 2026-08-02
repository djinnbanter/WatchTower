import { lazy } from 'react';
import { registerPage } from '@/app/registry';
import '@/features/docs/docs.css';

const PageView = lazy(() => import('./view').then((m) => ({ default: m.PageView })));

registerPage({
  id: 'docs',
  title: 'Help Center',
  group: 'system',
  order: 10,
  icon: 'life-buoy',
  subtitle: 'Guides, troubleshooting, and the Watchtower wiki.',
  render: PageView,
});
