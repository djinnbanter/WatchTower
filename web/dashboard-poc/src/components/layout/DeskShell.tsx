import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from './AppSidebar';
import { SiteHeader } from './SiteHeader';

/** App chrome: collapsible sidebar + header. Pages render inside as children. */
export function DeskShell({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider className="h-dvh min-h-0 overflow-hidden bg-transparent">
        <AppSidebar />
        <SidebarInset className="min-h-0 min-w-0 overflow-hidden bg-transparent shadow-none">
          <SiteHeader />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
