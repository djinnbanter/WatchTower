import type { ComponentProps } from 'react';
import { MetaButton } from '@/components/ui/desk';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { NAV, OVERVIEW } from '../../fixtures';
import { useNav, type PageId } from '../../nav';
import { useTheme } from '../../theme';

const GROUPS = ['Monitor', 'Triage', 'Ops', 'Lab'] as const;

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const { page, setPage } = useNav();
  const { theme, toggle } = useTheme();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="min-w-0 group-data-[collapsible=icon]:hidden">
          <p className="wt-meta text-sidebar-primary">WatchTower</p>
          <p className="mt-1 truncate wt-display text-[1.1rem] leading-tight text-sidebar-foreground">
            {OVERVIEW.serverName}
          </p>
          <p className="mt-1 truncate font-mono text-[0.65rem] text-muted-foreground">
            {OVERVIEW.identity.map((i) => i.value).join(' · ')}
          </p>
        </div>
        <p className="hidden wt-meta text-sidebar-primary group-data-[collapsible=icon]:block">WT</p>
      </SidebarHeader>

      <SidebarContent>
        {GROUPS.map((group) => (
          <SidebarGroup key={group} className="border-b border-sidebar-border">
            <SidebarGroupLabel className="wt-meta px-2 text-muted-foreground">{group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.filter((item) => item.group === group).map((item) => {
                  const id = item.id as PageId;
                  const active = page === id;
                  const ready = item.ready;

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        type="button"
                        isActive={active}
                        disabled={!ready}
                        tooltip={ready ? item.label : `${item.label} · later`}
                        title={ready ? undefined : 'Coming in a later POC page'}
                        onClick={() => {
                          if (ready) setPage(id);
                        }}
                        className="rounded-none"
                      >
                        <span className="truncate">{item.label}</span>
                      </SidebarMenuButton>
                      {item.badge ? (
                        <SidebarMenuBadge className="font-mono text-muted-foreground">
                          {item.badge}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border gap-2 p-3">
        <p className="truncate font-mono text-[0.7rem] text-muted-foreground group-data-[collapsible=icon]:hidden">
          {OVERVIEW.sessionAdmin} · {OVERVIEW.role}
        </p>
        <MetaButton
          type="button"
          onClick={toggle}
          className="w-full justify-start group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center"
        >
          <span className="group-data-[collapsible=icon]:hidden">Theme · {theme === 'dark' ? 'Dark' : 'Light'}</span>
          <span className="hidden group-data-[collapsible=icon]:inline">{theme === 'dark' ? 'D' : 'L'}</span>
        </MetaButton>
        <p className="wt-meta text-[color:var(--wt-ok)] group-data-[collapsible=icon]:hidden">
          Watching · {OVERVIEW.endpoint}
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
