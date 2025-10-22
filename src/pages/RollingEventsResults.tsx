import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Trophy, 
  Medal, 
  Award, 
  Plus, 
  Save, 
  Lock, 
  CheckCircle,
  Download,
  RefreshCw,
  Edit,
  X,
  Crown,
  Users,
  Calendar,
  Building2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService, RollingEventResult, RollingEventResultCreate, AvailableRollingEvent } from "@/services/api";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Department and year options
const DEPARTMENT_OPTIONS = [
  { value: "Artificial Intelligence and Data Science", label: "Artificial Intelligence and Data Science" },
  { value: "Aerospace Engineering", label: "Aerospace Engineering" },
  { value: "Automobile Engineering", label: "Automobile Engineering" },
  { value: "Computer Technology", label: "Computer Technology" },
  { value: "Electronics and Communication Engineering", label: "Electronics and Communication Engineering" },
  { value: "Electronics and Instrumentation Engineering", label: "Electronics and Instrumentation Engineering" },
  { value: "Production Technology", label: "Production Technology" },
  { value: "Robotics and Automation", label: "Robotics and Automation" },
  { value: "Rubber and Plastics Technology", label: "Rubber and Plastics Technology" },
  { value: "Information Technology", label: "Information Technology" }
];

const YEAR_OPTIONS = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" }
];

