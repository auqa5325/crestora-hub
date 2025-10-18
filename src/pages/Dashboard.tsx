import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Trophy, DollarSign, TrendingUp, Award } from "lucide-react";

const Dashboard = () => {
  const stats = [
    {
      title: "Total Teams",
      value: "156",
      change: "+12 this week",
      icon: Users,
      color: "text-primary",
    },
    {
      title: "Active Events",
      value: "13",
      change: "9 title + 4 rolling",
      icon: Calendar,
      color: "text-accent",
    },
    {
      title: "Ongoing Rounds",
      value: "8",
      change: "3 completed today",
      icon: Trophy,
      color: "text-primary",
    },
    {
      title: "Prize Pool",
      value: "₹12,600",
      change: "Distributed soon",
      icon: DollarSign,
      color: "text-accent",
    },
  ];

  const recentEvents = [
    { name: "Creative Writing", status: "In Progress", teams: 24 },
    { name: "Debate Competition", status: "Upcoming", teams: 32 },
    { name: "Photography Contest", status: "In Progress", teams: 18 },
    { name: "Dance Battle", status: "Completed", teams: 28 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard Overview</h1>
          <p className="text-muted-foreground">
            Welcome to Crestora'25 Event Management System
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="shadow-card hover:shadow-elevated transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Recent Events
              </CardTitle>
              <CardDescription>Latest event activities and status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentEvents.map((event, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium">{event.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.teams} teams registered
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        event.status === "Completed"
                          ? "bg-primary/10 text-primary"
                          : event.status === "In Progress"
                          ? "bg-accent/10 text-accent-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {event.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                Quick Stats
              </CardTitle>
              <CardDescription>Event progress overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Events Completed</span>
                    <span className="font-medium">4/13</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: "31%" }} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Teams Evaluated</span>
                    <span className="font-medium">89/156</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: "57%" }} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Rounds Completed</span>
                    <span className="font-medium">12/20</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: "60%" }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
