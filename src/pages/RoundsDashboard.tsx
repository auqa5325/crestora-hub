import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Settings
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

interface Round {
  id: number;
  event_id: string;
  round_number: number;
  name: string;
  mode?: 'online' | 'offline';
  club?: string;
  date?: string;
  description?: string;
  extended_description?: string;
  form_link?: string;
  contact?: string;
  status: 'upcoming' | 'in_progress' | 'completed';
  is_frozen: boolean;
  is_evaluated: boolean;
  is_wildcard?: boolean;
  max_score?: number;
  min_score?: number;
  avg_score?: number;
  participated_count?: number;
  criteria?: Array<{name: string, max_points: number}>;
  created_at: string;
  updated_at?: string;
}

interface Event {
  id: number;
  event_id: string;
  name: string;
  type: 'title' | 'rolling';
  rounds: Round[];
}

const RoundsDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [clubFilter, setClubFilter] = useState<string>("all");
  const [evaluatedRounds, setEvaluatedRounds] = useState<any[]>([]);
  const [roundWeights, setRoundWeights] = useState<Record<number, number>>({});

  const { data: events, isLoading, error } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: () => apiService.getEvents(),
    refetchInterval: 30000,
  });

  // Fetch evaluated rounds for weight configuration (same as leaderboard)
  const { data: evaluatedRoundsData, isLoading: evaluatedRoundsLoading } = useQuery({
    queryKey: ['evaluated-rounds'],
    queryFn: () => apiService.getEvaluatedRounds(),
    refetchInterval: 30000,
  });

  // Update weight mutation
  const updateWeightMutation = useMutation({
    mutationFn: ({ roundId, weight }: { roundId: number; weight: number }) =>
      apiService.updateRoundWeight(roundId, weight),
    onSuccess: () => {
      toast({
        title: "Weight updated",
        description: "Round weight has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['evaluated-rounds'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update weight. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle evaluated rounds data
  useEffect(() => {
    if (evaluatedRoundsData?.evaluated_rounds) {
      setEvaluatedRounds(evaluatedRoundsData.evaluated_rounds);
      // Initialize weights state
      const weights: Record<number, number> = {};
      evaluatedRoundsData.evaluated_rounds.forEach((round: any) => {
        weights[round.round_id] = round.weight_percentage;
      });
      setRoundWeights(weights);
    }
  }, [evaluatedRoundsData]);

  // Handle weight change
  const handleWeightChange = (roundId: number, newWeight: number) => {
    setRoundWeights(prev => ({
      ...prev,
      [roundId]: newWeight
    }));
  };

  // Save all weights
  const saveAllWeights = async () => {
    try {
      const promises = Object.entries(roundWeights).map(([roundId, weight]) =>
        updateWeightMutation.mutateAsync({ roundId: parseInt(roundId), weight })
      );
      await Promise.all(promises);
      toast({
        title: "All weights updated",
        description: "All round weights have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update some weights. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Extract all rounds from events
  const allRounds = events?.flatMap(event => 
    event.rounds.map(round => ({
      ...round,
      event_name: event.name,
      event_type: event.type
    }))
  ) || [];

  // Filter rounds based on user role
  const availableRounds = user?.role === 'admin' 
    ? allRounds 
    : allRounds.filter(round => round.club === user?.club);

  // Get unique clubs for filter
  const clubs = [...new Set(allRounds.map(round => round.club).filter(Boolean))];

  // Filter rounds based on search and filters
  const filteredRounds = availableRounds.filter(round => {
    const matchesSearch = round.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         round.club?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         round.event_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && !round.is_frozen && !round.is_evaluated) ||
      (statusFilter === "frozen" && round.is_frozen && !round.is_evaluated) ||
      (statusFilter === "evaluated" && round.is_evaluated);
    const matchesMode = modeFilter === "all" || round.mode === modeFilter;
    const matchesClub = clubFilter === "all" || round.club === clubFilter;

    return matchesSearch && matchesStatus && matchesMode && matchesClub;
  });

  // Calculate statistics
  const stats = {
    total: availableRounds.length,
    active: availableRounds.filter(r => !r.is_frozen && !r.is_evaluated).length,
    frozen: availableRounds.filter(r => r.is_frozen && !r.is_evaluated).length,
    evaluated: availableRounds.filter(r => r.is_evaluated).length,
    online: availableRounds.filter(r => r.mode === 'online').length,
    offline: availableRounds.filter(r => r.mode === 'offline').length,
    byClub: clubs.reduce((acc, club) => {
      acc[club] = availableRounds.filter(r => r.club === club).length;
      return acc;
    }, {} as Record<string, number>)
  };

  // Handle round evaluation navigation
  const handleEvaluateRound = (roundId: number) => {
    // Find the round to check if it's a wildcard round
    const round = allRounds.find(r => r.id === roundId);
    if (round?.is_wildcard) {
      navigate(`/wildcard-round-evaluation?roundId=${roundId}`);
    } else {
      navigate(`/round-evaluation?roundId=${roundId}`);
    }
  };


  const formatMode = (mode?: string) => {
    if (!mode) return "N/A";
    return mode === "online" ? "Online" : "Offline";
  };

  const getStatusColor = (round: Round) => {
    // Check the actual status field first, then fall back to is_evaluated/is_frozen
    const status = (round as any).status;
    if (status === 'completed' || round.is_evaluated) return "bg-green-100 text-green-800 border-green-200";
    if (status === 'in_progress' || round.is_frozen) return "bg-blue-100 text-blue-800 border-blue-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getStatusText = (round: Round) => {
    // Check the actual status field first, then fall back to is_evaluated/is_frozen
    const status = (round as any).status;
    if (status === 'completed' || round.is_evaluated) return "Completed";
    if (status === 'in_progress' || round.is_frozen) return "In Progress";
    return "Upcoming";
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Rounds Dashboard</h1>
              <p className="text-muted-foreground">
                Loading rounds data...
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
            <h1 className="text-3xl font-bold mb-2">Rounds Dashboard</h1>
            <p className="text-muted-foreground text-red-500">
              Error loading rounds data. Please try again.
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
            <h1 className="text-3xl font-bold mb-2">Rounds Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of all competition rounds and their status
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rounds</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                Across all events
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CircleDot className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
              <p className="text-xs text-muted-foreground">
                Currently active
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Frozen</CardTitle>
              <CircleX className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.frozen}</div>
              <p className="text-xs text-muted-foreground">
                Frozen rounds
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Evaluated</CardTitle>
              <CircleCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.evaluated}</div>
              <p className="text-xs text-muted-foreground">
                Shortlisted rounds
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Mode Statistics */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Online Rounds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.online}</div>
              <p className="text-sm text-muted-foreground">
                Virtual competitions
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Offline Rounds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.offline}</div>
              <p className="text-sm text-muted-foreground">
                In-person events
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Club Statistics */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Rounds by Club
            </CardTitle>
            <CardDescription>
              Distribution of rounds across organizing clubs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(stats.byClub).map(([club, count]) => (
                <div key={club} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{club}</span>
                  <Badge variant="secondary">{count} rounds</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Round Weight Configuration */}
        {evaluatedRounds.length > 0 && user?.role === 'admin' ? (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Round Weight Configuration
              </CardTitle>
              <CardDescription>
                Configure weight percentages for frozen rounds. These weights affect the final leaderboard calculations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Round Name</th>
                        <th className="text-left p-2 font-medium">Event ID</th>
                        <th className="text-left p-2 font-medium">Weightage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluatedRounds.map((round) => (
                        <tr key={round.round_id} className="border-b">
                          <td className="p-2">
                            <div className="font-medium">{round.round_name}</div>
                          </td>
                          <td className="p-2">
                            <div className="text-sm text-muted-foreground">{round.event_id}</div>
                          </td>
                          <td className="p-2">
                            <RadioGroup 
                              value={roundWeights[round.round_id]?.toString() || "100"} 
                              onValueChange={(value) => handleWeightChange(round.round_id, parseInt(value))}
                              className="flex flex-row gap-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="25" id={`${round.round_id}-25`} />
                                <Label htmlFor={`${round.round_id}-25`} className="text-sm">25%</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="50" id={`${round.round_id}-50`} />
                                <Label htmlFor={`${round.round_id}-50`} className="text-sm">50%</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="75" id={`${round.round_id}-75`} />
                                <Label htmlFor={`${round.round_id}-75`} className="text-sm">75%</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="100" id={`${round.round_id}-100`} />
                                <Label htmlFor={`${round.round_id}-100`} className="text-sm">100%</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="200" id={`${round.round_id}-200`} />
                                <Label htmlFor={`${round.round_id}-200`} className="text-sm">200%</Label>
                              </div>
                            </RadioGroup>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <Button 
                    onClick={saveAllWeights}
                    disabled={updateWeightMutation.isPending}
                    className="gradient-hero"
                  >
                    {updateWeightMutation.isPending ? "Saving..." : "Save All Weights"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : evaluatedRounds.length > 0 ? (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Round Weight Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Only PDA administrators can configure round weights.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Filters */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search rounds..."
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
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="frozen">Frozen</SelectItem>
                    <SelectItem value="evaluated">Evaluated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Mode</label>
                <Select value={modeFilter} onValueChange={setModeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All modes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
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

        {/* Rounds List */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              All Rounds ({filteredRounds.length})
            </CardTitle>
            <CardDescription>
              Detailed view of all competition rounds
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredRounds.map((round) => (
                <div key={round.id} className="border rounded-lg p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-col gap-2">
                        <h3 className="font-semibold text-base sm:text-lg break-words">{round.name}</h3>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className={`${getStatusColor(round)} text-xs`}>
                            {getStatusText(round)}
                          </Badge>
                          {round.is_frozen && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                              Frozen
                            </Badge>
                          )}
                          {round.is_evaluated && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                              Evaluated
                            </Badge>
                          )}
                          {round.is_wildcard && (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                              <Target className="h-3 w-3 mr-1" />
                              Wildcard
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Hash className="h-4 w-4 flex-shrink-0" />
                          <span>Round {round.round_number}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 flex-shrink-0" />
                          <span className="break-words">{round.club || 'No club assigned'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {round.mode === 'online' ? <Globe className="h-4 w-4 flex-shrink-0" /> : <Building className="h-4 w-4 flex-shrink-0" />}
                          <span>{formatMode(round.mode)}</span>
                        </div>
                        {round.date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 flex-shrink-0" />
                            <span>{new Date(round.date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-sm">
                        <span className="font-medium">Event:</span> <span className="break-words">{round.event_name} ({round.event_type})</span>
                      </div>

                      {round.description && (
                        <p className="text-sm text-muted-foreground mt-2 break-words">
                          {round.description}
                        </p>
                      )}
                      {round.extended_description && (
                        <div className="text-sm text-muted-foreground mt-1 break-words">
                          <span className="font-medium">Details:</span> 
                          <ReadMoreText text={round.extended_description} maxLength={100} />
                        </div>
                      )}
                      {(round.form_link || round.contact) && (
                        <div className="mt-2 space-y-1">
                          {round.form_link && (
                            <div className="flex items-center gap-1 text-xs">
                              <Globe className="h-3 w-3" />
                              <a 
                                href={round.form_link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline break-all"
                              >
                                Registration Form
                              </a>
                            </div>
                          )}
                          {round.contact && (
                            <div className="flex items-center gap-1 text-xs">
                              <Users className="h-3 w-3" />
                              <span>Contact: {round.contact}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Show evaluation statistics for frozen rounds */}
                      {round.is_frozen && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <h4 className="font-medium text-sm mb-2">Evaluation Results:</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="break-words">
                              <span className="font-medium">Max Score:</span> {round.max_score?.toFixed(1) || 'N/A'}
                            </div>
                            <div className="break-words">
                              <span className="font-medium">Min Score:</span> {round.min_score?.toFixed(1) || 'N/A'}
                            </div>
                            <div className="break-words">
                              <span className="font-medium">Avg Score:</span> {round.avg_score?.toFixed(1) || 'N/A'}
                            </div>
                            <div className="break-words">
                              <span className="font-medium">Teams:</span> {round.participated_count || 0}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Evaluate/View Button */}
                    <div className="flex justify-end sm:justify-start">
                      {round.is_frozen ? (
                        <Button
                          variant="outline"
                          onClick={() => handleEvaluateRound(round.id)}
                          className="flex items-center gap-2 w-full sm:w-auto"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden xs:inline">View Evaluation</span>
                          <span className="xs:hidden">View</span>
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleEvaluateRound(round.id)}
                          className="flex items-center gap-2 gradient-hero w-full sm:w-auto"
                        >
                          <Play className="h-4 w-4" />
                          <span className="hidden xs:inline">Evaluate</span>
                          <span className="xs:hidden">Start</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {filteredRounds.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No rounds found matching your filters.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default RoundsDashboard;
