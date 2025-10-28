import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Calendar, 
  Users, 
  MapPin, 
  Search, 
  Filter,
  CircleDot,
  CircleCheck,
  CircleX,
  Globe,
  Building,
  Hash,
  Trophy,
  Target,
  Play,
  Eye,
  Settings,
  Plus,
  Edit,
  Trash2,
  Save,
  X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService } from "@/services/api";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

// ReadMoreText Component
const ReadMoreText = ({ text, maxLength = 100 }: { text: string; maxLength?: number }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (text.length <= maxLength) {
    return <span>{text}</span>;
  }
  
  const truncatedText = text.substring(0, maxLength);
  const displayText = isExpanded ? text : truncatedText;
  
  return (
    <span>
      {displayText}
      {!isExpanded && "..."}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="ml-1 text-blue-600 hover:text-blue-800 underline text-xs"
      >
        {isExpanded ? "Read Less" : "Read More"}
      </button>
    </span>
  );
};

interface RollingEvent {
  id: number;
  event_id: string;
  event_code: string;
  name: string;
  type: 'rolling';
  status: 'upcoming' | 'in_progress' | 'completed';
  start_date?: string;
  end_date?: string;
  venue?: string;
  description?: string;
  extended_description?: string;
  form_link?: string;
  contact?: string;
  club?: string;
  created_at: string;
  updated_at?: string;
}

interface RollingEventCreate {
  event_id: string;
  event_code: string;
  name: string;
  type: 'rolling';
  status?: 'upcoming' | 'in_progress' | 'completed';
  start_date?: string;
  end_date?: string;
  venue?: string;
  description?: string;
  extended_description?: string;
  form_link?: string;
  contact?: string;
  club?: string;
  rounds?: any[]; // Empty array for rolling events
}

interface RollingEventUpdate {
  name?: string;
  status?: 'upcoming' | 'in_progress' | 'completed';
  start_date?: string;
  end_date?: string;
  venue?: string;
  description?: string;
  extended_description?: string;
  form_link?: string;
  contact?: string;
  club?: string;
}

const RollingEventsManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Helper function to format status
  const formatStatus = (status: any) => {
    if (typeof status === 'string') {
      return status;
    }
    if (status && typeof status === 'object' && 'value' in status) {
      return status.value;
    }
    return 'unknown';
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clubFilter, setClubFilter] = useState<string>("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<RollingEvent | null>(null);

  // Form state for create/edit
  const [formData, setFormData] = useState<RollingEventCreate>({
    event_id: '',
    event_code: '',
    name: '',
    type: 'rolling',
    status: 'upcoming',
    start_date: '',
    end_date: '',
    venue: '',
    description: '',
    extended_description: '',
    form_link: '',
    contact: '',
    club: ''
  });

  const { data: events, isLoading, error } = useQuery<RollingEvent[]>({
    queryKey: ['rolling-events'],
    queryFn: async () => {
      const apiEvents = await apiService.getEvents({ event_type: 'rolling' });
      return apiEvents as RollingEvent[];
    },
    refetchInterval: 30000,
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: (eventData: RollingEventCreate) => apiService.createEvent(eventData),
    onSuccess: () => {
      toast({
        title: "Event created",
        description: "Rolling event has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['rolling-events'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create event. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: ({ eventId, eventData }: { eventId: string; eventData: RollingEventUpdate }) =>
      apiService.updateEvent(eventId, eventData),
    onSuccess: () => {
      toast({
        title: "Event updated",
        description: "Rolling event has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['rolling-events'] });
      setIsEditModalOpen(false);
      setEditingEvent(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update event. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) => apiService.deleteEvent(eventId),
    onSuccess: () => {
      toast({
        title: "Event deleted",
        description: "Rolling event has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['rolling-events'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete event. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter events based on user role
  const availableEvents = user?.role === 'admin' 
    ? events || []
    : (events || []).filter(event => event.club === user?.club);

  // Get unique clubs for filter
  const clubs = [...new Set((events || []).map(event => event.club).filter(Boolean))];

  // Filter events based on search and filters
  const filteredEvents = availableEvents.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.club?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.event_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || formatStatus(event.status) === statusFilter;
    const matchesClub = clubFilter === "all" || event.club === clubFilter;

    return matchesSearch && matchesStatus && matchesClub;
  });

  // Calculate statistics
  const stats = {
    total: availableEvents.length,
    upcoming: availableEvents.filter(e => formatStatus(e.status) === 'upcoming').length,
    in_progress: availableEvents.filter(e => formatStatus(e.status) === 'in_progress').length,
    completed: availableEvents.filter(e => formatStatus(e.status) === 'completed').length,
    byClub: clubs.reduce((acc, club) => {
      acc[club] = availableEvents.filter(e => e.club === club).length;
      return acc;
    }, {} as Record<string, number>)
  };

  const resetForm = () => {
    setFormData({
      event_id: '',
      event_code: '',
      name: '',
      type: 'rolling',
      status: 'upcoming',
      start_date: '',
      end_date: '',
      venue: '',
      description: '',
      extended_description: '',
      form_link: '',
      contact: '',
      club: user?.club || ''
    });
  };

  const handleCreateEvent = () => {
    const eventData = {
      event_id: formData.event_id,
      event_code: formData.event_code,
      name: formData.name,
      type: formData.type,
      status: formData.status,
      start_date: formData.start_date || undefined,
      end_date: formData.end_date || undefined,
      venue: formData.venue || undefined,
      description: formData.description || undefined,
      extended_description: formData.extended_description || undefined,
      form_link: formData.form_link || undefined,
      contact: formData.contact || undefined,
      club: formData.club || undefined,
      rounds: [] // Empty rounds array for rolling events
    };
    createEventMutation.mutate(eventData);
  };

  const handleEditEvent = (event: RollingEvent) => {
    setEditingEvent(event);
    setFormData({
      event_id: event.event_id,
      event_code: event.event_code,
      name: event.name,
      type: event.type,
      status: event.status,
      start_date: event.start_date || '',
      end_date: event.end_date || '',
      venue: event.venue || '',
      description: event.description || '',
      extended_description: event.extended_description || '',
      form_link: event.form_link || '',
      contact: event.contact || '',
      club: event.club || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateEvent = () => {
    if (!editingEvent) return;
    const updateData: RollingEventUpdate = {
      name: formData.name,
      status: formData.status,
      start_date: formData.start_date || undefined,
      end_date: formData.end_date || undefined,
      venue: formData.venue || undefined,
      description: formData.description || undefined,
      extended_description: formData.extended_description || undefined,
      form_link: formData.form_link || undefined,
      contact: formData.contact || undefined,
      club: formData.club || undefined
    };
    updateEventMutation.mutate({ eventId: editingEvent.event_id, eventData: updateData });
  };

  const handleDeleteEvent = (eventId: string) => {
    if (window.confirm('Are you sure you want to delete this rolling event? This action cannot be undone.')) {
      deleteEventMutation.mutate(eventId);
    }
  };

  const handleViewResults = (eventId: string) => {
    navigate(`/rolling-results-management?eventId=${eventId}`);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Rolling Events</h1>
              <p className="text-muted-foreground">
                Loading rolling events data...
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="shadow-card">
                <CardHeader>
                  <div className="h-4 w-20 bg-muted animate-pulse rounded mb-2" />
                  <div className="h-6 w-32 bg-muted animate-pulse rounded mb-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Rolling Events</h1>
            <p className="text-muted-foreground text-red-500">
              Error loading rolling events data. Please try again.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Rolling Events</h1>
            <p className="text-muted-foreground">
              {user?.role === 'admin' 
                ? 'Manage all rolling events and their results' 
                : `Manage rolling events for ${user?.club} club`
              }
            </p>
          </div>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            {user?.club === 'PDA' && (
              <DialogTrigger asChild>
                <Button className="gradient-hero" onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Event
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Rolling Event</DialogTitle>
                <DialogDescription>
                  Create a new rolling event for the competition.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="event_id">Event ID *</Label>
                    <Input
                      id="event_id"
                      value={formData.event_id}
                      onChange={(e) => setFormData({ ...formData, event_id: e.target.value })}
                      placeholder="e.g., ROLLING_001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event_code">Event Code *</Label>
                    <Input
                      id="event_code"
                      value={formData.event_code}
                      onChange={(e) => setFormData({ ...formData, event_code: e.target.value })}
                      placeholder="e.g., R001"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Event Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Tech Quiz Competition"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
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
                  <div className="space-y-2">
                    <Label htmlFor="club">Organizing Club</Label>
                    <Input
                      id="club"
                      value={formData.club}
                      onChange={(e) => setFormData({ ...formData, club: e.target.value })}
                      placeholder="e.g., Tech Club"
                      disabled={user?.role === 'clubs'}
                    />
                    {user?.role === 'clubs' && (
                      <p className="text-xs text-muted-foreground">
                        This field is automatically set to your club
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue">Venue</Label>
                  <Input
                    id="venue"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    placeholder="e.g., Main Auditorium"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the event"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="extended_description">Extended Description</Label>
                  <Textarea
                    id="extended_description"
                    value={formData.extended_description}
                    onChange={(e) => setFormData({ ...formData, extended_description: e.target.value })}
                    placeholder="Detailed description of the event"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="form_link">Registration Form Link</Label>
                    <Input
                      id="form_link"
                      value={formData.form_link}
                      onChange={(e) => setFormData({ ...formData, form_link: e.target.value })}
                      placeholder="https://forms.google.com/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact">Contact</Label>
                    <Input
                      id="contact"
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      placeholder="Contact person or number"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateEvent}
                    disabled={createEventMutation.isPending || !formData.event_id || !formData.event_code || !formData.name}
                    className="gradient-hero"
                  >
                    {createEventMutation.isPending ? "Creating..." : "Create Event"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Modal */}
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Rolling Event</DialogTitle>
                <DialogDescription>
                  Update the rolling event details.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_name">Event Name *</Label>
                  <Input
                    id="edit_name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Tech Quiz Competition"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_status">Status</Label>
                    <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
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
                  <div className="space-y-2">
                    <Label htmlFor="edit_club">Organizing Club</Label>
                    <Input
                      id="edit_club"
                      value={formData.club}
                      onChange={(e) => setFormData({ ...formData, club: e.target.value })}
                      placeholder="e.g., Tech Club"
                      disabled={user?.role === 'clubs'}
                    />
                    {user?.role === 'clubs' && (
                      <p className="text-xs text-muted-foreground">
                        This field is automatically set to your club
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_start_date">Start Date</Label>
                    <Input
                      id="edit_start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_end_date">End Date</Label>
                    <Input
                      id="edit_end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_venue">Venue</Label>
                  <Input
                    id="edit_venue"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    placeholder="e.g., Main Auditorium"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_description">Description</Label>
                  <Textarea
                    id="edit_description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the event"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_extended_description">Extended Description</Label>
                  <Textarea
                    id="edit_extended_description"
                    value={formData.extended_description}
                    onChange={(e) => setFormData({ ...formData, extended_description: e.target.value })}
                    placeholder="Detailed description of the event"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_form_link">Registration Form Link</Label>
                    <Input
                      id="edit_form_link"
                      value={formData.form_link}
                      onChange={(e) => setFormData({ ...formData, form_link: e.target.value })}
                      placeholder="https://forms.google.com/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_contact">Contact</Label>
                    <Input
                      id="edit_contact"
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      placeholder="Contact person or number"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpdateEvent}
                    disabled={updateEventMutation.isPending || !formData.name}
                    className="gradient-hero"
                  >
                    {updateEventMutation.isPending ? "Updating..." : "Update Event"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                Rolling events
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
              <CircleDot className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.upcoming}</div>
              <p className="text-xs text-muted-foreground">
                Scheduled events
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <CircleX className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.in_progress}</div>
              <p className="text-xs text-muted-foreground">
                Active events
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CircleCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">
                Finished events
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Club Statistics */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Events by Club
            </CardTitle>
            <CardDescription>
              Distribution of rolling events across organizing clubs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(stats.byClub).map(([club, count]) => (
                <div key={club} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{club}</span>
                  <Badge variant="secondary">{count} events</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search events..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Club</label>
                <Select value={clubFilter} onValueChange={setClubFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All clubs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clubs</SelectItem>
                    {clubs.map(club => (
                      <SelectItem key={club} value={club}>{club}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Events List */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              All Rolling Events ({filteredEvents.length})
            </CardTitle>
            <CardDescription>
              Detailed view of all rolling events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredEvents.map((event) => (
                <div key={event.id} className="border rounded-lg p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-col gap-2">
                        <h3 className="font-semibold text-base sm:text-lg break-words">{event.name}</h3>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                            {formatStatus(event.status)}
                          </Badge>
                          <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                            Rolling Event
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Hash className="h-4 w-4 flex-shrink-0" />
                          <span>ID: {event.event_id}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 flex-shrink-0" />
                          <span className="break-words">{event.club || 'No club assigned'}</span>
                        </div>
                        {event.start_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 flex-shrink-0" />
                            <span>{new Date(event.start_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {event.venue && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span>{event.venue}</span>
                          </div>
                        )}
                      </div>

                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-2 break-words">
                          {event.description}
                        </p>
                      )}
                      {event.extended_description && (
                        <div className="text-sm text-muted-foreground mt-1 break-words">
                          <span className="font-medium">Details:</span> 
                          <ReadMoreText text={event.extended_description} maxLength={100} />
                        </div>
                      )}
                      {(event.form_link || event.contact) && (
                        <div className="mt-2 space-y-1">
                          {event.form_link && (
                            <div className="flex items-center gap-1 text-xs">
                              <Globe className="h-3 w-3" />
                              <a 
                                href={event.form_link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline break-all"
                              >
                                Registration Form
                              </a>
                            </div>
                          )}
                          {event.contact && (
                            <div className="flex items-center gap-1 text-xs">
                              <Users className="h-3 w-3" />
                              <span>Contact: {event.contact}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex justify-end sm:justify-start gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleViewResults(event.event_id)}
                        className="flex items-center gap-2 w-full sm:w-auto"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="hidden xs:inline">View Results</span>
                        <span className="xs:hidden">Results</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleEditEvent(event)}
                        className="flex items-center gap-2 w-full sm:w-auto"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="hidden xs:inline">Edit</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteEvent(event.event_id)}
                        className="flex items-center gap-2 w-full sm:w-auto text-red-600 hover:text-red-700"
                        disabled={deleteEventMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden xs:inline">Delete</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredEvents.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No rolling events found matching your filters.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default RollingEventsManagement;
