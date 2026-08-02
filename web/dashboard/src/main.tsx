import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '@/app/App';
import '@/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

async function boot() {
  // Preview-only Visuals tab (README screenshot studio). Tree-shaken out of production builds.
  if (import.meta.env.DEV) {
    const { isFixturePreview } = await import('@/app/runtime');
    if (isFixturePreview()) {
      await import('@/features/visuals');
    }
  }

  createRoot(root!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void boot();
