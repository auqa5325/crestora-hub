import { 
  Home, 
  Calendar, 
  Users, 
  Trophy, 
  DollarSign,
  Settings,
  LogOut,
  Target
} from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

const menuItems = [
  // Temporarily hidden - Dashboard
  // { title: "Dashboard", url: "/dashboard", icon: Home, roles: ["admin", "clubs"] },
  { title: "Events", url: "/events", icon: Calendar, roles: ["admin", "clubs"] },
  { title: "Rounds", url: "/rounds", icon: Target, roles: ["admin", "clubs"] },
  { title: "Teams", url: "/teams", icon: Users, roles: ["admin", "clubs"] },
  { title: "Leaderboard", url: "/leaderboard", icon: Trophy, roles: ["admin"] },
  // Temporarily hidden - Finance
  // { title: "Finance", url: "/finance", icon: DollarSign, roles: ["admin"] },
];

const bottomMenuItems = [
  { title: "Settings", url: "/settings", icon: Settings, roles: ["admin", "judge", "clubs"] },
  { title: "Logout", url: "/", icon: LogOut, roles: ["admin", "judge", "clubs"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user } = useAuth();

  const filteredMenuItems = menuItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  const filteredBottomMenuItems = bottomMenuItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <div className="px-4 py-6">
          {!isCollapsed && (
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-sidebar-foreground">Crestora'25</h2>
              <p className="text-xs text-sidebar-foreground/70">Event Management</p>
            </div>
          )}
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredBottomMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent/50"
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
