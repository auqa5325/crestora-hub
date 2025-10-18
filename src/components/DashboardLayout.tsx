import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="h-16 border-b bg-card flex items-center px-6 sticky top-0 z-10 shadow-sm">
            <SidebarTrigger />
            <div className="ml-4 flex-1">
              <h2 className="text-lg font-semibold">Event Management Dashboard</h2>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">PDA Admin</span>
            </div>
          </header>
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
