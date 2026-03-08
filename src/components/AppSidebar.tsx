import { LayoutDashboard, List, LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Pipeline', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Missions', url: '/dashboard/missions', icon: FolderOpen },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border md:flex">
      <div className="px-5 py-6">
        {!collapsed && (
          <h2 className="font-heading text-lg text-brand-logo leading-tight">
            Nowadays<br />Missions
          </h2>
        )}
        {collapsed && (
          <span className="font-heading text-lg text-brand-logo">N</span>
        )}
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/dashboard'}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-primary"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span className="font-body">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarMenuButton onClick={signOut} className="hover:bg-sidebar-accent">
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && <span className="font-body text-sm">Déconnexion</span>}
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
