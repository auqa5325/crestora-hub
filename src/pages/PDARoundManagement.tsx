import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  Monitor,
  Settings,
  Lock,
  Unlock,
  Trophy,
  Target,
  ArrowUp,
  ArrowDown,
  RefreshCw
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService, Event, Round } from "@/services/api";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface RoundFormData {
  name: string;
  type: 'title' | 'rolling';
  mode: 'online' | 'offline';
  club: string;
  date: string;
  venue: string;
  description: string;
  extended_description: string;
  form_link: string;
  contact: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  criteria: Array<{name: string, max_points: number}>;
}

const PDARoundManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // State management
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRound, setEditingRound] = useState<Round | null>(null);
  const [roundToDelete, setRoundToDelete] = useState<Round | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState<RoundFormData>({
    name: "",
    type: "title",
    mode: "offline",
    club: "",
    date: "",
    venue: "",
    description: "",
    extended_description: "",
    form_link: "",
    contact: "",
    status: "upcoming",
    criteria: [{ name: "Overall Performance", max_points: 100 }]
  });

  // Check if user is PDA (admin)
  useEffect(() => {
    if (user?.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "Only PDA members can access this page.",
        variant: "destructive",
      });
      navigate('/dashboard');
    }
  }, [user, navigate, toast]);

  // Fetch events
  const { data: events, isLoading, error } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: () => apiService.getEvents(),
    refetchInterval: 30000,
  });

  // Get CRESTORA25 event
  const crestoraEvent = events?.find(event => event.event_id === 'CRESTORA25');

  // Mutations
  const createRoundMutation = useMutation({
    mutationFn: (roundData: any) => apiService.createRound(roundData),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Round created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.response?.data?.detail || "Failed to create round",
        variant: "destructive",
      });
    },
  });

  const updateRoundMutation = useMutation({
    mutationFn: ({ eventId, roundNumber, roundData }: { eventId: string; roundNumber: number; roundData: any }) =>
      apiService.updateRound(eventId, roundNumber, roundData),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Round updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setIsEditModalOpen(false);
      setEditingRound(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.response?.data?.detail || "Failed to update round",
        variant: "destructive",
      });
    },
  });

  const deleteRoundMutation = useMutation({
    mutationFn: ({ eventId, roundNumber }: { eventId: string; roundNumber: number }) =>
      apiService.deleteRound(eventId, roundNumber),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Round deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setIsDeleteDialogOpen(false);
      setRoundToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.response?.data?.detail || "Failed to delete round",
        variant: "destructive",
      });
    },
  });

  const updateCriteriaMutation = useMutation({
    mutationFn: ({ roundId, criteria }: { roundId: number; criteria: Array<{name: string, max_points: number}> }) =>
      apiService.updateRoundCriteria(roundId, criteria),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Round criteria updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.response?.data?.detail || "Failed to update criteria",
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const resetForm = () => {
    setFormData({
      name: "",
      type: "title",
      mode: "offline",
      club: "",
      date: "",
      venue: "",
      description: "",
      extended_description: "",
      form_link: "",
      contact: "",
      status: "upcoming",
      criteria: [{ name: "Overall Performance", max_points: 100 }]
    });
  };

  const handleCreateRound = () => {
    if (!crestoraEvent) return;
    
    const roundData = {
      event_id: crestoraEvent.event_id,
      event_code: crestoraEvent.event_code,
      round_number: (crestoraEvent.rounds?.length || 0) + 1,
      name: formData.name,
      type: formData.type,
      mode: formData.mode,
      club: formData.club,
      date: formData.date || undefined,
      description: formData.description,
      criteria: formData.criteria
    };

    createRoundMutation.mutate(roundData);
  };

  const handleEditRound = (round: Round) => {
    setEditingRound(round);
    setFormData({
      name: round.name,
      type: round.type || "title",
      mode: round.mode || "offline",
      club: round.club || "",
      date: round.date || "",
      venue: (round as any).venue || "",
      description: round.description || "",
      extended_description: round.extended_description || "",
      form_link: round.form_link || "",
      contact: round.contact || "",
      status: round.status || "upcoming",
      criteria: round.criteria || [{ name: "Overall Performance", max_points: 100 }]
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateRound = () => {
    if (!editingRound || !crestoraEvent) return;

    const roundData = {
      name: formData.name,
      type: formData.type,
      mode: formData.mode,
      club: formData.club,
      date: formData.date || undefined,
      description: formData.description,
      extended_description: formData.extended_description,
      form_link: formData.form_link,
      contact: formData.contact,
      status: formData.status
    };

    updateRoundMutation.mutate({
      eventId: crestoraEvent.event_id,
      roundNumber: editingRound.round_number,
      roundData
    });

    // Update criteria separately if changed
    if (JSON.stringify(formData.criteria) !== JSON.stringify(editingRound.criteria)) {
      updateCriteriaMutation.mutate({
        roundId: editingRound.id,
        criteria: formData.criteria
      });
    }
  };

  const handleDeleteRound = (round: Round) => {
    setRoundToDelete(round);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteRound = () => {
    if (!roundToDelete || !crestoraEvent) return;
    
    deleteRoundMutation.mutate({
      eventId: crestoraEvent.event_id,
      roundNumber: roundToDelete.round_number
    });
  };

  const handleReorderRounds = async (round: Round, direction: 'up' | 'down') => {
    if (!crestoraEvent?.rounds) return;
    
    setIsReordering(true);
    try {
      const currentIndex = round.round_number - 1;
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      // Validate bounds
      if (targetIndex < 0 || targetIndex >= crestoraEvent.rounds.length) {
        toast({
          title: "Cannot Move",
          description: `Cannot move round ${direction === 'up' ? 'up' : 'down'} further.`,
          variant: "destructive",
        });
        return;
      }
      
      // Create new round order
      const newRounds = [...crestoraEvent.rounds].sort((a, b) => a.round_number - b.round_number);
      const roundToMove = newRounds[currentIndex];
      const targetRound = newRounds[targetIndex];
      
      // Swap round numbers
      const roundOrders = [
        { round_id: roundToMove.id, new_round_number: targetRound.round_number },
        { round_id: targetRound.id, new_round_number: roundToMove.round_number }
      ];
      
      await apiService.reorderRounds(crestoraEvent.event_id, roundOrders);
      
      toast({
        title: "Success",
        description: `Round "${round.name}" moved ${direction === 'up' ? 'up' : 'down'} successfully!`,
      });
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['events'] });
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.detail || "Failed to reorder rounds",
        variant: "destructive",
      });
    } finally {
      setIsReordering(false);
    }
  };

  const handleNavigateToEvaluation = (round: Round) => {
    navigate(`/round-evaluation?roundId=${round.id}`);
  };

  const addCriteria = () => {
    setFormData(prev => ({
      ...prev,
      criteria: [...prev.criteria, { name: "", max_points: 0 }]
    }));
  };

  const removeCriteria = (index: number) => {
    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.filter((_, i) => i !== index)
    }));
  };

  const updateCriteria = (index: number, field: 'name' | 'max_points', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.map((c, i) => 
        i === index ? { ...c, [field]: value } : c
      )
    }));
  };

  const getStatusColor = (round: Round) => {
    if (round.is_evaluated) return "bg-green-100 text-green-800 border-green-200";
    if (round.is_frozen) return "bg-blue-100 text-blue-800 border-blue-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getStatusText = (round: Round) => {
    if (round.is_evaluated) return "Evaluated";
    if (round.is_frozen) return "Frozen";
    return "Active";
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

  if (user?.role !== 'admin') {
    return null; // Will redirect in useEffect
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">PDA Round Management</h1>
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !crestoraEvent) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">PDA Round Management</h1>
              <p className="text-muted-foreground text-red-500">
                Error loading CRESTORA25 event or event not found.
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 break-words">PDA Round Management</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Manage rounds for {crestoraEvent.name}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button 
              onClick={() => setIsCreateModalOpen(true)}
              className="gradient-hero w-full sm:w-auto"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Add Round</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* Event Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {crestoraEvent.name}
            </CardTitle>
            <CardDescription>
              {crestoraEvent.description || "No description available"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="text-center p-2 sm:p-3 bg-muted/30 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-primary">
                  {crestoraEvent.rounds?.length || 0}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Total Rounds</div>
              </div>
              <div className="text-center p-2 sm:p-3 bg-green-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-green-600">
                  {crestoraEvent.rounds?.filter(r => r.is_evaluated).length || 0}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Evaluated</div>
              </div>
              <div className="text-center p-2 sm:p-3 bg-blue-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-blue-600">
                  {crestoraEvent.rounds?.filter(r => r.is_frozen && !r.is_evaluated).length || 0}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Frozen</div>
              </div>
              <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-gray-600">
                  {crestoraEvent.rounds?.filter(r => !r.is_frozen && !r.is_evaluated).length || 0}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Active</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rounds List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Rounds ({crestoraEvent.rounds?.length || 0})
            </CardTitle>
            <CardDescription>
              Manage and configure all rounds for this event
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!crestoraEvent.rounds || crestoraEvent.rounds.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No rounds found. Create your first round to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {crestoraEvent.rounds
                  .sort((a, b) => a.round_number - b.round_number)
                  .map((round) => (
                    <Card key={round.id} className="border-l-4 border-l-primary">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                              <div className="text-base sm:text-lg font-bold text-primary">
                                Round {round.round_number}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className={`${getStatusColor(round)} text-xs`}>
                                  {getStatusText(round)}
                                </Badge>
                                {round.is_frozen && (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Frozen
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            <h3 className="font-semibold text-base sm:text-lg mb-2 break-words">{round.name}</h3>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-2">
                              <div className="flex items-center gap-1">
                                {getModeIcon(round.mode)}
                                <span>{round.mode || 'TBD'}</span>
                              </div>
                              {round.club && (
                                <div className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  <span className="break-words">{round.club}</span>
                                </div>
                              )}
                              {(round as any).venue && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span className="break-words">{(round as any).venue}</span>
                                </div>
                              )}
                            </div>
                            
                            {round.description && (
                              <p className="text-xs sm:text-sm text-muted-foreground mb-2 break-words">
                                {round.description}
                              </p>
                            )}
                            
                            {round.criteria && round.criteria.length > 0 && (
                              <div className="flex flex-wrap gap-1 sm:gap-2">
                                {round.criteria.map((criterion, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {criterion.name} ({criterion.max_points}pts)
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0 w-full lg:w-auto">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleNavigateToEvaluation(round)}
                                className="flex-1 sm:flex-none"
                              >
                                <Eye className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Evaluate</span>
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditRound(round)}
                                disabled={round.is_frozen}
                                className="flex-1 sm:flex-none"
                              >
                                <Edit className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReorderRounds(round, 'up')}
                                disabled={isReordering || round.round_number === 1}
                                className="flex-1 sm:flex-none"
                              >
                                <ArrowUp className="h-4 w-4" />
                                <span className="hidden sm:inline ml-1">Up</span>
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReorderRounds(round, 'down')}
                                disabled={isReordering || round.round_number === (crestoraEvent.rounds?.length || 0)}
                                className="flex-1 sm:flex-none"
                              >
                                <ArrowDown className="h-4 w-4" />
                                <span className="hidden sm:inline ml-1">Down</span>
                              </Button>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteRound(round)}
                                disabled={round.is_frozen}
                                className="text-red-600 hover:text-red-700 flex-1 sm:flex-none"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="hidden sm:inline ml-1">Delete</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Round Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="w-[95vw] sm:w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create New Round
              </DialogTitle>
              <DialogDescription>
                Add a new round to {crestoraEvent.name}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Round Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Team Introduction"
                  />
                </div>
                <div>
                  <Label htmlFor="mode">Mode *</Label>
                  <Select value={formData.mode} onValueChange={(value: 'online' | 'offline') => 
                    setFormData(prev => ({ ...prev, mode: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="club">Organizing Club</Label>
                  <Input
                    id="club"
                    value={formData.club}
                    onChange={(e) => setFormData(prev => ({ ...prev, club: e.target.value }))}
                    placeholder="e.g., PDA"
                  />
                </div>
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="venue">Venue</Label>
                <Input
                  id="venue"
                  value={formData.venue}
                  onChange={(e) => setFormData(prev => ({ ...prev, venue: e.target.value }))}
                  placeholder="e.g., Main Auditorium"
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the round..."
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="extended_description">Extended Description</Label>
                <Textarea
                  id="extended_description"
                  value={formData.extended_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, extended_description: e.target.value }))}
                  placeholder="Detailed description of the round..."
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="form_link">Form Link</Label>
                  <Input
                    id="form_link"
                    value={formData.form_link}
                    onChange={(e) => setFormData(prev => ({ ...prev, form_link: e.target.value }))}
                    placeholder="https://forms.google.com/..."
                  />
                </div>
                <div>
                  <Label htmlFor="contact">Contact</Label>
                  <Input
                    id="contact"
                    value={formData.contact}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                    placeholder="Contact person or email"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value: 'upcoming' | 'in_progress' | 'completed') => 
                  setFormData(prev => ({ ...prev, status: value }))
                }>
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
              
              {/* Criteria Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Evaluation Criteria</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addCriteria}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Criteria
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.criteria.map((criterion, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="Criteria name"
                        value={criterion.name}
                        onChange={(e) => updateCriteria(index, 'name', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Max points"
                        value={criterion.max_points}
                        onChange={(e) => updateCriteria(index, 'max_points', parseInt(e.target.value) || 0)}
                        className="w-24"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeCriteria(index)}
                        disabled={formData.criteria.length === 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateRound}
                disabled={!formData.name.trim() || createRoundMutation.isPending}
                className="gradient-hero"
              >
                {createRoundMutation.isPending ? "Creating..." : "Create Round"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Round Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="w-[95vw] sm:w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit Round
              </DialogTitle>
              <DialogDescription>
                Update round details for {editingRound?.name}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Round Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Team Introduction"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-mode">Mode *</Label>
                  <Select value={formData.mode} onValueChange={(value: 'online' | 'offline') => 
                    setFormData(prev => ({ ...prev, mode: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-club">Organizing Club</Label>
                  <Input
                    id="edit-club"
                    value={formData.club}
                    onChange={(e) => setFormData(prev => ({ ...prev, club: e.target.value }))}
                    placeholder="e.g., PDA"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-date">Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-venue">Venue</Label>
                <Input
                  id="edit-venue"
                  value={formData.venue}
                  onChange={(e) => setFormData(prev => ({ ...prev, venue: e.target.value }))}
                  placeholder="e.g., Main Auditorium"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the round..."
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-extended_description">Extended Description</Label>
                <Textarea
                  id="edit-extended_description"
                  value={formData.extended_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, extended_description: e.target.value }))}
                  placeholder="Detailed description of the round..."
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-form_link">Form Link</Label>
                  <Input
                    id="edit-form_link"
                    value={formData.form_link}
                    onChange={(e) => setFormData(prev => ({ ...prev, form_link: e.target.value }))}
                    placeholder="https://forms.google.com/..."
                  />
                </div>
                <div>
                  <Label htmlFor="edit-contact">Contact</Label>
                  <Input
                    id="edit-contact"
                    value={formData.contact}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                    placeholder="Contact person or email"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select value={formData.status} onValueChange={(value: 'upcoming' | 'in_progress' | 'completed') => 
                  setFormData(prev => ({ ...prev, status: value }))
                }>
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
              
              {/* Criteria Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Evaluation Criteria</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addCriteria}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Criteria
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.criteria.map((criterion, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="Criteria name"
                        value={criterion.name}
                        onChange={(e) => updateCriteria(index, 'name', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Max points"
                        value={criterion.max_points}
                        onChange={(e) => updateCriteria(index, 'max_points', parseInt(e.target.value) || 0)}
                        className="w-24"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeCriteria(index)}
                        disabled={formData.criteria.length === 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateRound}
                disabled={!formData.name.trim() || updateRoundMutation.isPending}
                className="gradient-hero"
              >
                {updateRoundMutation.isPending ? "Updating..." : "Update Round"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Round</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{roundToDelete?.name}"? This action cannot be undone.
                All evaluation data for this round will be permanently lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDeleteRound}
                disabled={deleteRoundMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteRoundMutation.isPending ? "Deleting..." : "Delete Round"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default PDARoundManagement;
