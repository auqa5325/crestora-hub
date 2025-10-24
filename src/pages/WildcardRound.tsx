import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Target, 
  Users, 
  Settings, 
  Save, 
  Lock, 
  Download,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Trophy,
  Filter,
  Search,
  Mail,
  Send,
  User,
  Globe
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService, Team, Event, TeamScore, RoundStats } from "@/services/api";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";

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

interface Criteria {
  name: string;
  max_points: number;
}

interface TeamEvaluation {
  team_id: string;
  team_name: string;
  leader_name: string;
  criteria_scores: Record<string, number>;
  total_score: number;
  normalized_score: number;
  is_evaluated: boolean;
  is_present: boolean;
}

const WildcardRoundEvaluation = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [teamEvaluations, setTeamEvaluations] = useState<TeamEvaluation[]>([]);
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);
  const [isFreezeDialogOpen, setIsFreezeDialogOpen] = useState(false);
  const [roundStats, setRoundStats] = useState<RoundStats | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());
  const [savedScores, setSavedScores] = useState<Map<string, number>>(new Map());
  
  // Track initialization to prevent infinite loops
  const initializedRef = useRef(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [evaluationFilter, setEvaluationFilter] = useState<string>("all");

  // Email export state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<string>('');
  const [eventName, setEventName] = useState<string>("Crestora'25");

  // Elimination control state
  const [eliminateAbsentees, setEliminateAbsentees] = useState<boolean>(true);
  const [isEliminationModalOpen, setIsEliminationModalOpen] = useState(false);

  // Export sorting state
  const [exportSortBy, setExportSortBy] = useState<string>('team_name');

  // Get round ID from URL params
  useEffect(() => {
    const roundId = searchParams.get('roundId');
    if (roundId) {
      setSelectedRoundId(parseInt(roundId));
    }
  }, [searchParams]);

  // Fetch events and rounds
  const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: () => apiService.getEvents(),
    refetchInterval: 30000,
  });

  // Fetch teams (all statuses to show ACTIVE and ELIMINATED badges)
  const { data: teams, isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => apiService.getTeams(),
    refetchInterval: 30000,
  });

  // Get all rounds from events
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

  // Get selected round
  const selectedRound = availableRounds.find(round => round.id === selectedRoundId);

  // Fetch round evaluations when a round is selected
  const { data: roundEvaluations, isLoading: evaluationsLoading, refetch: refetchEvaluations } = useQuery<TeamScore[]>({
    queryKey: ['round-evaluations', selectedRoundId],
    queryFn: () => selectedRoundId ? apiService.getRoundEvaluations(selectedRoundId) : Promise.resolve([]),
    enabled: !!selectedRoundId,
    refetchInterval: false,
  });

  // Fetch round stats when a round is selected
  const { data: stats } = useQuery<RoundStats>({
    queryKey: ['round-stats', selectedRoundId],
    queryFn: () => selectedRoundId ? apiService.getRoundStats(selectedRoundId) : Promise.resolve(null),
    enabled: !!selectedRoundId,
    refetchInterval: false,
  });

  // Update criteria mutation
  const updateCriteriaMutation = useMutation({
    mutationFn: (criteria: Criteria[]) => 
      apiService.updateRoundCriteria(selectedRoundId!, criteria),
    onSuccess: () => {
      toast({
        title: "Criteria updated",
        description: "Evaluation criteria have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['round-stats', selectedRoundId] });
      setIsCriteriaModalOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update criteria. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Evaluate team mutation
  const evaluateTeamMutation = useMutation({
    mutationFn: ({ teamId, criteriaScores, isAlreadyEvaluated, isPresent, eliminateAbsentees }: { teamId: string; criteriaScores: Record<string, number>; isAlreadyEvaluated?: boolean; isPresent?: boolean; eliminateAbsentees?: boolean }) =>
      apiService.evaluateTeam(selectedRoundId!, teamId, criteriaScores, isPresent ?? true, eliminateAbsentees ?? true),
    onSuccess: (data, variables) => {
      if (!variables.isAlreadyEvaluated) {
        toast({
          title: "Evaluation saved",
          description: "Team evaluation has been saved successfully.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ['round-evaluations', selectedRoundId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save evaluation. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Freeze round mutation
  const freezeRoundMutation = useMutation({
    mutationFn: () => apiService.freezeRound(selectedRoundId!),
    onSuccess: (data) => {
      toast({
        title: "Round frozen",
        description: "Round has been frozen and statistics calculated.",
      });
      setRoundStats(data);
      queryClient.invalidateQueries({ queryKey: ['round-stats', selectedRoundId] });
      queryClient.invalidateQueries({ queryKey: ['round-evaluations', selectedRoundId] });
      setIsFreezeDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to freeze round. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Email export mutation
  const emailExportMutation = useMutation({
    mutationFn: ({ toEmails, eventName }: { toEmails: string[]; eventName: string }) =>
      apiService.exportRoundDataViaEmail(selectedRoundId!, toEmails, eventName),
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

  // Handle absentees mutation
  const handleAbsenteesMutation = useMutation({
    mutationFn: (eliminateAbsentees: boolean) =>
      apiService.handleAbsentees(selectedRoundId!, eliminateAbsentees),
    onSuccess: (data) => {
      const message = data?.message || "Teams have been processed successfully.";
      const eliminatedCount = data?.eliminated_count || 0;
      const reactivatedCount = data?.reactivated_count || 0;
      
      toast({
        title: "Teams Processed Successfully",
        description: `${message} (${eliminatedCount} eliminated, ${reactivatedCount} reactivated)`,
      });
      setIsEliminationModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['round-evaluations', selectedRoundId] });
    },
    onError: (error: any) => {
      console.error('Handle absentees error:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to handle absentees. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Reactivate individual team mutation
  const reactivateTeamMutation = useMutation({
    mutationFn: (teamId: string) =>
      apiService.updateTeamStatus(teamId, 'ACTIVE'),
    onSuccess: (data, teamId) => {
      toast({
        title: "Team Reactivated Successfully",
        description: `Team ${teamId} has been reactivated and can now participate in future rounds.`,
      });
      
      // Immediately update the teams data in the cache to reflect the status change
      queryClient.setQueryData(['teams'], (oldTeams: Team[] | undefined) => {
        if (!oldTeams) return oldTeams;
        return oldTeams.map(team => 
          team.team_id === teamId 
            ? { ...team, status: 'ACTIVE' as const }
            : team
        );
      });
      
      queryClient.invalidateQueries({ queryKey: ['round-evaluations', selectedRoundId] });
      queryClient.invalidateQueries({ queryKey: ['round-stats', selectedRoundId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (error: any) => {
      console.error('Reactivate team error:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to reactivate team. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Initialize criteria and team evaluations
  useEffect(() => {
    if (selectedRound && teams && roundEvaluations && !initializedRef.current) {
      initializedRef.current = true;
      
      // Set criteria
      if (selectedRound.criteria && selectedRound.criteria.length > 0) {
        setCriteria(selectedRound.criteria);
      } else {
        setCriteria([{ name: "Overall Performance", max_points: 100 }]);
      }

      // For wildcard rounds, show eliminated teams AND teams that have TeamScore records for this round
      const teamsWithScores = roundEvaluations.map(evaluation => evaluation.team_id);
      const teamsToEvaluate = teams.filter(team => 
        team.status === 'ELIMINATED' || teamsWithScores.includes(team.team_id)
      );

      const evaluations: TeamEvaluation[] = teamsToEvaluate.map(team => {
        const existingEvaluation = roundEvaluations.find(evaluation => evaluation.team_id === team.team_id);
      
        const criteria_scores: Record<string, number> = {};
        const currentCriteria = selectedRound.criteria || [{ name: "Overall Performance", max_points: 100 }];
        currentCriteria.forEach(criterion => {
          criteria_scores[criterion.name] = existingEvaluation?.criteria_scores?.[criterion.name] || 0;
        });
      
        const total_score = Object.values(criteria_scores).reduce((sum, score) => sum + score, 0);
        const max_possible = currentCriteria.reduce((sum, c) => sum + c.max_points, 0);
        const normalized_score = max_possible > 0 ? (total_score / max_possible) * 100 : 0;
      
        return {
          team_id: team.team_id,
          team_name: team.team_name,
          leader_name: team.leader_name,
          criteria_scores,
          total_score,
          normalized_score: Math.min(normalized_score, 100),
          is_evaluated: total_score > 0,
          is_present: existingEvaluation?.is_present ?? false
        };
      });
    
      setTeamEvaluations(evaluations);
      
      // Initialize saved scores for sorting
      const initialSavedScores = new Map<string, number>();
      evaluations.forEach(evaluation => {
        if (evaluation.is_evaluated) {
          initialSavedScores.set(evaluation.team_id, evaluation.normalized_score);
        }
      });
      setSavedScores(initialSavedScores);
    }
  }, [selectedRound, teams, roundEvaluations]);

  // Update team evaluation
  const updateTeamEvaluation = (teamId: string, criterionName: string, score: number) => {
    const criterion = criteria.find(c => c.name === criterionName);
    const maxPoints = criterion?.max_points || 100;
    const validatedScore = Math.min(Math.max(score, 0), maxPoints);
    
    setUnsavedChanges(prev => new Set(prev).add(teamId));
    
    setTeamEvaluations(prev => {
      const updated = prev.map(evaluation => {
        if (evaluation.team_id === teamId) {
          const newCriteriaScores = { ...evaluation.criteria_scores, [criterionName]: validatedScore };
          const total_score = Object.values(newCriteriaScores).reduce((sum, s) => sum + s, 0);
          const max_possible = criteria.reduce((sum, c) => sum + c.max_points, 0);
          const normalized_score = max_possible > 0 ? (total_score / max_possible) * 100 : 0;
        
          return {
            ...evaluation,
            criteria_scores: newCriteriaScores,
            total_score,
            normalized_score: Math.min(normalized_score, 100),
            is_evaluated: evaluation.is_evaluated
          };
        }
        return evaluation;
      });
      return updated;
    });
  };

  // Validate score input
  const validateScore = (score: number, criterionName: string): { isValid: boolean; message?: string } => {
    const criterion = criteria.find(c => c.name === criterionName);
    const maxPoints = criterion?.max_points || 100;
    
    if (score < 0) {
      return { isValid: false, message: "Score cannot be negative" };
    }
    if (score > maxPoints) {
      return { isValid: false, message: `Score cannot exceed ${maxPoints} points` };
    }
    return { isValid: true };
  };

  // Save team evaluation
  const saveTeamEvaluation = (teamId: string) => {
    if (!selectedRoundId) {
      toast({
        title: "Error",
        description: "Round not selected. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    const evaluation = teamEvaluations.find(evalItem => evalItem.team_id === teamId);
    if (evaluation) {
      const hasInvalidScores = Object.entries(evaluation.criteria_scores).some(([criterionName, score]) => {
        const validation = validateScore(score, criterionName);
        return !validation.isValid;
      });
      
      if (hasInvalidScores) {
        toast({
          title: "Invalid Scores",
          description: "Please ensure all scores are within the valid range before saving.",
          variant: "destructive",
        });
        return;
      }
      
      setTeamEvaluations(prev => prev.map(evalItem => 
        evalItem.team_id === teamId 
          ? { ...evalItem, is_evaluated: true }
          : evalItem
      ));
      
      setUnsavedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(teamId);
        return newSet;
      });
      
      setSavedScores(prev => {
        const newMap = new Map(prev);
        newMap.set(teamId, evaluation.normalized_score);
        return newMap;
      });
      
      evaluateTeamMutation.mutate({
        teamId,
        criteriaScores: evaluation.criteria_scores,
        isAlreadyEvaluated: evaluation.is_evaluated,
        isPresent: evaluation.is_present,
        eliminateAbsentees: false
      });
    }
  };

  // Toggle team presence
  const toggleTeamPresence = (teamId: string) => {
    setTeamEvaluations(prev => prev.map(evaluation => {
      if (evaluation.team_id === teamId) {
        const newIsPresent = !evaluation.is_present;
        return {
          ...evaluation,
          is_present: newIsPresent,
          criteria_scores: newIsPresent ? evaluation.criteria_scores : {},
          total_score: newIsPresent ? evaluation.total_score : 0,
          normalized_score: newIsPresent ? evaluation.normalized_score : 0,
          is_evaluated: newIsPresent ? evaluation.is_evaluated : false
        };
      }
      return evaluation;
    }));
    
    setUnsavedChanges(prev => new Set(prev).add(teamId));
  };

  // Add criterion
  const addCriterion = () => {
    setCriteria([...criteria, { name: "", max_points: 10 }]);
  };

  // Remove criterion
  const removeCriterion = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  // Update criterion
  const updateCriterion = (index: number, field: keyof Criteria, value: string | number) => {
    setCriteria(criteria.map((c, i) => 
      i === index ? { ...c, [field]: value } : c
    ));
  };

  // Save criteria
  const saveCriteria = () => {
    if (selectedRoundId) {
      const validCriteria = criteria.map(criterion => ({
        name: criterion.name.trim(),
        max_points: typeof criterion.max_points === 'string' ? 
          (criterion.max_points === '' ? 10 : parseInt(criterion.max_points) || 10) : 
          criterion.max_points
      }));
      
      updateCriteriaMutation.mutate(validCriteria);
    }
  };

  // Freeze round
  const handleFreezeRound = () => {
    freezeRoundMutation.mutate();
  };

  // Handle absentees
  const handleAbsentees = () => {
    handleAbsenteesMutation.mutate(eliminateAbsentees);
  };

  // Export round data
  const exportRoundData = async () => {
    if (!selectedRoundId) return;
    
    try {
      const blob = await apiService.exportRoundData(selectedRoundId, exportSortBy);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wildcard_round_${selectedRoundId}_evaluations_${exportSortBy}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: `Wildcard round data exported sorted by ${exportSortBy === 'team_name' ? 'team name' : 'score'}.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export round data. Please try again.",
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

  // Filter teams based on search and filters
  const filteredTeamEvaluations = teamEvaluations.filter(evaluation => {
    const team = teams?.find(t => t.team_id === evaluation.team_id);
    if (!team) return false;
    
    const matchesSearch = evaluation.team_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         evaluation.leader_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         evaluation.team_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || team.status === statusFilter;
    const matchesEvaluation = evaluationFilter === "all" || 
      (evaluationFilter === "evaluated" && evaluation.is_evaluated) ||
      (evaluationFilter === "not_evaluated" && !evaluation.is_evaluated);
    
    return matchesSearch && matchesStatus && matchesEvaluation;
  });

  // Separate evaluated and non-evaluated teams from filtered results
  const evaluatedTeams = filteredTeamEvaluations
    .filter(team => team.is_evaluated)
    .sort((a, b) => {
      const scoreA = savedScores.get(a.team_id) ?? a.normalized_score;
      const scoreB = savedScores.get(b.team_id) ?? b.normalized_score;
      return scoreB - scoreA;
    });
  
  const nonEvaluatedTeams = filteredTeamEvaluations
    .filter(team => !team.is_evaluated)
    .sort((a, b) => a.team_name.localeCompare(b.team_name));

  if (eventsLoading || teamsLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Wildcard Round Evaluation</h1>
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!selectedRound) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Wildcard Round Evaluation</h1>
              <p className="text-muted-foreground text-red-500">
                Round not found or you don't have access to it.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/rounds')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Rounds
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Wildcard Round Evaluation</h1>
            <p className="text-muted-foreground break-words">
              {selectedRound.name} - {selectedRound.event_name}
            </p>
            <p className="text-sm text-muted-foreground">
              Club: {selectedRound.club || 'No club assigned'}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50">
                <Target className="h-3 w-3 mr-1" />
                Wildcard Round
              </Badge>
              <span className="text-sm text-orange-600">
                Only eliminated teams are shown
              </span>
            </div>
            {selectedRound.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {selectedRound.description}
              </p>
            )}
            {selectedRound.extended_description && (
              <div className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">Details:</span> 
                <ReadMoreText text={selectedRound.extended_description} maxLength={120} />
              </div>
            )}
            {(selectedRound.form_link || selectedRound.contact) && (
              <div className="mt-2 space-y-1">
                {selectedRound.form_link && (
                  <div className="flex items-center gap-1 text-xs">
                    <Globe className="h-3 w-3" />
                    <a 
                      href={selectedRound.form_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Registration Form
                    </a>
                  </div>
                )}
                {selectedRound.contact && (
                  <div className="flex items-center gap-1 text-xs">
                    <Users className="h-3 w-3" />
                    <span>Contact: {selectedRound.contact}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate('/rounds')} size="sm" className="flex-1 sm:flex-none">
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">Back to Rounds</span>
                <span className="xs:hidden">Back</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsCriteriaModalOpen(true)}
                disabled={false}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                <Settings className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">Manage Criteria</span>
                <span className="xs:hidden">Criteria</span>
              </Button>
              <div className="flex flex-col sm:flex-row gap-2 flex-1 sm:flex-none">
                <Select value={exportSortBy} onValueChange={setExportSortBy}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team_name">Team Name</SelectItem>
                    <SelectItem value="score">Score (High to Low)</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={exportRoundData}
                  size="sm"
                  className="flex-1 sm:flex-none"
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden xs:inline">Download CSV</span>
                  <span className="xs:hidden">Download</span>
                </Button>
              </div>
              {user?.role === 'admin' && (
                <Button
                  variant="outline"
                  onClick={handleEmailExport}
                  size="sm"
                  className="flex-1 sm:flex-none"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  <span className="hidden xs:inline">Email CSV</span>
                  <span className="xs:hidden">Email</span>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  refetchEvaluations();
                }}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">Refresh Data</span>
                <span className="xs:hidden">Refresh</span>
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {/* Freeze Round Button */}
              {!stats?.is_frozen && (user?.role === 'admin' || user?.role === 'clubs') && (
                <Button
                  onClick={() => setIsFreezeDialogOpen(true)}
                  className="bg-red-600 hover:bg-red-700 flex-1 sm:flex-none"
                  size="sm"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  <span className="hidden xs:inline">Freeze Round</span>
                  <span className="xs:hidden">Freeze</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  refetchEvaluations();
                }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search Teams</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by team name, leader, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Team Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="ELIMINATED">Eliminated</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Evaluation Status</label>
                <Select value={evaluationFilter} onValueChange={setEvaluationFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All evaluations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    <SelectItem value="evaluated">Evaluated</SelectItem>
                    <SelectItem value="not_evaluated">Not Evaluated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Round Status */}
        {stats?.is_frozen && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-blue-800">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Round Frozen
                </div>
                {user?.role === 'admin' && !stats?.is_evaluated && (
                  <Button
                    onClick={() => setIsEliminationModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="border-orange-200 hover:bg-orange-50 text-orange-700"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Handle Absentees
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-xs sm:text-sm text-blue-600">Max Score</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-800">{stats.max_score?.toFixed(1) || 'N/A'}</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xs sm:text-sm text-blue-600">Min Score</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-800">{stats.min_score?.toFixed(1) || 'N/A'}</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xs sm:text-sm text-blue-600">Average Score</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-800">{stats.avg_score?.toFixed(1) || 'N/A'}</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xs sm:text-sm text-blue-600">Teams Evaluated</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-800">{stats.participated_count}</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xs sm:text-sm text-blue-600">Absent Teams</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-800">
                    {teamEvaluations.filter(evaluation => !evaluation.is_present).length}
                  </p>
                </div>
              </div>
              {stats.top_3_teams && stats.top_3_teams.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-blue-600 mb-2">Top 3 Teams:</p>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                    {stats.top_3_teams.map((team, index) => (
                      <div key={team.team_id} className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">#{index + 1}</Badge>
                        <span className="text-sm font-medium break-words">{team.team_name}</span>
                        <span className="text-sm text-blue-600">({team.score.toFixed(1)})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Teams List - Split into evaluated and non-evaluated */}
        <>
          {/* Evaluated Teams List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Evaluated Teams ({evaluatedTeams.length})
              </CardTitle>
              <CardDescription>
                Teams that have been evaluated, sorted by normalized score
              </CardDescription>
            </CardHeader>
            <CardContent>
              {evaluatedTeams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No teams have been evaluated yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {evaluatedTeams.map((evaluation) => (
                    <Card key={evaluation.team_id} className="border-green-200 bg-green-50">
                      <CardContent className="p-3 sm:p-4">
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between w-full">
                                  <h3 className="font-semibold flex items-center gap-2 flex-wrap">
                                    <span className="break-words">{evaluation.team_name}</span>
                                    {unsavedChanges.has(evaluation.team_id) && (
                                      <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" title="Unsaved changes"></span>
                                    )}
                                  </h3>
                                  {user?.role === 'admin' && (
                                    <Button
                                      onClick={() => reactivateTeamMutation.mutate(evaluation.team_id)}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                      size="sm"
                                      disabled={reactivateTeamMutation.isPending}
                                    >
                                      <Users className="h-3 w-3 mr-1" />
                                      Reactivate
                                    </Button>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                  <p className="text-sm text-muted-foreground break-words">
                                    Leader: {evaluation.leader_name}
                                  </p>
                                  {(() => {
                                    const team = teams?.find(t => t.team_id === evaluation.team_id);
                                    if (team?.status === 'ELIMINATED') {
                                      return <Badge variant="destructive" className="text-xs flex-shrink-0">ELIMINATED</Badge>;
                                    } else if (team?.status === 'ACTIVE') {
                                      return <Badge variant="default" className="text-xs bg-green-100 text-green-800 flex-shrink-0">ACTIVE</Badge>;
                                    }
                                    return null;
                                  })()}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <Checkbox
                                    id={`present-${evaluation.team_id}`}
                                    checked={evaluation.is_present}
                                    onCheckedChange={() => toggleTeamPresence(evaluation.team_id)}
                                  />
                                  <Label htmlFor={`present-${evaluation.team_id}`} className="text-sm">
                                    Present
                                  </Label>
                                </div>
                              </div>
                            </div>
                            
                            {/* Criteria Scores */}
                            <div className="space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {criteria.map((criterion) => (
                                  <div key={criterion.name} className="space-y-1">
                                    <Label className="text-sm font-medium">
                                      {criterion.name} (Max: {criterion.max_points})
                                    </Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max={criterion.max_points}
                                      value={evaluation.criteria_scores[criterion.name] || 0}
                                      onChange={(e) => updateTeamEvaluation(evaluation.team_id, criterion.name, parseFloat(e.target.value) || 0)}
                                      disabled={!evaluation.is_present}
                                      className="w-full"
                                    />
                                  </div>
                                ))}
                              </div>
                              
                              {/* Score Summary */}
                              <div className="flex items-center justify-between pt-2 border-t">
                                <div className="text-sm">
                                  <span className="font-medium">Total Score: </span>
                                  <span className="text-green-600 font-semibold">
                                    {evaluation.total_score.toFixed(1)} / {criteria.reduce((sum, c) => sum + c.max_points, 0)}
                                  </span>
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium">Normalized: </span>
                                  <span className="text-blue-600 font-semibold">
                                    {evaluation.normalized_score.toFixed(1)}%
                                  </span>
                                </div>
                                <Button
                                  onClick={() => saveTeamEvaluation(evaluation.team_id)}
                                  disabled={!evaluation.is_present || unsavedChanges.has(evaluation.team_id) === false}
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  Save
                                </Button>
                              </div>
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

          {/* Non-Evaluated Teams List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Non-Evaluated Teams ({nonEvaluatedTeams.length})
              </CardTitle>
              <CardDescription>
                Teams that haven't been evaluated yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              {nonEvaluatedTeams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>All teams have been evaluated.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {nonEvaluatedTeams.map((evaluation) => (
                    <Card key={evaluation.team_id} className="border-yellow-200 bg-yellow-50">
                      <CardContent className="p-3 sm:p-4">
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between w-full">
                                  <h3 className="font-semibold flex items-center gap-2 flex-wrap">
                                    <span className="break-words">{evaluation.team_name}</span>
                                    {unsavedChanges.has(evaluation.team_id) && (
                                      <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" title="Unsaved changes"></span>
                                    )}
                                  </h3>
                                  {user?.role === 'admin' && (
                                    <Button
                                      onClick={() => reactivateTeamMutation.mutate(evaluation.team_id)}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                      size="sm"
                                      disabled={reactivateTeamMutation.isPending}
                                    >
                                      <Users className="h-3 w-3 mr-1" />
                                      Reactivate
                                    </Button>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                  <p className="text-sm text-muted-foreground break-words">
                                    Leader: {evaluation.leader_name}
                                  </p>
                                  {(() => {
                                    const team = teams?.find(t => t.team_id === evaluation.team_id);
                                    if (team?.status === 'ELIMINATED') {
                                      return <Badge variant="destructive" className="text-xs flex-shrink-0">ELIMINATED</Badge>;
                                    } else if (team?.status === 'ACTIVE') {
                                      return <Badge variant="default" className="text-xs bg-green-100 text-green-800 flex-shrink-0">ACTIVE</Badge>;
                                    }
                                    return null;
                                  })()}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <Checkbox
                                    id={`present-${evaluation.team_id}`}
                                    checked={evaluation.is_present}
                                    onCheckedChange={() => toggleTeamPresence(evaluation.team_id)}
                                  />
                                  <Label htmlFor={`present-${evaluation.team_id}`} className="text-sm">
                                    Present
                                  </Label>
                                </div>
                              </div>
                            </div>
                            
                            {/* Criteria Scores */}
                            <div className="space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {criteria.map((criterion) => (
                                  <div key={criterion.name} className="space-y-1">
                                    <Label className="text-sm font-medium">
                                      {criterion.name} (Max: {criterion.max_points})
                                    </Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      max={criterion.max_points}
                                      value={evaluation.criteria_scores[criterion.name] || 0}
                                      onChange={(e) => updateTeamEvaluation(evaluation.team_id, criterion.name, parseFloat(e.target.value) || 0)}
                                      disabled={!evaluation.is_present}
                                      className="w-full"
                                    />
                                  </div>
                                ))}
                              </div>
                              
                              {/* Score Summary */}
                              <div className="flex items-center justify-between pt-2 border-t">
                                <div className="text-sm">
                                  <span className="font-medium">Total Score: </span>
                                  <span className="text-green-600 font-semibold">
                                    {evaluation.total_score.toFixed(1)} / {criteria.reduce((sum, c) => sum + c.max_points, 0)}
                                  </span>
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium">Normalized: </span>
                                  <span className="text-blue-600 font-semibold">
                                    {evaluation.normalized_score.toFixed(1)}%
                                  </span>
                                </div>
                                <Button
                                  onClick={() => saveTeamEvaluation(evaluation.team_id)}
                                  disabled={!evaluation.is_present || unsavedChanges.has(evaluation.team_id) === false}
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Save className="h-4 w-4 mr-1" />
                                  Save
                                </Button>
                              </div>
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
        </>

        {/* Criteria Management Modal */}
        <Dialog open={isCriteriaModalOpen} onOpenChange={setIsCriteriaModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manage Evaluation Criteria</DialogTitle>
              <DialogDescription>
                Set up the criteria for evaluating teams in this wildcard round.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {criteria.map((criterion, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label htmlFor={`criterion-name-${index}`}>Criterion Name</Label>
                    <Input
                      id={`criterion-name-${index}`}
                      value={criterion.name}
                      onChange={(e) => updateCriterion(index, 'name', e.target.value)}
                      placeholder="Enter criterion name"
                    />
                  </div>
                  <div className="w-24">
                    <Label htmlFor={`criterion-points-${index}`}>Max Points</Label>
                    <Input
                      id={`criterion-points-${index}`}
                      type="number"
                      min="1"
                      value={criterion.max_points}
                      onChange={(e) => updateCriterion(index, 'max_points', parseInt(e.target.value) || 10)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeCriterion(index)}
                    className="mt-6"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={addCriterion} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Criterion
              </Button>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCriteriaModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveCriteria} disabled={updateCriteriaMutation.isPending}>
                  {updateCriteriaMutation.isPending ? "Saving..." : "Save Criteria"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Freeze Round Confirmation Dialog */}
        <AlertDialog open={isFreezeDialogOpen} onOpenChange={setIsFreezeDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Freeze Round</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to freeze this wildcard round? This will:
              </AlertDialogDescription>
              <div className="mt-2">
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Calculate final statistics</li>
                  <li>Prevent further evaluations</li>
                  <li>Mark the round as completed</li>
                </ul>
                <p className="mt-2 text-sm text-muted-foreground">
                  This action cannot be undone.
                </p>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleFreezeRound}
                className="bg-red-600 hover:bg-red-700"
                disabled={freezeRoundMutation.isPending}
              >
                {freezeRoundMutation.isPending ? "Freezing..." : "Freeze Round"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Handle Absentees Modal */}
        <AlertDialog open={isEliminationModalOpen} onOpenChange={setIsEliminationModalOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Handle Absent Teams</AlertDialogTitle>
              <AlertDialogDescription>
                Choose how to handle teams that were marked as absent in this wildcard round.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="eliminate-absentees"
                  checked={eliminateAbsentees}
                  onCheckedChange={(checked) => setEliminateAbsentees(!!checked)}
                />
                <Label htmlFor="eliminate-absentees" className="text-sm">
                  Eliminate absent teams (set status to ELIMINATED)
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {eliminateAbsentees 
                  ? "Absent teams will be marked as ELIMINATED and cannot participate in future rounds."
                  : "Absent teams will remain in their current status and can participate in future rounds."
                }
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleAbsentees}
                className="bg-orange-600 hover:bg-orange-700"
                disabled={handleAbsenteesMutation.isPending}
              >
                {handleAbsenteesMutation.isPending ? "Processing..." : "Process Teams"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Email Export Modal */}
        <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Email Round Data</DialogTitle>
              <DialogDescription>
                Send the wildcard round evaluation data via email to specified recipients.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-recipients">Email Recipients</Label>
                <Input
                  id="email-recipients"
                  placeholder="Enter email addresses separated by commas"
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple email addresses with commas (e.g., user1@example.com, user2@example.com)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-name">Event Name</Label>
                <Input
                  id="event-name"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEmailModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSendEmail} 
                  disabled={emailExportMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {emailExportMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Email
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default WildcardRoundEvaluation;