from fastapi import Response
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Dict, Any
from app.models.team_score import TeamScore
from app.models.team import Team
from app.models.rounds import UnifiedEvent
from app.models.round_weight import RoundWeight
from app.models.rolling_results import RollingEventResult
import csv
import io

class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def export_round_data(self, round_id: int, sort_by: str = "team_name") -> Response:
        """Export round evaluations to CSV - includes ALL active teams with 0 scores for unevaluated teams"""
        
        # Get round information
        round_obj = self.db.query(UnifiedEvent).filter(UnifiedEvent.id == round_id).first()
        if not round_obj:
            raise ValueError("Round not found")
        
        # Get ALL active teams
        all_active_teams = self.db.query(Team).filter(Team.status == "ACTIVE").all()
        
        # Get existing team scores for this round
        existing_scores = self.db.query(TeamScore).filter(TeamScore.round_id == round_id).all()
        # Create a dictionary for quick lookup
        scores_dict = {score.team_id: score for score in existing_scores}
        
        # Prepare data for sorting
        team_data = []
        for team in all_active_teams:
            score = scores_dict.get(team.team_id)
            team_data.append({
                'team': team,
                'score': score,
                'score_value': score.score if score else 0
            })
        
        # Sort based on the sort_by parameter
        if sort_by == "score":
            # Sort by score (descending), then by team name (ascending)
            team_data.sort(key=lambda x: (-x['score_value'], x['team'].team_name))
        else:
            # Default: sort by team name (ascending)
            team_data.sort(key=lambda x: x['team'].team_name)
        
        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        header = [
            "Team ID", "Team Name", "Leader Name", "Score", "Raw Total Score", 
            "Is Normalized", "Is Present", "Created At", "Updated At"
        ]
        
        # Add criteria columns if criteria are defined
        if round_obj.criteria:
            for criterion in round_obj.criteria:
                header.append(f"Criteria: {criterion.get('name', 'Unknown')}")
        
        writer.writerow(header)
        
        # Write data for ALL active teams (now sorted)
        for item in team_data:
            team = item['team']
            score = item['score']
            
            if score:
                # Team has been evaluated
                row = [
                    team.team_id,
                    team.team_name,
                    team.leader_name,
                    score.score,
                    score.raw_total_score,
                    score.is_normalized,
                    score.is_present,
                    score.created_at.strftime("%Y-%m-%d %H:%M:%S") if score.created_at else "",
                    score.updated_at.strftime("%Y-%m-%d %H:%M:%S") if score.updated_at else ""
                ]
                
                # Add criteria scores
                if round_obj.criteria and score.criteria_scores:
                    for criterion in round_obj.criteria:
                        criterion_name = criterion.get('name', 'Unknown')
                        row.append(score.criteria_scores.get(criterion_name, 0))
                else:
                    # Add 0 for all criteria if no criteria scores
                    if round_obj.criteria:
                        for _ in round_obj.criteria:
                            row.append(0)
            else:
                # Team has NOT been evaluated - show 0 scores
                row = [
                    team.team_id,
                    team.team_name,
                    team.leader_name,
                    0,  # Score = 0
                    0,  # Raw Total Score = 0
                    False,  # Is Normalized = False
                    True,  # Is Present = True (default for unevaluated teams)
                    "",  # Created At = empty
                    ""   # Updated At = empty
                ]
                
                # Add 0 for all criteria
                if round_obj.criteria:
                    for _ in round_obj.criteria:
                        row.append(0)
            
            writer.writerow(row)
        
        # Get CSV content
        csv_content = output.getvalue()
        output.close()
        
        # Return CSV file
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=round_{round_id}_evaluations.csv"}
        )

    def export_leaderboard(self) -> Response:
        """Export final leaderboard to CSV"""
        
        # Get all evaluated rounds with their weights
        evaluated_rounds = self.db.query(UnifiedEvent).filter(
            UnifiedEvent.is_evaluated == True,
            UnifiedEvent.round_number > 0
        ).all()
        
        if not evaluated_rounds:
            raise ValueError("No evaluated rounds found")
        
        # Get all active teams
        active_teams = self.db.query(Team).filter(Team.status == "active").all()
        
        leaderboard = []
        
        for team in active_teams:
            # Get all scores for this team across evaluated rounds
            team_scores = self.db.query(TeamScore).filter(
                TeamScore.team_id == team.team_id
            ).all()
            
            if not team_scores:
                continue
            
            # Calculate weighted average
            total_weighted_score = 0.0
            total_weight = 0.0
            rounds_completed = 0
            
            for score in team_scores:
                # Get weight for this round
                weight = self.db.query(RoundWeight).filter(
                    RoundWeight.round_id == score.round_id
                ).first()
                
                if weight:
                    weight_value = weight.weight_percentage / 100.0  # Convert to decimal
                    total_weighted_score += score.score * weight_value
                    total_weight += weight_value
                    rounds_completed += 1
            
            if total_weight > 0:
                # Calculate weighted average for reference
                weighted_average = total_weighted_score / total_weight
                
                # Update current_round for active teams: current_round = rounds_completed + 1
                if team.status == "ACTIVE":
                    new_current_round = rounds_completed + 1
                    if team.current_round != new_current_round:
                        team.current_round = new_current_round
                
                # Use weighted score (sum) as the primary metric
                final_score = total_weighted_score
                
                leaderboard.append({
                    "rank": 0,  # Will be set after sorting
                    "team_id": team.team_id,
                    "team_name": team.team_name,
                    "leader_name": team.leader_name,
                    "final_score": round(final_score, 2),
                    "weighted_average": round(weighted_average, 2),
                    "rounds_completed": rounds_completed,
                    "current_round": team.current_round,
                    "status": team.status
                })
        
        # Add normalized score for reference (optional)
        if leaderboard:
            # Find the maximum final score (weighted score)
            max_score = max(team["final_score"] for team in leaderboard)
            
            # Add normalized score for reference
            for team in leaderboard:
                if max_score > 0:
                    normalized_score = (team["final_score"] / max_score) * 100
                    team["normalized_score"] = round(normalized_score, 2)
                else:
                    team["normalized_score"] = 0.0
        
        # Sort by final score (weighted score) descending
        leaderboard.sort(key=lambda x: x["final_score"], reverse=True)
        
        # Add rank
        for i, team in enumerate(leaderboard):
            team["rank"] = i + 1
        
        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Get all evaluated rounds for column headers
        all_rounds = self.db.query(UnifiedEvent).filter(
            UnifiedEvent.is_evaluated == True,
            UnifiedEvent.round_number > 0
        ).order_by(UnifiedEvent.round_number).all()
        
        # Create header with round columns
        header = [
            "Rank", "Team ID", "Team Name", "Leader Name", 
            "Final Score", "Percentile", "Rounds Completed", "Status"
        ]
        
        # Add round columns
        for round_data in all_rounds:
            header.append(f"Round {round_data.round_number} Score")
        
        writer.writerow(header)
        
        # Get team scores for all teams
        team_scores_dict = {}
        for team in leaderboard:
            team_scores = self.db.query(TeamScore).filter(
                TeamScore.team_id == team["team_id"]
            ).all()
            team_scores_dict[team["team_id"]] = {score.round_id: score.score for score in team_scores}
        
        # Write data
        for team in leaderboard:
            row = [
                team["rank"],
                team["team_id"],
                team["team_name"],
                team["leader_name"],
                team["final_score"],
                team["normalized_score"],  # This is the percentile
                team["rounds_completed"],
                team["status"]
            ]
            
            # Add round scores
            team_scores = team_scores_dict.get(team["team_id"], {})
            for round_data in all_rounds:
                score = team_scores.get(round_data.id, 0.0)
                row.append(round(score, 2))
            
            writer.writerow(row)
        
        # Commit any current_round updates
        self.db.commit()
        
        # Get CSV content
        csv_content = output.getvalue()
        output.close()
        
        # Return CSV file
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=leaderboard.csv"}
        )

    def export_rolling_results(self, is_frozen: bool = None, is_evaluated: bool = None) -> Response:
        """Export rolling event results to CSV"""
        
        # Build query
        query = self.db.query(RollingEventResult)
        
        # Apply filters
        if is_frozen is not None:
            query = query.filter(RollingEventResult.is_frozen == is_frozen)
        if is_evaluated is not None:
            query = query.filter(RollingEventResult.is_evaluated == is_evaluated)
        
        # Get results and sort by event name
        results = query.order_by(RollingEventResult.event_id).all()
        
        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        header = [
            "Event ID", "Event Name", "Club", "Winner Name", "Winner Register Number",
            "Winner Email", "Winner Phone", "Winner Department", "Winner Year",
            "Runner-up Name", "Runner-up Register Number", "Runner-up Email", 
            "Runner-up Phone", "Runner-up Department", "Runner-up Year",
            "Is Frozen", "Is Evaluated", "Created At", "Updated At"
        ]
        writer.writerow(header)
        
        # Write data
        for result in results:
            # Get event name
            event = self.db.query(UnifiedEvent).filter(
                UnifiedEvent.event_id == result.event_id,
                UnifiedEvent.round_number == 0
            ).first()
            
            row = [
                result.event_id,
                event.name if event else result.event_id,
                result.club,
                result.winner_name,
                result.winner_register_number,
                result.winner_email,
                result.winner_phone,
                result.winner_department,
                result.winner_year,
                result.runner_up_name,
                result.runner_up_register_number,
                result.runner_up_email,
                result.runner_up_phone,
                result.runner_up_department,
                result.runner_up_year,
                result.is_frozen,
                result.is_evaluated,
                result.created_at,
                result.updated_at
            ]
            writer.writerow(row)
        
        # Get CSV content
        csv_content = output.getvalue()
        output.close()
        
        # Determine filename based on filters
        filename = "rolling_events_results.csv"
        if is_frozen is not None and is_frozen:
            filename = "frozen_rolling_events_results.csv"
        elif is_evaluated is not None and is_evaluated:
            filename = "evaluated_rolling_events_results.csv"
        
        # Return CSV file
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