const RollingEventsResults = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State management
  const [selectedEvent, setSelectedEvent] = useState<AvailableRollingEvent | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFreezeDialogOpen, setIsFreezeDialogOpen] = useState(false);
  const [freezingEventId, setFreezingEventId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingResult, setEditingResult] = useState<RollingEventResult | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    event_id: "",
    winner_name: "",
    winner_register_number: "",
    winner_email: "",
    winner_phone: "",
    winner_department: "",
    winner_year: "",
    runner_up_name: "",
    runner_up_register_number: "",
    runner_up_email: "",
    runner_up_phone: "",
    runner_up_department: "",
    runner_up_year: "",
    club: user?.club || ""
  });

  // Fetch available rolling events
  const { data: availableEvents, isLoading: eventsLoading } = useQuery<AvailableRollingEvent[]>({
    queryKey: ['available-rolling-events'],
    queryFn: () => apiService.getAvailableRollingEvents(),
    refetchInterval: 30000,
  });

  // Fetch rolling results
  const { data: rollingResults, isLoading: resultsLoading, refetch } = useQuery<RollingEventResult[]>({
    queryKey: ['rolling-results'],
    queryFn: () => apiService.getRollingResults(),
    refetchInterval: 30000,
  });

  // Create/Update result mutation
  const createResultMutation = useMutation({
    mutationFn: (resultData: RollingEventResultCreate) => apiService.createRollingResult(resultData),
    onSuccess: () => {
      toast.success("Rolling event result saved successfully!");
      queryClient.invalidateQueries({ queryKey: ['rolling-results'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to save result. Please try again.";
      toast.error(errorMessage);
    },
  });

  // Freeze result mutation
  const freezeResultMutation = useMutation({
    mutationFn: (eventId: string) => apiService.freezeRollingResult(eventId),
    onSuccess: () => {
      toast.success("Rolling event result frozen successfully!");
      queryClient.invalidateQueries({ queryKey: ['rolling-results'] });
      setIsFreezeDialogOpen(false);
      setFreezingEventId(null);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to freeze result. Please try again.";
      toast.error(errorMessage);
    },
  });

  // Evaluate result mutation
  const evaluateResultMutation = useMutation({
    mutationFn: (eventId: string) => apiService.evaluateRollingResult(eventId),
    onSuccess: () => {
      toast.success("Rolling event result evaluated successfully!");
      queryClient.invalidateQueries({ queryKey: ['rolling-results'] });
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to evaluate result. Please try again.";
      toast.error(errorMessage);
    },
  });

  // Update result mutation
  const updateResultMutation = useMutation({
    mutationFn: ({ eventId, data }: { eventId: string; data: any }) => apiService.updateRollingResult(eventId, data),
    onSuccess: () => {
      toast.success("Rolling event result updated successfully!");
      queryClient.invalidateQueries({ queryKey: ['rolling-results'] });
      setIsEditModalOpen(false);
      setEditingResult(null);
      resetForm();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to update result. Please try again.";
      toast.error(errorMessage);
    },
  });

  // Export all results
  const exportResults = async () => {
    try {
      const blob = await apiService.exportRollingResults();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rolling_events_results.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("All results exported successfully!");
    } catch (error) {
      toast.error("Failed to export results. Please try again.");
    }
  };


  // Form handlers
  const handleEventSelect = (eventId: string) => {
    const event = availableEvents?.find(e => e.event_id === eventId);
    setSelectedEvent(event || null);
    setFormData(prev => ({
      ...prev,
      event_id: eventId,
      club: event?.club || user?.club || ""
    }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      event_id: "",
      winner_name: "",
      winner_register_number: "",
      winner_email: "",
      winner_phone: "",
      winner_department: "",
      winner_year: "",
      runner_up_name: "",
      runner_up_register_number: "",
      runner_up_email: "",
      runner_up_phone: "",
      runner_up_department: "",
      runner_up_year: "",
      club: user?.club || ""
    });
    setSelectedEvent(null);
  };

  const handleEditResult = (result: RollingEventResult) => {
    setEditingResult(result);
    setFormData({
      event_id: result.event_id,
      winner_name: result.winner_name,
      winner_register_number: result.winner_register_number,
      winner_email: result.winner_email,
      winner_phone: result.winner_phone,
      winner_department: result.winner_department,
      winner_year: result.winner_year,
      runner_up_name: result.runner_up_name,
      runner_up_register_number: result.runner_up_register_number,
      runner_up_email: result.runner_up_email,
      runner_up_phone: result.runner_up_phone,
      runner_up_department: result.runner_up_department,
      runner_up_year: result.runner_up_year,
      club: result.club
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateResult = () => {
    if (!editingResult) return;
    
    const updateData = {
      winner_name: formData.winner_name,
      winner_register_number: formData.winner_register_number,
      winner_email: formData.winner_email,
      winner_phone: formData.winner_phone,
      winner_department: formData.winner_department,
      winner_year: formData.winner_year,
      runner_up_name: formData.runner_up_name,
      runner_up_register_number: formData.runner_up_register_number,
      runner_up_email: formData.runner_up_email,
      runner_up_phone: formData.runner_up_phone,
      runner_up_department: formData.runner_up_department,
      runner_up_year: formData.runner_up_year
    };
    
    updateResultMutation.mutate({ eventId: editingResult.event_id, data: updateData });
  };

  const handleCreateResult = () => {
    // Validate required fields
    if (!formData.event_id) {
      toast.error("Please select an event");
      return;
    }
    if (!formData.winner_name.trim()) {
      toast.error("Winner name is required");
      return;
    }
    if (!formData.winner_register_number.trim()) {
      toast.error("Winner register number is required");
      return;
    }
    if (!formData.winner_email.trim()) {
      toast.error("Winner email is required");
      return;
    }
    if (!formData.winner_phone.trim()) {
      toast.error("Winner phone is required");
      return;
    }
    if (!formData.winner_department) {
      toast.error("Winner department is required");
      return;
    }
    if (!formData.winner_year) {
      toast.error("Winner year is required");
      return;
    }
    if (!formData.runner_up_name.trim()) {
      toast.error("Runner-up name is required");
      return;
    }
    if (!formData.runner_up_register_number.trim()) {
      toast.error("Runner-up register number is required");
      return;
    }
    if (!formData.runner_up_email.trim()) {
      toast.error("Runner-up email is required");
      return;
    }
    if (!formData.runner_up_phone.trim()) {
      toast.error("Runner-up phone is required");
      return;
    }
    if (!formData.runner_up_department) {
      toast.error("Runner-up department is required");
      return;
    }
    if (!formData.runner_up_year) {
      toast.error("Runner-up year is required");
      return;
    }

    setIsCreating(true);
    createResultMutation.mutate({
      event_id: formData.event_id,
      winner_name: formData.winner_name.trim(),
      winner_register_number: formData.winner_register_number.trim(),
      winner_email: formData.winner_email.trim(),
      winner_phone: formData.winner_phone.trim(),
      winner_department: formData.winner_department,
      winner_year: formData.winner_year,
      runner_up_name: formData.runner_up_name.trim(),
      runner_up_register_number: formData.runner_up_register_number.trim(),
      runner_up_email: formData.runner_up_email.trim(),
      runner_up_phone: formData.runner_up_phone.trim(),
      runner_up_department: formData.runner_up_department,
      runner_up_year: formData.runner_up_year,
      club: formData.club.trim()
    });
  };

  const handleFreezeResult = (eventId: string) => {
    setFreezingEventId(eventId);
    setIsFreezeDialogOpen(true);
  };

  const handleEvaluateResult = (eventId: string) => {
    evaluateResultMutation.mutate(eventId);
  };

  const getStatusColor = (isFrozen: boolean, isEvaluated: boolean) => {
    if (isEvaluated) {
      return "bg-green-100 text-green-800 border-green-200";
    } else if (isFrozen) {
      return "bg-blue-100 text-blue-800 border-blue-200";
    } else {
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  const getStatusText = (isFrozen: boolean, isEvaluated: boolean) => {
    if (isEvaluated) {
      return "Evaluated";
    } else if (isFrozen) {
      return "Frozen";
    } else {
      return "Draft";
    }
  };

  const canFreeze = (result: RollingEventResult) => {
    if (user?.role === 'admin') return true;
    if (user?.role === 'clubs' && result.club === user.club) return true;
    return false;
  };

  const canEvaluate = (result: RollingEventResult) => {
    return user?.role === 'admin' && result.is_frozen && !result.is_evaluated;
  };

  const canEdit = (result: RollingEventResult) => {
    if (result.is_frozen || result.is_evaluated) return false;
    if (user?.role === 'admin') return true;
    if (user?.role === 'clubs' && result.club === user.club) return true;
    return false;
  };

  if (eventsLoading || resultsLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Rolling Events Results</h1>
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div>
            <h1 className="text-2xl font-bold mb-2 sm:text-3xl">Rolling Events Results</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Manage winners and runners-up for rolling events
            </p>
          </div>
          <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:gap-2">
            <Button 
              variant="outline"
              onClick={() => refetch()}
              disabled={resultsLoading}
              size="sm"
              className="w-full sm:w-auto"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button 
              variant="outline"
              onClick={exportResults}
              size="sm"
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Export All</span>
            </Button>
            <Button 
              className="gradient-hero w-full sm:w-auto"
              onClick={() => setIsCreateModalOpen(true)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Results
            </Button>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rollingResults?.map((result) => (
            <Card key={result.id} className="shadow-card hover:shadow-elevated transition-all">
              <CardHeader className="pb-3">
                <div className="flex flex-col space-y-2 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
                  <Badge className={getStatusColor(result.is_frozen, result.is_evaluated)}>
                    {getStatusText(result.is_frozen, result.is_evaluated)}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">
                      {result.event_id}
                    </span>
                  </div>
                </div>
                <CardTitle className="text-base sm:text-lg leading-tight">
                  {result.event_name || result.event_id}
                </CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Building2 className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{result.club}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Winner */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-yellow-700">Winner</span>
                  </div>
                  <div className="pl-6 space-y-1">
                    <p className="font-semibold text-sm sm:text-base truncate">{result.winner_name}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Reg: {result.winner_register_number}
                    </p>
                    {result.winner_email && (
                      <p className="text-xs text-muted-foreground truncate">
                        Email: {result.winner_email}
                      </p>
                    )}
                    {result.winner_phone && (
                      <p className="text-xs text-muted-foreground">
                        Phone: {result.winner_phone}
                      </p>
                    )}
                    {result.winner_department && (
                      <p className="text-xs text-muted-foreground truncate">
                        Dept: {result.winner_department}
                      </p>
                    )}
                    {result.winner_year && (
                      <p className="text-xs text-muted-foreground">
                        Year: {YEAR_OPTIONS.find(y => y.value === result.winner_year)?.label || result.winner_year}
                      </p>
                    )}
                  </div>
                </div>

                {/* Runner-up */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Medal className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-700">Runner-up</span>
                  </div>
                  <div className="pl-6 space-y-1">
                    <p className="font-semibold text-sm sm:text-base truncate">{result.runner_up_name}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Reg: {result.runner_up_register_number}
                    </p>
                    {result.runner_up_email && (
                      <p className="text-xs text-muted-foreground truncate">
                        Email: {result.runner_up_email}
                      </p>
                    )}
                    {result.runner_up_phone && (
                      <p className="text-xs text-muted-foreground">
                        Phone: {result.runner_up_phone}
                      </p>
                    )}
                    {result.runner_up_department && (
                      <p className="text-xs text-muted-foreground truncate">
                        Dept: {result.runner_up_department}
                      </p>
                    )}
                    {result.runner_up_year && (
                      <p className="text-xs text-muted-foreground">
                        Year: {YEAR_OPTIONS.find(y => y.value === result.runner_up_year)?.label || result.runner_up_year}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:gap-2 pt-2">
                  {canEdit(result) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditResult(result)}
                      className="flex-1 w-full sm:w-auto"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      <span className="hidden xs:inline">Edit</span>
                    </Button>
                  )}
                  {canFreeze(result) && !result.is_frozen && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleFreezeResult(result.event_id)}
                      className="flex-1 w-full sm:w-auto"
                    >
                      <Lock className="h-3 w-3 mr-1" />
                      <span className="hidden xs:inline">Freeze</span>
                    </Button>
                  )}
                  {canEvaluate(result) && (
                    <Button
                      size="sm"
                      onClick={() => handleEvaluateResult(result.event_id)}
                      className="flex-1 w-full sm:w-auto bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      <span className="hidden xs:inline">Evaluate</span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {rollingResults?.length === 0 && (
          <Card>
            <CardContent className="p-4 sm:p-6 text-center">
              <Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">No Results Yet</h3>
              <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                Start by adding results for rolling events.
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)} size="sm" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add First Result
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create Result Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Rolling Event Results</DialogTitle>
              <DialogDescription>
                Enter winner and runner-up details for a rolling event
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="event-select">Select Event</Label>
                <Select value={formData.event_id} onValueChange={handleEventSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a rolling event" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEvents?.map((event) => (
                      <SelectItem key={event.event_id} value={event.event_id}>
                        {event.name} - {event.club}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedEvent && (
                <div className="space-y-6">
                  {/* Winner Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Crown className="h-4 w-4 text-yellow-500" />
                      <h3 className="font-semibold text-yellow-700">Winner Details</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="winner-name">Name *</Label>
                        <Input
                          id="winner-name"
                          value={formData.winner_name}
                          onChange={(e) => handleInputChange('winner_name', e.target.value)}
                          placeholder="Enter winner's name"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="winner-reg">Register Number *</Label>
                        <Input
                          id="winner-reg"
                          value={formData.winner_register_number}
                          onChange={(e) => handleInputChange('winner_register_number', e.target.value)}
                          placeholder="Enter register number"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="winner-email">Email *</Label>
                        <Input
                          id="winner-email"
                          type="email"
                          value={formData.winner_email}
                          onChange={(e) => handleInputChange('winner_email', e.target.value)}
                          placeholder="Enter email address"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="winner-phone">Phone *</Label>
                        <Input
                          id="winner-phone"
                          value={formData.winner_phone}
                          onChange={(e) => handleInputChange('winner_phone', e.target.value)}
                          placeholder="Enter phone number"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="winner-department">Department *</Label>
                        <Select value={formData.winner_department} onValueChange={(value) => handleInputChange('winner_department', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENT_OPTIONS.map((dept) => (
                              <SelectItem key={dept.value} value={dept.value}>
                                {dept.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="winner-year">Year *</Label>
                        <Select value={formData.winner_year} onValueChange={(value) => handleInputChange('winner_year', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            {YEAR_OPTIONS.map((year) => (
                              <SelectItem key={year.value} value={year.value}>
                                {year.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Runner-up Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Medal className="h-4 w-4 text-gray-500" />
                      <h3 className="font-semibold text-gray-700">Runner-up Details</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="runner-up-name">Name *</Label>
                        <Input
                          id="runner-up-name"
                          value={formData.runner_up_name}
                          onChange={(e) => handleInputChange('runner_up_name', e.target.value)}
                          placeholder="Enter runner-up's name"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="runner-up-reg">Register Number *</Label>
                        <Input
                          id="runner-up-reg"
                          value={formData.runner_up_register_number}
                          onChange={(e) => handleInputChange('runner_up_register_number', e.target.value)}
                          placeholder="Enter register number"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="runner-up-email">Email *</Label>
                        <Input
                          id="runner-up-email"
                          type="email"
                          value={formData.runner_up_email}
                          onChange={(e) => handleInputChange('runner_up_email', e.target.value)}
                          placeholder="Enter email address"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="runner-up-phone">Phone *</Label>
                        <Input
                          id="runner-up-phone"
                          value={formData.runner_up_phone}
                          onChange={(e) => handleInputChange('runner_up_phone', e.target.value)}
                          placeholder="Enter phone number"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="runner-up-department">Department *</Label>
                        <Select value={formData.runner_up_department} onValueChange={(value) => handleInputChange('runner_up_department', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENT_OPTIONS.map((dept) => (
                              <SelectItem key={dept.value} value={dept.value}>
                                {dept.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="runner-up-year">Year *</Label>
                        <Select value={formData.runner_up_year} onValueChange={(value) => handleInputChange('runner_up_year', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            {YEAR_OPTIONS.map((year) => (
                              <SelectItem key={year.value} value={year.value}>
                                {year.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetForm();
                }}
                disabled={isCreating}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={handleCreateResult}
                disabled={isCreating || !selectedEvent}
                className="gradient-hero"
              >
                <Save className="h-4 w-4 mr-2" />
                {isCreating ? "Saving..." : "Save Results"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Result Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Rolling Event Results</DialogTitle>
              <DialogDescription>
                Update winner and runner-up details for {editingResult?.event_name || editingResult?.event_id}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Winner Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <h3 className="font-semibold text-yellow-700">Winner Details</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-winner-name">Name *</Label>
                    <Input
                      id="edit-winner-name"
                      value={formData.winner_name}
                      onChange={(e) => handleInputChange('winner_name', e.target.value)}
                      placeholder="Enter winner's name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-winner-reg">Register Number *</Label>
                    <Input
                      id="edit-winner-reg"
                      value={formData.winner_register_number}
                      onChange={(e) => handleInputChange('winner_register_number', e.target.value)}
                      placeholder="Enter register number"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-winner-email">Email *</Label>
                    <Input
                      id="edit-winner-email"
                      type="email"
                      value={formData.winner_email}
                      onChange={(e) => handleInputChange('winner_email', e.target.value)}
                      placeholder="Enter email address"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-winner-phone">Phone *</Label>
                    <Input
                      id="edit-winner-phone"
                      value={formData.winner_phone}
                      onChange={(e) => handleInputChange('winner_phone', e.target.value)}
                      placeholder="Enter phone number"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-winner-department">Department *</Label>
                    <Select value={formData.winner_department} onValueChange={(value) => handleInputChange('winner_department', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENT_OPTIONS.map((dept) => (
                          <SelectItem key={dept.value} value={dept.value}>
                            {dept.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-winner-year">Year *</Label>
                    <Select value={formData.winner_year} onValueChange={(value) => handleInputChange('winner_year', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {YEAR_OPTIONS.map((year) => (
                          <SelectItem key={year.value} value={year.value}>
                            {year.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Runner-up Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Medal className="h-4 w-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-700">Runner-up Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-runner-up-name">Name *</Label>
                    <Input
                      id="edit-runner-up-name"
                      value={formData.runner_up_name}
                      onChange={(e) => handleInputChange('runner_up_name', e.target.value)}
                      placeholder="Enter runner-up's name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-runner-up-reg">Register Number *</Label>
                    <Input
                      id="edit-runner-up-reg"
                      value={formData.runner_up_register_number}
                      onChange={(e) => handleInputChange('runner_up_register_number', e.target.value)}
                      placeholder="Enter register number"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-runner-up-email">Email *</Label>
                    <Input
                      id="edit-runner-up-email"
                      type="email"
                      value={formData.runner_up_email}
                      onChange={(e) => handleInputChange('runner_up_email', e.target.value)}
                      placeholder="Enter email address"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-runner-up-phone">Phone *</Label>
                    <Input
                      id="edit-runner-up-phone"
                      value={formData.runner_up_phone}
                      onChange={(e) => handleInputChange('runner_up_phone', e.target.value)}
                      placeholder="Enter phone number"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-runner-up-department">Department *</Label>
                    <Select value={formData.runner_up_department} onValueChange={(value) => handleInputChange('runner_up_department', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENT_OPTIONS.map((dept) => (
                          <SelectItem key={dept.value} value={dept.value}>
                            {dept.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-runner-up-year">Year *</Label>
                    <Select value={formData.runner_up_year} onValueChange={(value) => handleInputChange('runner_up_year', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {YEAR_OPTIONS.map((year) => (
                          <SelectItem key={year.value} value={year.value}>
                            {year.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingResult(null);
                  resetForm();
                }}
                disabled={updateResultMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateResult}
                disabled={updateResultMutation.isPending}
                className="gradient-hero"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateResultMutation.isPending ? "Updating..." : "Update Results"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Freeze Confirmation Dialog */}
        <AlertDialog open={isFreezeDialogOpen} onOpenChange={setIsFreezeDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Freeze Rolling Event Results</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to freeze these results? This action cannot be undone and will prevent further editing.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={freezeResultMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => freezingEventId && freezeResultMutation.mutate(freezingEventId)}
                disabled={freezeResultMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {freezeResultMutation.isPending ? "Freezing..." : "Freeze Results"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default RollingEventsResults;
