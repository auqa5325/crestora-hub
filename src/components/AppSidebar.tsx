import { 
  Home, 
  Calendar, 
  Users, 
  Trophy, 
  DollarSign,
  Settings,
  LogOut,
  Target,
  Menu,
  Wrench
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
  SidebarTrigger,
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
  { title: "PDA Round Management", url: "/pda-round-management", icon: Wrench, roles: ["admin"] },
  { title: "Club Round Management", url: "/club-round-management", icon: Wrench, roles: ["clubs"] },
  { title: "Rolling Events Management", url: "/rolling-events-management", icon: Calendar, roles: ["admin", "clubs"] },
  { title: "Rolling Results", url: "/rolling-results", icon: Trophy, roles: ["admin", "clubs"] },
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
          <div className="flex items-center gap-3">
            <img 
              src="/logo1.png" 
              alt="Crestora Logo" 
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-10 w-10"
              onError={(e) => {
                // Hide logo if file doesn't exist
                e.currentTarget.style.display = 'none';
              }}
            />
            {!isCollapsed && (
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-sidebar-foreground">Crestora'25</h2>
                <p className="text-xs text-sidebar-foreground/70">Event Management</p>
              </div>
            )}
          </div>
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
