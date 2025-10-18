import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Plus, Clock, MapPin } from "lucide-react";

const Events = () => {
  const events = [
    {
      id: 1,
      name: "Creative Writing Competition",
      code: "CW2025",
      status: "In Progress",
      date: "Jan 15-20, 2025",
      teams: 24,
      rounds: 3,
      type: "Title Event",
      venue: "Main Auditorium",
    },
    {
      id: 2,
      name: "Debate Championship",
      code: "DB2025",
      status: "Upcoming",
      date: "Jan 22-25, 2025",
      teams: 32,
      rounds: 4,
      type: "Title Event",
      venue: "Conference Hall A",
    },
    {
      id: 3,
      name: "Photography Contest",
      code: "PC2025",
      status: "In Progress",
      date: "Jan 10-18, 2025",
      teams: 18,
      rounds: 2,
      type: "Rolling Event",
      venue: "Online",
    },
    {
      id: 4,
      name: "Dance Battle",
      code: "DN2025",
      status: "Completed",
      date: "Jan 8-10, 2025",
      teams: 28,
      rounds: 3,
      type: "Title Event",
      venue: "Open Air Theatre",
    },
    {
      id: 5,
      name: "Coding Marathon",
      code: "CD2025",
      status: "Upcoming",
      date: "Jan 28-30, 2025",
      teams: 45,
      rounds: 3,
      type: "Title Event",
      venue: "Computer Lab",
    },
    {
      id: 6,
      name: "Art Exhibition",
      code: "AE2025",
      status: "In Progress",
      date: "Jan 12-25, 2025",
      teams: 22,
      rounds: 2,
      type: "Rolling Event",
      venue: "Art Gallery",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-primary/10 text-primary border-primary/20";
      case "In Progress":
        return "bg-accent/10 text-accent-foreground border-accent/20";
      case "Upcoming":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Events</h1>
            <p className="text-muted-foreground">
              Manage all Crestora'25 events and competitions
            </p>
          </div>
          <Button className="gradient-hero">
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card
              key={event.id}
              className="shadow-card hover:shadow-elevated transition-all cursor-pointer group"
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Badge
                    variant="outline"
                    className={getStatusColor(event.status)}
                  >
                    {event.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    {event.code}
                  </span>
                </div>
                <CardTitle className="group-hover:text-primary transition-colors">
                  {event.name}
                </CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  {event.date}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Teams
                  </span>
                  <span className="font-semibold">{event.teams}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Rounds
                  </span>
                  <span className="font-semibold">{event.rounds}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Venue
                  </span>
                  <span className="font-semibold">{event.venue}</span>
                </div>
                <div className="pt-2 border-t">
                  <Badge variant="secondary" className="text-xs">
                    {event.type}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Events;
