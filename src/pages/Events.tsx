import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  Users, 
  Plus, 
  Clock, 
  MapPin, 
  Edit, 
  Save, 
  X, 
  Trash2,
  Eye,
  Building2,
  Globe,
  Monitor
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService, Event, Round } from "@/services/api";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Events = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editingRound, setEditingRound] = useState<Round | null>(null);
  const [isAddingRound, setIsAddingRound] = useState(false);
  const [isSavingRound, setIsSavingRound] = useState(false);
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [newEventData, setNewEventData] = useState({
    event_id: "",
    event_code: "",
    name: "",
    type: "title" as "title" | "rolling",
    status: "upcoming" as "upcoming" | "in_progress" | "completed",
    start_date: "",
    end_date: "",
    venue: "",
    description: ""
  });

  const { data: events, isLoading, error, refetch } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: () => apiService.getEvents(),
    refetchInterval: 30000,
  });

  const getStatusColor = (isEvaluated: boolean) => {
    return isEvaluated 
      ? "bg-primary/10 text-primary border-primary/20" 
      : "bg-muted text-muted-foreground border-border";
  };

  const formatStatus = (isEvaluated: boolean) => {
    return isEvaluated ? "Evaluated" : "Not Evaluated";
  };

  const formatEventType = (type: string) => {
    switch (type) {
      case "title":
        return "Title Event";
      case "rolling":
        return "Rolling Event";
      default:
        return type;
    }
  };

  const formatMode = (mode?: string) => {
    switch (mode) {
      case "online":
        return "Online";
      case "offline":
        return "Offline";
      default:
        return "TBD";
    }
  };

  const getModeIcon = (mode?: string) => {
    switch (mode) {
      case "online":
        return <Globe className="h-4 w-4" />;
      case "offline":
        return <Building2 className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setIsEditModalOpen(true);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent({ ...event });
    setEditingRound(null);
    setIsAddingRound(false);
  };

  const handleEditRound = (round: Round) => {
    setEditingRound({ ...round });
    setEditingEvent(null);
    setIsAddingRound(false);
  };

  const handleAddRound = (event: Event) => {
    const newRound: Round = {
      id: 0,
      event_id: event.event_id,
      round_number: event.rounds.length + 1,
      name: "",
      mode: "offline",
      club: "",
      date: undefined,
      description: "",
      status: "upcoming",
      is_frozen: false,
      is_evaluated: false,
      created_at: new Date().toISOString(),
    };
    setEditingRound(newRound);
    setEditingEvent(null);
    setIsAddingRound(true);
  };

  const handleDeleteRound = async (round: Round) => {
    if (!selectedEvent) return;
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete "${round.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiService.deleteRound(selectedEvent.event_id, round.round_number);
      toast.success("Round deleted successfully!");
      // Invalidate and refetch events data
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.refetchQueries({ queryKey: ['events'] });
    } catch (error) {
      console.error('Error deleting round:', error);
      console.error('Error type:', typeof error);
      console.error('Error string:', String(error));
      
      // Show more specific error message
      let errorMessage = "Failed to delete round";
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMsg = String(error.message);
        console.log('Error message:', errorMsg);
        if (errorMsg.includes("401") || errorMsg.includes("Unauthorized")) {
          errorMessage = "Authentication failed. Please log in again.";
        } else if (errorMsg.includes("403") || errorMsg.includes("Forbidden")) {
          errorMessage = "You don't have permission to perform this action.";
        } else if (errorMsg.includes("404") || errorMsg.includes("Not Found")) {
          errorMessage = "Round not found.";
        } else if (errorMsg.includes("500") || errorMsg.includes("Internal Server Error")) {
          errorMessage = "Server error. Please try again later.";
        } else if (errorMsg && errorMsg !== "[object Object]") {
          errorMessage = errorMsg;
        }
      }
      
      console.log('Final error message:', errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleSaveEvent = async () => {
    if (!editingEvent) return;
    
    try {
      // Here you would call the API to update the event
      toast.success("Event updated successfully!");
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setEditingEvent(null);
    } catch (error) {
      toast.error("Failed to update event");
    }
  };

  const handleCreateEvent = async () => {
    // Validate required fields
    if (!newEventData.event_id.trim()) {
      toast.error("Event ID is required");
      return;
    }
    if (!newEventData.event_code.trim()) {
      toast.error("Event Code is required");
      return;
    }
    if (!newEventData.name.trim()) {
      toast.error("Event Name is required");
      return;
    }
    
    setIsCreatingEvent(true);
    
    try {
      await apiService.createEvent({
        event_id: newEventData.event_id.trim(),
        event_code: newEventData.event_code.trim(),
        name: newEventData.name.trim(),
        type: newEventData.type,
        status: newEventData.status,
        start_date: newEventData.start_date || undefined,
        end_date: newEventData.end_date || undefined,
        venue: newEventData.venue.trim() || undefined,
        description: newEventData.description.trim() || undefined,
      });
      
      toast.success("Event created successfully!");
      // Invalidate and refetch events data
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.refetchQueries({ queryKey: ['events'] });
      setIsCreateEventModalOpen(false);
      setNewEventData({
        event_id: "",
        event_code: "",
        name: "",
        type: "title",
        status: "upcoming",
        start_date: "",
        end_date: "",
        venue: "",
        description: ""
      });
    } catch (error) {
      console.error('Error creating event:', error);
      console.error('Error type:', typeof error);
      console.error('Error string:', String(error));
      
      // Show more specific error message
      let errorMessage = "Failed to create event";
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMsg = String(error.message);
        console.log('Error message:', errorMsg);
        if (errorMsg.includes("401") || errorMsg.includes("Unauthorized")) {
          errorMessage = "Authentication failed. Please log in again.";
        } else if (errorMsg.includes("403") || errorMsg.includes("Forbidden")) {
          errorMessage = "You don't have permission to perform this action.";
        } else if (errorMsg.includes("400") || errorMsg.includes("Bad Request")) {
          errorMessage = "Invalid data provided. Please check your input.";
        } else if (errorMsg.includes("500") || errorMsg.includes("Internal Server Error")) {
          errorMessage = "Server error. Please try again later.";
        } else if (errorMsg && errorMsg !== "[object Object]") {
          errorMessage = errorMsg;
        }
      }
      
      console.log('Final error message:', errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const handleSaveRound = async () => {
    if (!editingRound || !selectedEvent) return;
    
    // Validate required fields
    if (!editingRound.name.trim()) {
      toast.error("Round name is required");
      return;
    }
    
    // Check authentication
    const token = localStorage.getItem('auth_token');
    console.log('Current user:', user);
    console.log('Auth token exists:', !!token);
    console.log('User role:', user?.role);
    
    // Check if user is admin
    if (user?.role !== 'admin') {
      toast.error("Only admin users can create or update rounds");
      setIsSavingRound(false);
      return;
    }
    
    if (!token) {
      toast.error("You must be logged in to perform this action");
      setIsSavingRound(false);
      return;
    }
    
    setIsSavingRound(true);
    
    try {
      if (isAddingRound) {
        // Create new round
        console.log('Creating round with data:', {
          event_id: selectedEvent.event_id,
          event_code: selectedEvent.event_code,
          round_number: editingRound.round_number,
          name: editingRound.name.trim(),
          type: selectedEvent.type,
          mode: editingRound.mode,
          club: editingRound.club,
          date: editingRound.date,
          description: editingRound.description,
        });
        
        const result = await apiService.createRound({
          event_id: selectedEvent.event_id,
          event_code: selectedEvent.event_code,
          round_number: editingRound.round_number,
          name: editingRound.name.trim(),
          type: selectedEvent.type,
          mode: editingRound.mode,
          club: editingRound.club || undefined,
          date: editingRound.date || undefined,
          description: editingRound.description || undefined,
        });
        
        console.log('Round created successfully:', result);
        toast.success("Round added successfully!");
      } else {
        // Update existing round
        console.log('Updating round with data:', {
          eventId: selectedEvent.event_id,
          roundNumber: editingRound.round_number,
          roundData: {
            name: editingRound.name.trim(),
            mode: editingRound.mode,
            club: editingRound.club,
            date: editingRound.date,
            description: editingRound.description,
            status: editingRound.status,
          }
        });
        
          const result = await apiService.updateRound(
            selectedEvent.event_id,
            editingRound.round_number,
            {
              name: editingRound.name.trim(),
              mode: editingRound.mode,
              club: editingRound.club || undefined,
              date: editingRound.date || undefined,
              description: editingRound.description || undefined,
              status: editingRound.status,
            }
          );
        
        console.log('Round updated successfully:', result);
        toast.success("Round updated successfully!");
      }
      
      // Invalidate and refetch events data
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      await queryClient.refetchQueries({ queryKey: ['events'] });
      setEditingRound(null);
      setIsAddingRound(false);
    } catch (error) {
      console.error('Error saving round:', error);
      console.error('Error type:', typeof error);
      console.error('Error string:', String(error));
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        response: error.response
      });
      
      // Show more specific error message
      let errorMessage = isAddingRound ? "Failed to add round" : "Failed to update round";
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMsg = String(error.message);
        console.log('Error message:', errorMsg);
        if (errorMsg.includes("401") || errorMsg.includes("Unauthorized")) {
          errorMessage = "Authentication failed. Please log in again.";
        } else if (errorMsg.includes("403") || errorMsg.includes("Forbidden")) {
          errorMessage = "You don't have permission to perform this action.";
        } else if (errorMsg.includes("400") || errorMsg.includes("Bad Request")) {
          errorMessage = "Invalid data provided. Please check your input.";
        } else if (errorMsg.includes("500") || errorMsg.includes("Internal Server Error")) {
          errorMessage = "Server error. Please try again later.";
        } else if (errorMsg && errorMsg !== "[object Object]") {
          errorMessage = errorMsg;
        }
      }
      
      console.log('Final error message:', errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSavingRound(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Crestora Logo" 
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain flex-shrink-0"
                onError={(e) => {
                  // Hide logo if file doesn't exist
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">Events</h1>
                <p className="text-muted-foreground text-sm sm:text-base">Loading events...</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="shadow-card">
                <CardHeader>
                  <div className="h-4 w-20 bg-muted animate-pulse rounded mb-2" />
                  <div className="h-6 w-32 bg-muted animate-pulse rounded mb-2" />
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="flex items-center justify-between">
                        <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-8 bg-muted animate-pulse rounded" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    console.error('Events page error:', error);
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Events</h1>
            <p className="text-muted-foreground text-red-500">
              Error loading events. Please try again.
            </p>
            <div className="mt-4">
              <Button 
                variant="outline"
                onClick={() => refetch()}
              >
                <Clock className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="Crestora Logo" 
              className="h-10 w-10 sm:h-12 sm:w-12 object-contain flex-shrink-0"
              onError={(e) => {
                // Hide logo if file doesn't exist
                e.currentTarget.style.display = 'none';
              }}
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Events & Rounds</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Manage all Crestora'25 events and their rounds
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <Clock className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {/* Disabled for now */}
            {/* {user?.role === 'admin' && (
              <Button 
                className="gradient-hero"
                onClick={() => setIsCreateEventModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            )} */}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events?.map((event) => (
            <Card
              key={event.id}
              className="shadow-card hover:shadow-elevated transition-all cursor-pointer group"
              onClick={() => handleEventClick(event)}
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Badge
                    variant="outline"
                    className={getStatusColor(false)}
                  >
                    {formatStatus(false)}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">
                      {event.event_code}
                    </span>
                    {/* Disabled for now */}
                    {/* {user?.role === 'admin' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditEvent(event);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    )} */}
                  </div>
                </div>
                <CardTitle className="group-hover:text-primary transition-colors">
                  {event.name}
                </CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  {event.start_date ? new Date(event.start_date).toLocaleDateString() : 'TBD'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Rounds
                  </span>
                  <span className="font-semibold">{event.rounds.length}</span>
                </div>
                
                {/* Show rounds preview */}
                {event.rounds && event.rounds.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground">Round Details:</span>
                    {event.rounds.slice(0, 3).map((round) => (
                      <div key={round.id} className="text-xs bg-muted/50 p-2 rounded">
                        <div className="font-medium">Round {round.round_number}: {round.name}</div>
                        <div className="text-muted-foreground flex items-center gap-1">
                          {getModeIcon(round.mode)}
                          {round.club} • {formatMode(round.mode)}
                        </div>
                      </div>
                    ))}
                    {event.rounds.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{event.rounds.length - 3} more rounds...
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Venue
                  </span>
                  <span className="font-semibold">{event.venue || 'TBD'}</span>
                </div>
                
                <div className="pt-2 border-t flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {formatEventType(event.type)}
                  </Badge>
                  {user?.role === 'admin' && (
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Click to view/edit</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Event Details & Editing Modal */}
        {selectedEvent && (
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEvent ? 'Edit Event' : 'Event Details'} - {selectedEvent.name}
                </DialogTitle>
                <DialogDescription>
                  {editingEvent ? 'Modify event and round information' : 'Complete event and round details'}
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="rounds">Rounds ({selectedEvent.rounds.length})</TabsTrigger>
                  {/* Disabled for now */}
                  {/* {user?.role === 'admin' && (
                    <TabsTrigger value="edit">Edit</TabsTrigger>
                  )} */}
                </TabsList>
                
                <TabsContent value="overview" className="space-y-6">
                  {/* Event Overview */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Event Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Event Name</Label>
                        <p className="font-medium text-lg">{selectedEvent.name}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Event Code</Label>
                        <p className="font-medium">{selectedEvent.event_code}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Type</Label>
                        <Badge variant="secondary">{formatEventType(selectedEvent.type)}</Badge>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                        <Badge className={getStatusColor(false)}>
                          {formatStatus(false)}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Start Date</Label>
                        <p className="font-medium">{selectedEvent.start_date ? new Date(selectedEvent.start_date).toLocaleDateString() : 'TBD'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">End Date</Label>
                        <p className="font-medium">{selectedEvent.end_date ? new Date(selectedEvent.end_date).toLocaleDateString() : 'TBD'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Venue</Label>
                        <p className="font-medium">{selectedEvent.venue || 'TBD'}</p>
                      </div>
                    </div>
                    {selectedEvent.description && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                        <p className="text-sm mt-1">{selectedEvent.description}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="rounds" className="space-y-6">
                  {/* Rounds Overview */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Event Rounds</h3>
                      {/* Disabled for now */}
                      {/* {user?.role === 'admin' && (
                        <Button
                          size="sm"
                          onClick={() => handleAddRound(selectedEvent)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Round
                        </Button>
                      )} */}
                    </div>
                    
                    <div className="space-y-4">
                      {selectedEvent.rounds.map((round) => (
                        <Card key={round.id} className="border-l-4 border-l-primary">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">Round {round.round_number}</Badge>
                                  <Badge className={getStatusColor(round.is_evaluated)}>
                                    {formatStatus(round.is_evaluated)}
                                  </Badge>
                                </div>
                                <h4 className="font-semibold">{round.name}</h4>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    {getModeIcon(round.mode)}
                                    {formatMode(round.mode)}
                                  </div>
                                  {round.club && (
                                    <div className="flex items-center gap-1">
                                      <Building2 className="h-3 w-3" />
                                      {round.club}
                                    </div>
                                  )}
                                  {round.date && (
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(round.date).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                                {round.description && (
                                  <p className="text-sm text-muted-foreground mt-2">
                                    {round.description}
                                  </p>
                                )}
                              </div>
                              {/* Disabled for now */}
                              {/* {user?.role === 'admin' && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditRound(round)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => handleDeleteRound(round)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )} */}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      {selectedEvent.rounds.length === 0 && (
                        <Card>
                          <CardContent className="p-6 text-center">
                            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No rounds yet</h3>
                            <p className="text-muted-foreground mb-4">
                              This event doesn't have any rounds configured.
                            </p>
                            {/* Disabled for now */}
                            {/* {user?.role === 'admin' && (
                              <Button onClick={() => handleAddRound(selectedEvent)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add First Round
                              </Button>
                            )} */}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                </TabsContent>
                
                {/* Disabled for now */}
                {/* {user?.role === 'admin' && (
                  <TabsContent value="edit" className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Edit Event</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="event-name">Event Name</Label>
                          <Input
                            id="event-name"
                            value={editingEvent?.name || selectedEvent.name}
                            onChange={(e) => editingEvent && setEditingEvent({...editingEvent, name: e.target.value})}
                            disabled={!editingEvent}
                          />
                        </div>
                        <div>
                          <Label htmlFor="event-code">Event Code</Label>
                          <Input
                            id="event-code"
                            value={editingEvent?.event_code || selectedEvent.event_code}
                            onChange={(e) => editingEvent && setEditingEvent({...editingEvent, event_code: e.target.value})}
                            disabled={!editingEvent}
                          />
                        </div>
                        <div>
                          <Label htmlFor="event-type">Event Type</Label>
                          <Select
                            value={editingEvent?.type || selectedEvent.type}
                            onValueChange={(value) => editingEvent && setEditingEvent({...editingEvent, type: value as 'title' | 'rolling'})}
                            disabled={!editingEvent}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="title">Title Event</SelectItem>
                              <SelectItem value="rolling">Rolling Event</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="event-status">Status</Label>
                          <Select
                            value={editingEvent?.status || selectedEvent.status}
                            onValueChange={(value) => editingEvent && setEditingEvent({...editingEvent, status: value as 'upcoming' | 'in_progress' | 'completed'})}
                            disabled={!editingEvent}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="upcoming">Upcoming</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="event-venue">Venue</Label>
                          <Input
                            id="event-venue"
                            value={editingEvent?.venue || selectedEvent.venue || ''}
                            onChange={(e) => editingEvent && setEditingEvent({...editingEvent, venue: e.target.value || undefined})}
                            disabled={!editingEvent}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="event-description">Description</Label>
                        <Textarea
                          id="event-description"
                          value={editingEvent?.description || selectedEvent.description || ''}
                          onChange={(e) => editingEvent && setEditingEvent({...editingEvent, description: e.target.value})}
                          disabled={!editingEvent}
                          rows={3}
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!editingEvent ? (
                          <Button onClick={() => setEditingEvent({...selectedEvent})}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Event
                          </Button>
                        ) : (
                          <>
                            <Button onClick={handleSaveEvent}>
                              <Save className="h-4 w-4 mr-2" />
                              Save Changes
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setEditingEvent(null)}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                )} */}
              </Tabs>
            </DialogContent>
          </Dialog>
        )}

        {/* Round Edit Modal */}
        {editingRound && (
          <Dialog open={!!editingRound} onOpenChange={() => setEditingRound(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {isAddingRound ? 'Add New Round' : 'Edit Round'} - {editingRound.name || 'Round ' + editingRound.round_number}
                </DialogTitle>
                <DialogDescription>
                  {isAddingRound ? 'Add a new round to this event' : 'Modify round information'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="round-name">Round Name</Label>
                    <Input
                      id="round-name"
                      value={editingRound.name}
                      onChange={(e) => setEditingRound({...editingRound, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="round-club">Organizing Club</Label>
                    <Input
                      id="round-club"
                      value={editingRound.club || ''}
                      onChange={(e) => setEditingRound({...editingRound, club: e.target.value || undefined})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="round-mode">Mode</Label>
                    <Select
                      value={editingRound.mode || 'offline'}
                      onValueChange={(value) => setEditingRound({...editingRound, mode: value as 'online' | 'offline'})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="round-status">Status</Label>
                    <Select
                      value={editingRound.status}
                      onValueChange={(value) => setEditingRound({...editingRound, status: value as 'upcoming' | 'in_progress' | 'completed'})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="round-date">Date</Label>
                    <Input
                      id="round-date"
                      type="date"
                      value={editingRound.date || ''}
                      onChange={(e) => setEditingRound({...editingRound, date: e.target.value || undefined})}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="round-description">Description</Label>
                  <Textarea
                    id="round-description"
                    value={editingRound.description || ''}
                    onChange={(e) => setEditingRound({...editingRound, description: e.target.value || undefined})}
                    rows={3}
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handleSaveRound}
                    disabled={isSavingRound}
                  >
                    {isSavingRound ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        {isAddingRound ? 'Adding...' : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {isAddingRound ? 'Add Round' : 'Save Changes'}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingRound(null);
                      setIsAddingRound(false);
                    }}
                    disabled={isSavingRound}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Create Event Modal */}
        <Dialog open={isCreateEventModalOpen} onOpenChange={setIsCreateEventModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
              <DialogDescription>
                Create a new event for Crestora'25
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="event_id">Event ID *</Label>
                  <Input
                    id="event_id"
                    value={newEventData.event_id}
                    onChange={(e) => setNewEventData({...newEventData, event_id: e.target.value})}
                    placeholder="e.g., CRESTORA25"
                  />
                </div>
                <div>
                  <Label htmlFor="event_code">Event Code *</Label>
                  <Input
                    id="event_code"
                    value={newEventData.event_code}
                    onChange={(e) => setNewEventData({...newEventData, event_code: e.target.value})}
                    placeholder="e.g., CRES25"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="event_name">Event Name *</Label>
                <Input
                  id="event_name"
                  value={newEventData.name}
                  onChange={(e) => setNewEventData({...newEventData, name: e.target.value})}
                  placeholder="e.g., Crestora'25 Main Event"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="event_type">Event Type</Label>
                  <Select
                    value={newEventData.type}
                    onValueChange={(value: "title" | "rolling") => setNewEventData({...newEventData, type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="title">Title Event</SelectItem>
                      <SelectItem value="rolling">Rolling Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="event_status">Status</Label>
                  <Select
                    value={newEventData.status}
                    onValueChange={(value: "upcoming" | "in_progress" | "completed") => setNewEventData({...newEventData, status: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={newEventData.start_date}
                    onChange={(e) => setNewEventData({...newEventData, start_date: e.target.value || undefined})}
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={newEventData.end_date}
                    onChange={(e) => setNewEventData({...newEventData, end_date: e.target.value || undefined})}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="venue">Venue</Label>
                <Input
                  id="venue"
                  value={newEventData.venue}
                  onChange={(e) => setNewEventData({...newEventData, venue: e.target.value || undefined})}
                  placeholder="e.g., Main Auditorium"
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newEventData.description}
                  onChange={(e) => setNewEventData({...newEventData, description: e.target.value || undefined})}
                  placeholder="Event description..."
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleCreateEvent}
                disabled={isCreatingEvent}
              >
                {isCreatingEvent ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Event
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsCreateEventModalOpen(false)}
                disabled={isCreatingEvent}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Events;