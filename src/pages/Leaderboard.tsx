import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  Trophy, 
  Medal, 
  Award, 
  TrendingUp, 
  Users, 
  Star,
  Crown,
  Settings,
  Download
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService, Team, LeaderboardData, LeaderboardTeam, RoundWeight, EvaluatedRound } from "@/services/api";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Leaderboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [evaluatedRounds, setEvaluatedRounds] = useState<EvaluatedRound[]>([]);
  const [roundWeights, setRoundWeights] = useState<Record<number, number>>({});

  const { data: teams, isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => apiService.getTeams({ limit: 100 }),
    refetchInterval: 30000,
  });

  // Fetch evaluated rounds
  const { data: evaluatedRoundsData, isLoading: evaluatedRoundsLoading } = useQuery({
    queryKey: ['evaluated-rounds'],
    queryFn: () => apiService.getEvaluatedRounds(),
    refetchInterval: 30000,
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

  // Fetch leaderboard data
  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery<LeaderboardData>({
    queryKey: ['leaderboard'],
    queryFn: () => apiService.getLeaderboard(),
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
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
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

  // Use real leaderboard data
  const leaderboard = leaderboardData?.teams || [];

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
            <p className="text-muted-foreground">
              Current rankings and team standings
            </p>
          </div>
          <div className="flex gap-2">
            <Button className="gradient-hero" onClick={exportLeaderboard}>
              <Download className="h-4 w-4 mr-2" />
              Export Rankings
            </Button>
          </div>
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
                  {team.final_score}
                </div>
                <div className="text-sm text-muted-foreground">
                  Final Score
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
                      {evaluatedRounds.map((round) => (
                        <tr key={round.round_id} className="border-b">
                          <td className="p-2">
                            <div>
                              <div className="font-medium">{round.round_name}</div>
                              <div className="text-sm text-muted-foreground">{round.event_id}</div>
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

        {/* Full Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Full Leaderboard
            </CardTitle>
            <CardDescription>
              Complete rankings of all teams (weighted average scores)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leaderboard.map((team) => (
                <div key={team.team_id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8">
                      {getRankIcon(team.rank)}
                    </div>
                    <div>
                      <h3 className="font-semibold">{team.team_name}</h3>
                      <p className="text-sm text-muted-foreground">{team.leader_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={getStatusColor(team.status)}>
                          {formatStatus(team.status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Round {team.current_round}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {team.final_score}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Final Score
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Weighted Avg: {team.weighted_average}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Rounds: {team.rounds_completed}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-4">
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
                {leaderboard.length > 0 ? Math.round(leaderboard.reduce((sum, team) => sum + team.final_score, 0) / leaderboard.length) : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Average score
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

      </div>
    </DashboardLayout>
  );
};

export default Leaderboard;
