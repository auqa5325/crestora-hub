import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  Trophy, 
  Medal, 
  Award, 
  TrendingUp, 
  Users, 
  Star,
  Crown,
  Settings,
  Download,
  Filter,
  RefreshCw,
  Mail,
  Send,
  ChevronLeft,
  ChevronRight,
  Building2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService, Team, LeaderboardData, LeaderboardTeam, RoundWeight, EvaluatedRound, RollingEventResult } from "@/services/api";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Leaderboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [evaluatedRounds, setEvaluatedRounds] = useState<EvaluatedRound[]>([]);
  const [roundWeights, setRoundWeights] = useState<Record<number, number>>({});
  
  // Shortlist state
  const [isShortlistModalOpen, setIsShortlistModalOpen] = useState(false);
  const [isShortlistConfirmOpen, setIsShortlistConfirmOpen] = useState(false);
  const [shortlistType, setShortlistType] = useState<'top_k' | 'threshold'>('top_k');
  const [shortlistValue, setShortlistValue] = useState<number>(5);

  // Email export state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<string>('');
  const [eventName, setEventName] = useState<string>("Crestora'25");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: teams, isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => apiService.getTeams({ limit: 100 }),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch evaluated rounds
  const { data: evaluatedRoundsData, isLoading: evaluatedRoundsLoading, refetch: refetchEvaluatedRounds } = useQuery({
    queryKey: ['evaluated-rounds'],
    queryFn: () => apiService.getEvaluatedRounds(),
    refetchOnWindowFocus: true, // Refresh when window gains focus
    refetchOnReconnect: true, // Refresh when reconnecting
    staleTime: 10 * 1000, // 10 seconds - shorter stale time for more frequent updates
  });

  // Handle evaluated rounds data
  useEffect(() => {
    if (evaluatedRoundsData?.evaluated_rounds) {
      setEvaluatedRounds(evaluatedRoundsData.evaluated_rounds);
      // Initialize weights state
      const weights: Record<number, number> = {};
      evaluatedRoundsData.evaluated_rounds.forEach(round => {
        weights[round.round_id] = round.weight_percentage;
      });
      setRoundWeights(weights);
    }
  }, [evaluatedRoundsData]);

  // Refresh data when component mounts to check for new frozen rounds
  useEffect(() => {
    const refreshData = async () => {
      await Promise.all([
        refetchEvaluatedRounds(),
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
      ]);
    };
    
    refreshData();
  }, []); // Run once on mount

  // Fetch leaderboard data
  const { data: leaderboardData, isLoading: leaderboardLoading, isFetching: leaderboardFetching } = useQuery<LeaderboardData>({
    queryKey: ['leaderboard'],
    queryFn: () => apiService.getLeaderboard(),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 10 * 1000, // 10 seconds - shorter for weight changes
  });

  // Fetch rolling event results
  const { data: rollingResults, isLoading: rollingResultsLoading } = useQuery<RollingEventResult[]>({
    queryKey: ['rolling-results'],
    queryFn: () => apiService.getRollingResults({ is_evaluated: true }),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Update weight mutation - optimized for batch updates
  const updateWeightMutation = useMutation({
    mutationFn: ({ roundId, weight }: { roundId: number; weight: number }) =>
      apiService.updateRoundWeight(roundId, weight),
    onSuccess: () => {
      // Don't show individual success toasts for batch operations
      // Force refresh leaderboard to update scores after weight change
      queryClient.invalidateQueries({ 
        queryKey: ['leaderboard']
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update weight. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Shortlist teams mutation
  const shortlistTeamsMutation = useMutation({
    mutationFn: ({ shortlistType, value }: { shortlistType: 'top_k' | 'threshold'; value: number }) =>
      apiService.shortlistTeamsByOverallScore(shortlistType, value),
    onSuccess: async (data) => {
      toast({
        title: "Teams Shortlisted Successfully",
        description: `${data.shortlisted_count} teams shortlisted, ${data.eliminated_count} teams eliminated. ${data.frozen_rounds_count} rounds marked as evaluated.`,
      });
      
      // Force refresh all related data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teams'] }),
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
        queryClient.invalidateQueries({ queryKey: ['evaluated-rounds'] })
      ]);
      
      // Close modals
      setIsShortlistModalOpen(false);
      setIsShortlistConfirmOpen(false);
      
      // Show success message after refresh
      setTimeout(() => {
        toast({
          title: "Leaderboard Updated",
          description: "The leaderboard has been refreshed with the latest team standings.",
        });
      }, 1000);
    },
    onError: (error: any) => {
      console.error('Shortlist error:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to shortlist teams. Please try again.";
      toast({
        title: "Shortlisting Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Email export mutation
  const emailExportMutation = useMutation({
    mutationFn: ({ toEmails, eventName }: { toEmails: string[]; eventName: string }) =>
      apiService.exportLeaderboardViaEmail(toEmails, eventName),
    onSuccess: (data) => {
      toast({
        title: "Email Sent Successfully",
        description: data.message,
      });
      setIsEmailModalOpen(false);
      setEmailRecipients('');
    },
    onError: (error: any) => {
      console.error('Email export error:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to send email. Please try again.";
      toast({
        title: "Email Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Handle weight change
  const handleWeightChange = (roundId: number, newWeight: number) => {
    setRoundWeights(prev => ({
      ...prev,
      [roundId]: newWeight
    }));
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    return Object.entries(roundWeights).some(([roundId, weight]) => {
      const originalWeight = evaluatedRounds.find(round => round.round_id === parseInt(roundId))?.weight_percentage;
      return originalWeight !== weight;
    });
  };

  // Save all weights - only update weights that have changed
  const saveAllWeights = async () => {
    try {
      // Find weights that have actually changed from their original values
      const changedWeights = Object.entries(roundWeights).filter(([roundId, weight]) => {
        const originalWeight = evaluatedRounds.find(round => round.round_id === parseInt(roundId))?.weight_percentage;
        return originalWeight !== weight;
      });

      if (changedWeights.length === 0) {
        toast({
          title: "No changes",
          description: "No weight changes detected.",
        });
        return;
      }

      // Update only the changed weights
      const promises = changedWeights.map(([roundId, weight]) =>
        updateWeightMutation.mutateAsync({ roundId: parseInt(roundId), weight })
      );
      
      await Promise.all(promises);
      
      // Update the evaluatedRounds state to reflect the new weights
      setEvaluatedRounds(prev => 
        prev.map(round => {
          const newWeight = roundWeights[round.round_id];
          if (newWeight !== undefined) {
            return { ...round, weight_percentage: newWeight };
          }
          return round;
        })
      );
      
      toast({
        title: "Weights updated",
        description: `${changedWeights.length} round weight(s) have been updated successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update some weights. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Shortlist teams handlers
  const handleShortlistTeams = () => {
    // Reset values when opening modal
    setShortlistType('top_k');
    const activeTeamsCount = getActiveTeamsCount();
    setShortlistValue(Math.min(5, activeTeamsCount));
    setIsShortlistModalOpen(true);
  };

  const handleApplyShortlist = () => {
    // Get count of active teams
    const activeTeamsCount = getActiveTeamsCount();
    
    // Validate values before proceeding
    if (shortlistType === 'top_k' && (shortlistValue <= 0 || shortlistValue > activeTeamsCount)) {
      toast({
        title: "Invalid Input",
        description: `Please enter a valid number between 1 and ${activeTeamsCount} (number of active teams)`,
        variant: "destructive",
      });
      return;
    }
    
    if (shortlistType === 'threshold' && (shortlistValue < 0 || shortlistValue > 100)) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid score between 0 and 100",
        variant: "destructive",
      });
      return;
    }
    
    setIsShortlistModalOpen(false);
    setIsShortlistConfirmOpen(true);
  };

  const handleConfirmShortlist = () => {
    shortlistTeamsMutation.mutate({
      shortlistType,
      value: shortlistValue
    });
  };

  // Helper function to get active teams count
  const getActiveTeamsCount = () => {
    return leaderboardData?.teams?.filter(team => team.status === 'ACTIVE').length || 0;
  };

  // Calculate team count for threshold
  const getThresholdTeamCount = () => {
    if (shortlistType === 'threshold' && leaderboardData?.teams) {
      return leaderboardData.teams.filter(team => team.final_score >= shortlistValue).length;
    }
    return 0;
  };

  // Use real leaderboard data
  const leaderboard = leaderboardData?.teams || [];

  // Pagination calculations
  const totalPages = Math.ceil(leaderboard.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeaderboard = leaderboard.slice(startIndex, endIndex);

  // Reset to first page when leaderboard data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [leaderboard.length]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200";
      case 2:
        return "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200";
      case 3:
        return "bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200";
      default:
        return "bg-white border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800 border-green-200";
      case "ELIMINATED":
        return "bg-red-100 text-red-800 border-red-200";
      case "COMPLETED":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "Active";
      case "ELIMINATED":
        return "Eliminated";
      case "COMPLETED":
        return "Completed";
      default:
        return status;
    }
  };

  // Export leaderboard
  const exportLeaderboard = async () => {
    try {
      const blob = await apiService.exportLeaderboard();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leaderboard.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export leaderboard. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Export rolling events results
  const exportRollingEventsResults = async () => {
    try {
      const blob = await apiService.exportEvaluatedRollingResults();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rolling_events_results.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Export successful",
        description: "Rolling events results exported successfully!",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export rolling events results. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Email export handlers
  const handleEmailExport = () => {
    setIsEmailModalOpen(true);
  };

  const handleSendEmail = () => {
    if (!emailRecipients.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter at least one email address.",
        variant: "destructive",
      });
      return;
    }

    // Parse email addresses (comma or semicolon separated)
    const emails = emailRecipients
      .split(/[,;]/)
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (emails.length === 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter valid email addresses.",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      toast({
        title: "Invalid Email Addresses",
        description: `Please check these email addresses: ${invalidEmails.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    emailExportMutation.mutate({
      toEmails: emails,
      eventName: eventName
    });
  };

  if (teamsLoading || evaluatedRoundsLoading || leaderboardLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
              <p className="text-muted-foreground">Loading leaderboard...</p>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
            <p className="text-muted-foreground">
              Current rankings and team standings
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={exportLeaderboard} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
            <Button className="gradient-hero w-full sm:w-auto" onClick={handleEmailExport}>
              <Mail className="h-4 w-4 mr-2" />
              Email CSV
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leaderboard.length}</div>
              <p className="text-xs text-muted-foreground">
                All teams
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Teams</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{getActiveTeamsCount()}</div>
              <p className="text-xs text-muted-foreground">
                Available for shortlisting
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Highest Score</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {leaderboard.length > 0 ? Math.max(...leaderboard.map(t => t.final_score)) : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Highest score
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(() => {
                  if (leaderboard.length === 0) return 0;
                  
                  // Get all non-zero scores
                  const nonZeroScores = leaderboard
                    .map(team => team.final_score)
                    .filter(score => score > 0);
                  
                  if (nonZeroScores.length === 0) return 0;
                  
                  // Calculate average of non-zero scores
                  const average = nonZeroScores.reduce((sum, score) => sum + score, 0) / nonZeroScores.length;
                  return Math.round(average);
                })()}
              </div>
              <p className="text-xs text-muted-foreground">
                Average of non-zero scores
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Eliminated Teams</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {leaderboard.filter(t => t.status === 'ELIMINATED').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Teams eliminated
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Top 3 Podium */}
        <div className="grid gap-4 md:grid-cols-3">
          {leaderboard.slice(0, 3).map((team, index) => (
            <Card key={team.team_id} className={`${getRankColor(team.rank)} relative overflow-hidden`}>
              <div className="absolute top-0 right-0 w-20 h-20 opacity-10">
                {getRankIcon(team.rank)}
              </div>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-2">
                  {getRankIcon(team.rank)}
                </div>
                <CardTitle className="text-xl">{team.team_name}</CardTitle>
                <CardDescription>{team.leader_name}</CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-2">
                <div className="text-3xl font-bold text-primary">
                  {team.weighted_average}
                </div>
                <div className="text-sm text-muted-foreground">
                  Weighted Average
                </div>
                <div className="text-xs text-muted-foreground">
                  Normalized: {team.normalized_score || team.final_score}
                </div>
                <div className="flex justify-center">
                  <Badge variant="outline" className={getStatusColor(team.status)}>
                    {formatStatus(team.status)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>


        {/* Evaluated Rounds Weight Configuration */}
        {evaluatedRounds.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Round Weight Configuration
              </CardTitle>
              <CardDescription>
                Configure weight percentages for evaluated rounds. These weights affect the final leaderboard calculations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Round Name</th>
                        <th className="text-left p-2 font-medium">Weightage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluatedRounds.map((round) => {
                        const hasChanged = roundWeights[round.round_id] !== round.weight_percentage;
                        return (
                          <tr key={round.round_id} className={`border-b ${hasChanged ? 'bg-blue-50' : ''}`}>
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <div>
                                  <div className="font-medium">{round.round_name}</div>
                                  <div className="text-sm text-muted-foreground">{round.event_id}</div>
                                </div>
                                {hasChanged && (
                                  <div className="w-2 h-2 bg-blue-500 rounded-full" title="Unsaved changes"></div>
                                )}
                              </div>
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <Button 
                    onClick={saveAllWeights}
                    disabled={updateWeightMutation.isPending || leaderboardFetching || !hasUnsavedChanges()}
                    className={hasUnsavedChanges() ? "gradient-hero" : "bg-gray-400 cursor-not-allowed"}
                  >
                    {updateWeightMutation.isPending ? "Saving..." : 
                     leaderboardFetching ? "Refreshing..." :
                     hasUnsavedChanges() ? "Save Changes" : "No Changes"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Round Weight Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                No evaluated rounds found. Rounds must be marked as evaluated to configure weights.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Team Shortlisting Section */}
        {user?.role === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Team Shortlisting
              </CardTitle>
              <CardDescription>
                Shortlist teams based on their overall scores (weighted average across all evaluated and frozen rounds)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      refetchEvaluatedRounds();
                      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
                      toast({
                        title: "Data Refreshed",
                        description: "Checking for new frozen rounds...",
                      });
                    }}
                    disabled={evaluatedRoundsLoading}
                    className="w-full sm:w-auto"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${evaluatedRoundsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  {evaluatedRoundsData?.evaluated_rounds?.some(round => round.is_frozen && !round.is_evaluated) && (
                    <span className="text-sm text-green-600 font-medium text-center sm:text-left">
                      {evaluatedRoundsData.evaluated_rounds.filter(round => round.is_frozen && !round.is_evaluated).length} frozen round(s) available
                    </span>
                  )}
                </div>
                <Button 
                  onClick={handleShortlistTeams}
                  disabled={shortlistTeamsMutation.isPending || !evaluatedRoundsData?.evaluated_rounds?.some(round => round.is_frozen && !round.is_evaluated)}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  {shortlistTeamsMutation.isPending ? "Shortlisting..." : "Shortlist Teams"}
                </Button>
              </div>
              {!evaluatedRoundsData?.evaluated_rounds?.some(round => round.is_frozen && !round.is_evaluated) && (
                <p className="text-sm text-muted-foreground mt-2">
                  No frozen rounds available for shortlisting. Freeze rounds first to enable shortlisting.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Full Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Full Leaderboard
              </div>
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, leaderboard.length)} of {leaderboard.length} teams
              </div>
            </CardTitle>
            <CardDescription>
              Complete rankings of all teams (weighted average scores)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {paginatedLeaderboard.map((team) => (
                <div key={team.team_id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors gap-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 flex-shrink-0">
                      {getRankIcon(team.rank)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{team.team_name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{team.leader_name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className={getStatusColor(team.status)}>
                          {formatStatus(team.status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Rounds: {team.rounds_completed}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <div className="text-2xl font-bold text-primary">
                      {team.weighted_average}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Weighted Average
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Normalized: {team.normalized_score || team.final_score}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Rounds: {team.rounds_completed}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>


        {/* Shortlist Teams Modal */}
        <Dialog open={isShortlistModalOpen} onOpenChange={setIsShortlistModalOpen}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Shortlist Teams
              </DialogTitle>
              <DialogDescription>
                Choose how to shortlist teams based on their overall scores
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="shortlist-type">Shortlist Method</Label>
                <Select value={shortlistType} onValueChange={(value: 'top_k' | 'threshold') => setShortlistType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select shortlist method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top_k">Top K Teams</SelectItem>
                    <SelectItem value="threshold">Score Threshold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {shortlistType === 'top_k' && (
                <div>
                  <Label htmlFor="top-k">Number of Teams</Label>
                  <Input
                    id="top-k"
                    type="number"
                    min="1"
                    max={getActiveTeamsCount()}
                    value={shortlistValue}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === '') {
                        setShortlistValue(0);
                      } else {
                        const value = parseInt(inputValue);
                        if (!isNaN(value) && value > 0) {
                          setShortlistValue(value);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseInt(e.target.value);
                      const activeTeamsCount = getActiveTeamsCount();
                      if (isNaN(value) || value <= 0) {
                        setShortlistValue(Math.min(5, activeTeamsCount));
                      } else if (value > activeTeamsCount) {
                        setShortlistValue(activeTeamsCount);
                      }
                    }}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Select the top {shortlistValue} teams (max: {getActiveTeamsCount()} active teams)
                  </p>
                </div>
              )}

              {shortlistType === 'threshold' && (
                <div>
                  <Label htmlFor="threshold">Score Threshold</Label>
                  <Input
                    id="threshold"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={shortlistValue}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === '') {
                        setShortlistValue(0);
                      } else {
                        const value = parseFloat(inputValue);
                        if (!isNaN(value) && value >= 0) {
                          setShortlistValue(value);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value);
                      if (isNaN(value) || value < 0) {
                        setShortlistValue(50);
                      }
                    }}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    {getThresholdTeamCount()} teams have score ≥ {shortlistValue}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsShortlistModalOpen(false)}
                disabled={shortlistTeamsMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleApplyShortlist} 
                disabled={shortlistTeamsMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Filter className="h-4 w-4 mr-2" />
                {shortlistTeamsMutation.isPending ? "Processing..." : "Apply Shortlist"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Shortlist Confirmation Dialog */}
        <AlertDialog open={isShortlistConfirmOpen} onOpenChange={setIsShortlistConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Shortlist</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure? This will eliminate teams that don't meet the criteria and mark all frozen rounds as evaluated. 
                {shortlistType === 'top_k' 
                  ? ` Top ${shortlistValue} teams will be shortlisted.`
                  : ` Teams with overall score ≥ ${shortlistValue} will be shortlisted (${getThresholdTeamCount()} teams).`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={shortlistTeamsMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmShortlist} 
                disabled={shortlistTeamsMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {shortlistTeamsMutation.isPending ? "Shortlisting..." : "Apply Shortlist"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Email Export Modal */}
        <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Leaderboard CSV
              </DialogTitle>
              <DialogDescription>
                Send the leaderboard CSV file to multiple recipients via email
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="event-name">Event Name</Label>
                <Input
                  id="event-name"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Crestora'25"
                />
              </div>
              
              <div>
                <Label htmlFor="email-recipients">Recipients</Label>
                <Input
                  id="email-recipients"
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Separate multiple email addresses with commas or semicolons
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsEmailModalOpen(false)}
                disabled={emailExportMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSendEmail} 
                disabled={emailExportMutation.isPending}
                className="gradient-hero"
              >
                <Send className="h-4 w-4 mr-2" />
                {emailExportMutation.isPending ? "Sending..." : "Send Email"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Rolling Events Results Section */}
        {rollingResults && rollingResults.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Rolling Events Results
                  </CardTitle>
                  <CardDescription>
                    Winners and runners-up from completed rolling events
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportRollingEventsResults}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {rollingResults.map((result) => (
                  <Card key={result.id} className="border-l-4 border-l-primary">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{result.event_name || result.event_id}</CardTitle>
                          <CardDescription className="flex items-center gap-1 text-xs">
                            <Building2 className="h-3 w-3" />
                            {result.club}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          Evaluated
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Winner */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-medium text-yellow-700">Winner</span>
                        </div>
                        <div className="pl-6">
                          <p className="font-semibold text-sm">{result.winner_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Reg: {result.winner_register_number}
                          </p>
                        </div>
                      </div>

                      {/* Runner-up */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Medal className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">Runner-up</span>
                        </div>
                        <div className="pl-6">
                          <p className="font-semibold text-sm">{result.runner_up_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Reg: {result.runner_up_register_number}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </DashboardLayout>
  );
};

export default Leaderboard;
