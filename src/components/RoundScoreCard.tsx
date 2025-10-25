import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiService } from '@/services/api';

interface TeamScore {
  id: number;
  team_id: string;
  round_id: number;
  event_id: string;
  score: number;
  criteria_scores?: Record<string, number>;
  raw_total_score: number;
  is_normalized: boolean;
  is_present: boolean;
  created_at: string;
  updated_at?: string;
}

interface RoundDetails {
  id: number;
  name: string;
  club: string;
  round_number: number;
  event_id: string;
  mode?: string;
  date?: string;
  description?: string;
  is_wildcard: boolean;
  max_score?: number;
  criteria?: Array<{name: string, max_points: number}>;
}

interface RoundScoreCardProps {
  score: TeamScore;
}

const RoundScoreCard: React.FC<RoundScoreCardProps> = ({ score }) => {
  const [roundDetails, setRoundDetails] = useState<RoundDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Calculate maximum possible points from criteria
  const calculateMaxPossiblePoints = (criteria?: Array<{name: string, max_points: number}>): number => {
    if (!criteria || !Array.isArray(criteria)) {
      return 0;
    }
    return criteria.reduce((total, criterion) => total + (criterion.max_points || 0), 0);
  };

  useEffect(() => {
    const fetchRoundDetails = async () => {
      try {
        const details = await apiService.getRoundDetails(score.round_id);
        setRoundDetails(details);
      } catch (error) {
        console.error('Failed to fetch round details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRoundDetails();
  }, [score.round_id]);

  if (loading) {
    return (
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Round</label>
              <p className="font-medium">Loading...</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Score</label>
              <p className="font-medium text-lg text-primary">{score.score.toFixed(1)}</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Raw Score</label>
              <p className="font-medium">{score.raw_total_score.toFixed(1)}</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">
                {score.hasOwnProperty('is_present') ? 'Present' : 'Normalized'}
              </label>
              <Badge variant={
                score.hasOwnProperty('is_present') 
                  ? (score.is_present ? "default" : "destructive")
                  : (score.is_normalized ? "default" : "secondary")
              }>
                {score.hasOwnProperty('is_present') 
                  ? (score.is_present ? "Yes" : "No")
                  : (score.is_normalized ? "Yes" : "No")
                }
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Round</label>
            <div>
              <p className="font-medium">{roundDetails?.name || `Round ${roundDetails?.round_number || score.round_id}`}</p>
              {roundDetails?.club && (
                <p className="text-sm text-muted-foreground">{roundDetails.club}</p>
              )}
              {roundDetails?.is_wildcard && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs mt-1">
                  Wildcard
                </Badge>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Score</label>
            <p className="font-medium text-lg text-primary">{score.score.toFixed(1)}</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Raw Score</label>
            <p className="font-medium">{score.raw_total_score.toFixed(1)}</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Max Points</label>
            <p className="font-medium">
              {(() => {
                const maxPossible = calculateMaxPossiblePoints(roundDetails?.criteria);
                return maxPossible > 0 ? maxPossible.toFixed(1) : 'N/A';
              })()}
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              {score.hasOwnProperty('is_present') ? 'Present' : 'Normalized'}
            </label>
            <Badge variant={
              score.hasOwnProperty('is_present') 
                ? (score.is_present ? "default" : "destructive")
                : (score.is_normalized ? "default" : "secondary")
            }>
              {score.hasOwnProperty('is_present') 
                ? (score.is_present ? "Yes" : "No")
                : (score.is_normalized ? "Yes" : "No")
              }
            </Badge>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Mode</label>
            <p className="font-medium capitalize">{roundDetails?.mode || 'N/A'}</p>
          </div>
        </div>
        {score.criteria_scores && Object.keys(score.criteria_scores).length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <label className="text-sm font-medium text-muted-foreground">Criteria Breakdown</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
              {Object.entries(score.criteria_scores).map(([criterion, points]) => (
                <div key={criterion} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{criterion}:</span>
                  <span className="font-medium">{String(points)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RoundScoreCard;
