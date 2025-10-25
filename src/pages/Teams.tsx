import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Search, Filter, Mail, Phone, User, Calendar, Trophy, Eye, Edit, Download } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService, Team, TeamStats, TeamScore } from "@/services/api";
import RoundScoreCard from "@/components/RoundScoreCard";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Teams = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roundFilter, setRoundFilter] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [teamScores, setTeamScores] = useState<TeamScore[]>([]);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<'ACTIVE' | 'ELIMINATED' | 'COMPLETED'>('ACTIVE');
  const [isExporting, setIsExporting] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Export teams function
  const handleExportTeams = async () => {
    if (isExporting) return; // Prevent multiple simultaneous exports
    
    setIsExporting(true);
    try {
      const filters = {
        status: statusFilter !== "all" ? statusFilter : undefined,
        round_id: roundFilter !== "all" ? parseInt(roundFilter) : undefined,
        search: searchTerm || undefined
      };

      const blob = await apiService.exportTeams(filters);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `teams_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: "Teams data has been exported successfully.",
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export teams data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const { data: teams, isLoading, error } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => apiService.getTeams({ limit: 100 }),
    refetchInterval: 10000, // Reduced from 30s to 10s
    refetchOnWindowFocus: true, // Refetch when window gains focus
    staleTime: 5000, // Consider data stale after 5 seconds
  });

  const { data: teamStats } = useQuery<TeamStats>({
    queryKey: ['team-stats'],
    queryFn: () => apiService.getTeamStats(),
    refetchInterval: 10000, // Reduced from 30s to 10s
    refetchOnWindowFocus: true, // Refetch when window gains focus
    staleTime: 5000, // Consider data stale after 5 seconds
  });

  // Fetch team scores when a team is selected
  const { data: scores, isLoading: scoresLoading } = useQuery<TeamScore[]>({
    queryKey: ['team-scores', selectedTeam?.team_id],
    queryFn: () => selectedTeam ? apiService.getTeamScoresForTeam(selectedTeam.team_id) : Promise.resolve([]),
    enabled: !!selectedTeam,
    refetchInterval: 30000,
  });

  // Update teamScores when scores data changes
  useEffect(() => {
    if (scores) {
      setTeamScores(scores);
    }
  }, [scores]);

  // Update team status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ teamId, status }: { teamId: string; status: 'ACTIVE' | 'ELIMINATED' | 'COMPLETED' }) =>
      apiService.updateTeamStatus(teamId, status),
    onMutate: async ({ teamId, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['teams'] });
      await queryClient.cancelQueries({ queryKey: ['team-stats'] });

      // Snapshot the previous value
      const previousTeams = queryClient.getQueryData(['teams']);
      const previousStats = queryClient.getQueryData(['team-stats']);

      // Optimistically update the teams list
      queryClient.setQueryData(['teams'], (old: Team[] | undefined) => {
        if (!old) return old;
        return old.map(team => 
          team.team_id === teamId 
            ? { ...team, status: status }
            : team
        );
      });

      // Optimistically update the stats
      queryClient.setQueryData(['team-stats'], (old: TeamStats | undefined) => {
        if (!old) return old;
        const newStats = { ...old };
        
        // Decrease the old status count
        if (selectedTeam?.status === 'ACTIVE') newStats.active_teams--;
        else if (selectedTeam?.status === 'ELIMINATED') newStats.eliminated_teams--;
        else if (selectedTeam?.status === 'COMPLETED') newStats.completed_teams--;
        
        // Increase the new status count
        if (status === 'ACTIVE') newStats.active_teams++;
        else if (status === 'ELIMINATED') newStats.eliminated_teams++;
        else if (status === 'COMPLETED') newStats.completed_teams++;
        
        return newStats;
      });

      return { previousTeams, previousStats };
    },
    onSuccess: () => {
      toast({
        title: "Status updated",
        description: "Team status has been updated successfully.",
      });
      // Invalidate and refetch to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team-stats'] });
      setIsStatusModalOpen(false);
    },
    onError: (error, variables, context) => {
      // Revert optimistic updates on error
      if (context?.previousTeams) {
        queryClient.setQueryData(['teams'], context.previousTeams);
      }
      if (context?.previousStats) {
        queryClient.setQueryData(['team-stats'], context.previousStats);
      }
      toast({
        title: "Error",
        description: "Failed to update team status. Please try again.",
        variant: "destructive",
      });
    },
  });

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

  const filteredTeams = teams?.filter(team => {
    const matchesSearch = team.team_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         team.leader_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         team.team_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || team.status === statusFilter;
    const matchesRound = roundFilter === "all" || team.current_round.toString() === roundFilter;
    
    return matchesSearch && matchesStatus && matchesRound;
  }) || [];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Teams</h1>
              <p className="text-muted-foreground">Loading teams...</p>
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

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Teams</h1>
              <p className="text-muted-foreground">Error loading teams</p>
            </div>
          </div>
          <Card>
            <CardContent className="p-6">
              <p className="text-red-600">Failed to load teams. Please try again later.</p>
            </CardContent>
          </Card>
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
            <h1 className="text-3xl font-bold mb-2">Teams</h1>
            <p className="text-muted-foreground">
              Manage all {teamStats?.total_teams || 0} registered teams
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              className="gradient-hero"
              onClick={handleExportTeams}
              disabled={isLoading || isExporting}
            >
              {isExporting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Teams
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {teamStats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teamStats.total_teams}</div>
                <p className="text-xs text-muted-foreground">
                  {teamStats.active_teams} active
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Teams</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{teamStats.active_teams}</div>
                <p className="text-xs text-muted-foreground">
                  In competition
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Eliminated</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{teamStats.eliminated_teams}</div>
                <p className="text-xs text-muted-foreground">
                  Out of competition
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{teamStats.completed_teams}</div>
                <p className="text-xs text-muted-foreground">
                  Finished all rounds
                </p>
              </CardContent>
            </Card>
          </div>
        )}

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
                  queryClient.invalidateQueries({ queryKey: ['teams'] });
                  queryClient.invalidateQueries({ queryKey: ['team-stats'] });
                  toast({
                    title: "Data refreshed",
                    description: "Team data has been refreshed.",
                  });
                }}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
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
                <label className="text-sm font-medium">Status</label>
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
                <label className="text-sm font-medium">Current Round</label>
                <Select value={roundFilter} onValueChange={setRoundFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All rounds" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Rounds</SelectItem>
                    <SelectItem value="1">Round 1</SelectItem>
                    <SelectItem value="2">Round 2</SelectItem>
                    <SelectItem value="3">Round 3</SelectItem>
                    <SelectItem value="4">Round 4</SelectItem>
                    <SelectItem value="5">Round 5</SelectItem>
                    <SelectItem value="6">Round 6</SelectItem>
                    <SelectItem value="7">Round 7</SelectItem>
                    <SelectItem value="8">Round 8</SelectItem>
                    <SelectItem value="9">Round 9</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Teams Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => (
            <Card 
              key={team.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                if (user?.role === 'admin') {
                  setSelectedTeam(team);
                  setIsDetailModalOpen(true);
                }
              }}
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="outline" className={getStatusColor(team.status)}>
                    {formatStatus(team.status)}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">
                      {team.team_id}
                    </span>
                    {user?.role === 'admin' && (
                      <Eye className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                </div>
                <CardTitle className="text-lg">{team.team_name}</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {team.leader_name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Trophy className="h-4 w-4" />
                    Round
                  </span>
                  <span className="font-semibold">{team.current_round}</span>
                </div>
                {team.overall_score !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Trophy className="h-4 w-4" />
                      Overall Score
                    </span>
                    <span className="font-semibold text-green-600">{team.overall_score.toFixed(1)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    Email
                  </span>
                  <span className="font-semibold text-xs truncate max-w-[120px]">
                    {team.leader_email}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    Contact
                  </span>
                  <span className="font-semibold">{team.leader_contact}</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Reg: {team.leader_register_number}</span>
                    <span>Joined: {new Date(team.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {user?.role === 'admin' && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground text-center">
                      Click to view full details
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredTeams.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No teams found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search criteria or filters.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Team Details Modal for Admin */}
        {user?.role === 'admin' && selectedTeam && (
          <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Team Details - {selectedTeam.team_name}</DialogTitle>
                <DialogDescription>
                  Complete information for team {selectedTeam.team_id}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Team Leader Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Team Leader
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                      <p className="font-medium text-lg">{selectedTeam.leader_name}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Register Number</label>
                      <p className="font-medium">{selectedTeam.leader_register_number}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                      <p className="font-medium">{selectedTeam.leader_email}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Contact Number</label>
                      <p className="font-medium">{selectedTeam.leader_contact}</p>
                    </div>
                  </div>
                </div>

                {/* Team Members */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Team Members ({selectedTeam.members.length})
                  </h3>
                  <div className="space-y-3">
                    {selectedTeam.members.map((member, index) => (
                      <Card key={member.id} className="border-l-4 border-l-primary">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <label className="text-sm font-medium text-muted-foreground">Name</label>
                              <p className="font-medium">{member.member_name}</p>
                            </div>
                            <div className="space-y-1">
                              <label className="text-sm font-medium text-muted-foreground">Register Number</label>
                              <p className="font-medium">{member.register_number}</p>
                            </div>
                            <div className="space-y-1">
                              <label className="text-sm font-medium text-muted-foreground">Position</label>
                              <Badge variant="outline" className="w-fit">
                                {member.member_position}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Team Status and Progress */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Trophy className="h-5 w-5" />
                      Team Status & Progress
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewStatus(selectedTeam.status);
                        setIsStatusModalOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Status
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Current Round</label>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-lg px-3 py-1">
                          Round {selectedTeam.current_round}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Team Status</label>
                      <Badge className={getStatusColor(selectedTeam.status)}>
                        {formatStatus(selectedTeam.status)}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Registration Date</label>
                      <p className="font-medium">{new Date(selectedTeam.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Round Scores */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Round Scores
                  </h3>
                  {scoresLoading ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                      Loading scores...
                    </div>
                  ) : teamScores.length > 0 ? (
                    <div className="space-y-3">
                      {teamScores.map((score) => (
                        <RoundScoreCard key={score.id} score={score} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No scores available for this team.
                    </div>
                  )}
                </div>

                {/* Team ID and Additional Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Additional Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Team ID</label>
                      <p className="font-mono font-medium bg-muted p-2 rounded">{selectedTeam.team_id}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                      <p className="font-medium">
                        {selectedTeam.updated_at 
                          ? new Date(selectedTeam.updated_at).toLocaleDateString()
                          : 'Never'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Status Update Modal */}
        <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Team Status</DialogTitle>
              <DialogDescription>
                Change the status of {selectedTeam?.team_name}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">New Status</label>
                <Select value={newStatus} onValueChange={(value: 'ACTIVE' | 'ELIMINATED' | 'COMPLETED') => setNewStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="ELIMINATED">Eliminated</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsStatusModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => selectedTeam && updateStatusMutation.mutate({ 
                  teamId: selectedTeam.team_id, 
                  status: newStatus 
                })}
                disabled={updateStatusMutation.isPending}
                className="flex items-center gap-2"
              >
                {updateStatusMutation.isPending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Updating...
                  </>
                ) : (
                  "Update Status"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Teams;

