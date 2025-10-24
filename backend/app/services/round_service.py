from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Dict, Any, Optional
from app.models.rounds import UnifiedEvent
from app.models.team import Team, TeamStatus
from app.models.team_score import TeamScore
from app.models.round_weight import RoundWeight
from app.schemas.team_score import TeamScoreCreate, TeamScoreUpdate
from app.schemas.round_weight import RoundWeightCreate
import json

class RoundService:
    def __init__(self, db: Session):
        self.db = db

    def create_round(self, round_data: dict, user_role: str) -> UnifiedEvent:
        """Create a new round (PDA only) and initialize team scores"""
        if user_role != "admin":  # PDA role is admin
            raise ValueError("Only PDA can create rounds")
        
        # Create the round
        db_round = UnifiedEvent(**round_data)
        self.db.add(db_round)
        self.db.flush()  # Get the ID
        
        # Initialize team scores for all active teams
        active_teams = self.db.query(Team).filter(Team.status == TeamStatus.ACTIVE).all()
        
        for team in active_teams:
            team_score = TeamScore(
                team_id=team.team_id,
                round_id=db_round.id,
                event_id=db_round.event_id,
                score=0.0,
                raw_total_score=0.0,
                is_normalized=False
            )
            self.db.add(team_score)
        
        # Set default weight to 100%
        round_weight = RoundWeight(
            round_id=db_round.id,
            weight_percentage=100.0
        )
        self.db.add(round_weight)
        
        self.db.commit()
        self.db.refresh(db_round)
        return db_round

    def update_criteria(self, round_id: int, criteria: List[Dict[str, Any]], user_role: str, user_club: str = None) -> UnifiedEvent:
        """Update evaluation criteria for a round"""
        round_obj = self.db.query(UnifiedEvent).filter(UnifiedEvent.id == round_id).first()
        if not round_obj:
            raise ValueError("Round not found")
        
        # Check permissions
        if user_role == "clubs" and round_obj.club != user_club:
            raise ValueError("You can only update criteria for your own rounds")
        
        if round_obj.is_frozen:
            raise ValueError("Cannot update criteria for frozen rounds")
        
        round_obj.criteria = criteria
        self.db.commit()
        self.db.refresh(round_obj)
        return round_obj

    def evaluate_team(self, round_id: int, team_id: str, criteria_scores: Dict[str, float], 
                     user_role: str, user_club: str = None, is_present: bool = True, 
                     eliminate_absentees: bool = True) -> TeamScore:
        """Evaluate a team for a specific round"""
        round_obj = self.db.query(UnifiedEvent).filter(UnifiedEvent.id == round_id).first()
        if not round_obj:
            raise ValueError("Round not found")
        
        # Check permissions
        if user_role == "clubs" and round_obj.club != user_club:
            raise ValueError("You can only evaluate teams for your own rounds")
        
        if round_obj.is_frozen:
            raise ValueError("Cannot evaluate teams for frozen rounds")
        
        # Check if team is active
        team = self.db.query(Team).filter(Team.team_id == team_id).first()
        if not team or team.status != TeamStatus.ACTIVE:
            raise ValueError("Only active teams can be evaluated")
        
        # Get or create team score
        team_score = self.db.query(TeamScore).filter(
            and_(TeamScore.round_id == round_id, TeamScore.team_id == team_id)
        ).first()
        
        if not team_score:
            team_score = TeamScore(
                team_id=team_id,
                round_id=round_id,
                event_id=round_obj.event_id,
                score=0.0,
                raw_total_score=0.0,
                is_normalized=False,
                is_present=is_present
            )
            self.db.add(team_score)
        
        # Set presence status
        team_score.is_present = is_present
        
        # If team is absent, set score to 0 and optionally mark as eliminated
        if not is_present:
            team_score.score = 0.0
            team_score.raw_total_score = 0.0
            team_score.criteria_scores = {}
            team_score.is_normalized = True
            
            # Only mark team as eliminated if elimination is enabled
            if eliminate_absentees:
                team.status = TeamStatus.ELIMINATED
            # If elimination is disabled, team keeps current status (usually ACTIVE)
            
            self.db.commit()
        else:
            # Calculate raw total score only if team is present
            raw_total = sum(criteria_scores.values())
            team_score.raw_total_score = raw_total
            team_score.criteria_scores = criteria_scores
            
            # Normalize to 100 if criteria are defined
            if round_obj.criteria:
                max_possible = sum(criterion.get('max_points', 0) for criterion in round_obj.criteria)
                if max_possible > 0:
                    normalized_score = (raw_total / max_possible) * 100
                    team_score.score = min(normalized_score, 100.0)  # Cap at 100
                    team_score.is_normalized = True
                else:
                    team_score.score = raw_total
                    team_score.is_normalized = False
            else:
                # Default normalization to 100
                team_score.score = min(raw_total, 100.0)
                team_score.is_normalized = True
        
        self.db.commit()
        self.db.refresh(team_score)
        return team_score

    def freeze_round(self, round_id: int, user_role: str, user_club: str = None) -> Dict[str, Any]:
        """Freeze round evaluations and calculate statistics"""
        if user_role not in ["admin", "clubs"]:
            raise ValueError("Only PDA and club members can freeze rounds")
        
        round_obj = self.db.query(UnifiedEvent).filter(UnifiedEvent.id == round_id).first()
        if not round_obj:
            raise ValueError("Round not found")
        
        # Club users can only freeze their own rounds
        if user_role == "clubs" and round_obj.club != user_club:
            raise ValueError("You can only freeze rounds for your own club")
        
        if round_obj.is_frozen:
            raise ValueError("Round is already frozen")
        
        # Get all team scores for this round
        team_scores = self.db.query(TeamScore).filter(TeamScore.round_id == round_id).all()
        
        if not team_scores:
            raise ValueError("No evaluations found for this round")
        
        # Calculate statistics
        scores = [ts.score for ts in team_scores if ts.score > 0]  # Non-zero scores only
        
        if scores:
            max_score = max(scores)
            min_score = min(scores)
            avg_score = sum(scores) / len(scores)
        else:
            max_score = min_score = avg_score = 0.0
        
        # Update round with statistics
        round_obj.is_frozen = True
        round_obj.max_score = max_score
        round_obj.min_score = min_score
        round_obj.avg_score = avg_score
        round_obj.participated_count = len(team_scores)
        
        self.db.commit()
        self.db.refresh(round_obj)
        
        return {
            "round_id": round_id,
            "is_frozen": True,
            "max_score": max_score,
            "min_score": min_score,
            "avg_score": avg_score,
            "participated_count": len(team_scores)
        }


    def get_round_evaluations(self, round_id: int, user_role: str, user_club: str = None) -> List[TeamScore]:
        """Get all team evaluations for a round"""
        round_obj = self.db.query(UnifiedEvent).filter(UnifiedEvent.id == round_id).first()
        if not round_obj:
            raise ValueError("Round not found")
        
        # Check permissions
        if user_role == "clubs" and round_obj.club != user_club:
            raise ValueError("You can only view evaluations for your own rounds")
        
        return self.db.query(TeamScore).filter(TeamScore.round_id == round_id).all()

    def get_round_stats(self, round_id: int) -> Dict[str, Any]:
        """Get round statistics"""
        round_obj = self.db.query(UnifiedEvent).filter(UnifiedEvent.id == round_id).first()
        if not round_obj:
            raise ValueError("Round not found")
        
        team_scores = self.db.query(TeamScore).filter(TeamScore.round_id == round_id).all()
        
        # Get top 3 teams if round is frozen
        top_3_teams = []
        if round_obj.is_frozen and team_scores:
            # Sort by score descending and get top 3
            sorted_scores = sorted(team_scores, key=lambda x: x.score, reverse=True)[:3]
            for score in sorted_scores:
                team = self.db.query(Team).filter(Team.team_id == score.team_id).first()
                if team:
                    top_3_teams.append({
                        "team_id": team.team_id,
                        "team_name": team.team_name,
                        "score": score.score
                    })
        
        return {
            "round_id": round_id,
            "round_name": round_obj.name,
            "is_frozen": round_obj.is_frozen,
            "is_evaluated": round_obj.is_evaluated,
            "max_score": round_obj.max_score,
            "min_score": round_obj.min_score,
            "avg_score": round_obj.avg_score,
            "participated_count": len(team_scores),
            "total_teams": len(team_scores),
            "shortlisted_count": len(round_obj.shortlisted_teams) if round_obj.shortlisted_teams else 0,
            "top_3_teams": top_3_teams
        }

    def validate_round_access(self, round_id: int, user_role: str, user_club: str = None) -> UnifiedEvent:
        """Validate if user can access a round"""
        round_obj = self.db.query(UnifiedEvent).filter(UnifiedEvent.id == round_id).first()
        if not round_obj:
            raise ValueError("Round not found")
        
        # PDA can access all rounds
        if user_role == "admin":
            return round_obj
        
        # Clubs can only access their own rounds
        if user_role == "clubs" and round_obj.club == user_club:
            return round_obj
        
        raise ValueError("You don't have permission to access this round")

    def get_active_teams_for_round(self, round_id: int) -> List[Team]:
        """Get all active teams that can be evaluated for a round"""
        return self.db.query(Team).filter(Team.status == TeamStatus.ACTIVE).all()

    def can_edit_round(self, round_id: int) -> bool:
        """Check if a round can be edited (not frozen)"""
        round_obj = self.db.query(UnifiedEvent).filter(UnifiedEvent.id == round_id).first()
        if not round_obj:
            return False
        return not round_obj.is_frozen

    def get_round_criteria(self, round_id: int) -> List[Dict[str, Any]]:
        """Get evaluation criteria for a round"""
        round_obj = self.db.query(UnifiedEvent).filter(UnifiedEvent.id == round_id).first()
        if not round_obj:
            raise ValueError("Round not found")
        return round_obj.criteria or []

    def calculate_team_rank(self, round_id: int, team_id: str) -> int:
        """Calculate team's rank in a round"""
        team_scores = self.db.query(TeamScore).filter(
            TeamScore.round_id == round_id
        ).order_by(TeamScore.score.desc()).all()
        
        for i, ts in enumerate(team_scores):
            if ts.team_id == team_id:
                return i + 1
        
        return 0  # Team not found or not evaluated

    def get_round_leaderboard(self, round_id: int, user_role: str, user_club: str = None) -> List[Dict[str, Any]]:
        """Get leaderboard for a specific round"""
        # Validate access
        self.validate_round_access(round_id, user_role, user_club)
        
        team_scores = self.db.query(TeamScore).filter(
            TeamScore.round_id == round_id
        ).order_by(TeamScore.score.desc()).all()
        
        leaderboard = []
        for i, ts in enumerate(team_scores):
            team = self.db.query(Team).filter(Team.team_id == ts.team_id).first()
            if team:
                leaderboard.append({
                    "rank": i + 1,
                    "team_id": ts.team_id,
                    "team_name": team.team_name,
                    "score": ts.score,
                    "raw_total_score": ts.raw_total_score,
                    "is_normalized": ts.is_normalized,
                    "criteria_scores": ts.criteria_scores
                })
        
        return leaderboard

    def shortlist_teams(self, round_id: int, shortlist_type: str, value: float, user_role: str) -> Dict[str, Any]:
        """Shortlist teams based on top K or score threshold (PDA only)"""
        print(f"Shortlist request: round_id={round_id}, type={shortlist_type}, value={value}, user_role={user_role}")
        
        if user_role != "admin":  # PDA role is admin
            raise ValueError("Only PDA can shortlist teams")
        
        # Get the round
        round_obj = self.db.query(UnifiedEvent).filter(UnifiedEvent.id == round_id).first()
        if not round_obj:
            raise ValueError("Round not found")
        
        print(f"Round found: {round_obj.name}, is_frozen: {round_obj.is_frozen}")
        
        if not round_obj.is_frozen:
            raise ValueError("Round must be frozen before shortlisting")
        
        # Get ALL active teams (not just evaluated ones)
        all_active_teams = self.db.query(Team).filter(Team.status == TeamStatus.ACTIVE).all()
        print(f"Found {len(all_active_teams)} active teams")
        
        if not all_active_teams:
            raise ValueError("No active teams found for shortlisting")
        
        # Pre-fetch all weights to avoid repeated queries
        weights_cache = {}
        all_round_ids = set()
        
        # Get all relevant round IDs first
        evaluated_rounds = self.db.query(UnifiedEvent).filter(
            UnifiedEvent.is_evaluated == True,
            UnifiedEvent.round_number > 0
        ).all()
        
        frozen_rounds = self.db.query(UnifiedEvent).filter(
            UnifiedEvent.is_frozen == True,
            UnifiedEvent.is_evaluated == False,
            UnifiedEvent.round_number > 0
        ).all()
        
        for round_obj in evaluated_rounds + frozen_rounds:
            all_round_ids.add(round_obj.id)
        
        # Pre-fetch all existing weights
        if all_round_ids:
            existing_weights = self.db.query(RoundWeight).filter(
                RoundWeight.round_id.in_(all_round_ids)
            ).all()
            
            for weight in existing_weights:
                weights_cache[weight.round_id] = weight.weight_percentage
            
            # Create missing weights in batch
            missing_round_ids = all_round_ids - set(weights_cache.keys())
            for round_id in missing_round_ids:
                weight = RoundWeight(
                    round_id=round_id,
                    weight_percentage=100.0
                )
                self.db.add(weight)
                weights_cache[round_id] = 100.0
            
            # Commit all new weights at once
            if missing_round_ids:
                self.db.commit()
        
        # Calculate overall scores for all teams using cached weights
        all_teams_with_scores = []
        for team in all_active_teams:
            overall_score = self._calculate_overall_score(team.team_id, weights_cache)
            all_teams_with_scores.append({
                'team_id': team.team_id,
                'team_name': team.team_name,
                'score': overall_score or 0.0  # Default to 0 if no overall score
            })
        
        # Sort by overall score (descending)
        all_teams_with_scores.sort(key=lambda x: x['score'], reverse=True)
        print(f"All teams with overall scores: {[(t['team_id'], t['score']) for t in all_teams_with_scores]}")
        
        if not all_teams_with_scores:
            raise ValueError("No teams found for shortlisting")
        
        shortlisted_teams = []
        eliminated_teams = []
        
        if shortlist_type == "top_k":
            # Shortlist top K teams
            k = int(value)
            if k <= 0 or k > len(all_teams_with_scores):
                raise ValueError(f"Invalid top_k value: {k}. Must be between 1 and {len(all_teams_with_scores)}")
            shortlisted_teams = all_teams_with_scores[:k]
            eliminated_teams = all_teams_with_scores[k:]
            
        elif shortlist_type == "threshold":
            # Shortlist teams with score >= threshold
            threshold = float(value)
            if threshold < 0 or threshold > 100:
                raise ValueError(f"Invalid threshold value: {threshold}. Must be between 0 and 100")
            for team_data in all_teams_with_scores:
                if team_data['score'] >= threshold:
                    shortlisted_teams.append(team_data)
                else:
                    eliminated_teams.append(team_data)
        else:
            raise ValueError(f"Invalid shortlist_type: {shortlist_type}. Must be 'top_k' or 'threshold'")
        
        print(f"Shortlisted: {len(shortlisted_teams)}, Eliminated: {len(eliminated_teams)}")
        
        # Update team statuses
        for team_data in shortlisted_teams:
            team = self.db.query(Team).filter(Team.team_id == team_data['team_id']).first()
            if team:
                team.status = TeamStatus.ACTIVE  # Keep as active (shortlisted)
                print(f"Keeping team {team_data['team_id']} as ACTIVE")
        
        for team_data in eliminated_teams:
            team = self.db.query(Team).filter(Team.team_id == team_data['team_id']).first()
            if team:
                team.status = TeamStatus.ELIMINATED  # Mark as eliminated
                print(f"Eliminating team {team_data['team_id']}")
        
        # Update round with shortlisted teams info
        shortlisted_team_ids = [team_data['team_id'] for team_data in shortlisted_teams]
        round_obj.shortlisted_teams = shortlisted_team_ids
        round_obj.is_evaluated = True  # Set is_evaluated = 1 after successful shortlisting
        
        self.db.commit()
        
        return {
            "shortlisted_count": len(shortlisted_teams),
            "eliminated_count": len(eliminated_teams),
            "shortlisted_teams": shortlisted_team_ids,
            "shortlist_type": shortlist_type,
            "shortlist_value": value
        }


    def _calculate_overall_score(self, team_id: str, weights_cache: dict = None) -> Optional[float]:
        """Calculate overall score (weighted average) for a team based on evaluated rounds + current frozen round"""
        # Get all evaluated rounds + current frozen round (if not yet evaluated)
        evaluated_rounds = self.db.query(UnifiedEvent).filter(
            UnifiedEvent.is_evaluated == True,
            UnifiedEvent.round_number > 0
        ).all()
        
        # Also include any frozen rounds that are not yet evaluated (current round)
        frozen_rounds = self.db.query(UnifiedEvent).filter(
            UnifiedEvent.is_frozen == True,
            UnifiedEvent.is_evaluated == False,
            UnifiedEvent.round_number > 0
        ).all()
        
        # Combine both sets
        all_rounds = evaluated_rounds + frozen_rounds
        
        if not all_rounds:
            return None
        
        # Create a set of round IDs for faster lookup
        round_ids = {round_obj.id for round_obj in all_rounds}
        
        # Get team scores for all relevant rounds
        team_scores = self.db.query(TeamScore).filter(
            TeamScore.team_id == team_id,
            TeamScore.round_id.in_(round_ids)
        ).all()
        
        # Create a dictionary of scores for easier lookup
        team_scores_dict = {score.round_id: score.score for score in team_scores}
        
        # Calculate weighted average (including 0 scores for missing rounds)
        total_weighted_score = 0.0
        total_weight = 0.0
        
        for round_id in round_ids:
            # Use cached weight if available, otherwise query database
            if weights_cache and round_id in weights_cache:
                weight_percentage = weights_cache[round_id]
            else:
                # Get weight for this round, create default if not exists
                weight = self.db.query(RoundWeight).filter(
                    RoundWeight.round_id == round_id
                ).first()
                
                if not weight:
                    # Create default weight of 100%
                    weight = RoundWeight(
                        round_id=round_id,
                        weight_percentage=100.0
                    )
                    self.db.add(weight)
                    # Don't commit here - let caller handle batch commit
                    weight_percentage = 100.0
                else:
                    weight_percentage = weight.weight_percentage
                
                # Cache the weight for future use
                if weights_cache is not None:
                    weights_cache[round_id] = weight_percentage
            
            # Get score for this round (0 if not found)
            round_score = team_scores_dict.get(round_id, 0.0)
            
            weight_value = weight_percentage / 100.0  # Convert to decimal
            total_weighted_score += round_score * weight_value
            total_weight += weight_value
        
        if total_weight == 0:
            return None
        
        return total_weighted_score / total_weight

    def toggle_elimination_setting(self, round_id: int, eliminate_absentees: bool) -> Dict[str, Any]:
        """Toggle elimination setting and reactivate eliminated teams if needed"""
        # Validate round exists
        round_obj = self.db.query(UnifiedEvent).filter(UnifiedEvent.id == round_id).first()
        if not round_obj:
            raise ValueError("Round not found")
        
        # If switching from eliminate=True to eliminate=False, reactivate eliminated teams
        if not eliminate_absentees:
            # Find teams that were eliminated due to being absent in this round
            eliminated_teams = self.db.query(Team).join(TeamScore).filter(
                Team.status == TeamStatus.ELIMINATED,
                TeamScore.round_id == round_id,
                TeamScore.is_present == False
            ).all()
            
            reactivated_count = 0
            for team in eliminated_teams:
                # Only reactivate if they were eliminated due to absence in this specific round
                team_score = self.db.query(TeamScore).filter(
                    TeamScore.team_id == team.team_id,
                    TeamScore.round_id == round_id
                ).first()
                
                if team_score and not team_score.is_present:
                    team.status = TeamStatus.ACTIVE
                    reactivated_count += 1
            
            self.db.commit()
            
            return {
                "message": f"Elimination setting updated. {reactivated_count} teams reactivated.",
                "eliminate_absentees": eliminate_absentees,
                "reactivated_teams": reactivated_count
            }
        else:
            return {
                "message": "Elimination setting updated.",
                "eliminate_absentees": eliminate_absentees,
                "reactivated_teams": 0
            }

    def handle_absentees_after_freezing(self, round_id: int, eliminate_absentees: bool) -> dict:
        """Handle absent teams after a round has been frozen (PDA only)"""
        round_obj = self.db.query(UnifiedEvent).filter(UnifiedEvent.id == round_id).first()
        if not round_obj:
            raise ValueError("Round not found")
        
        if not round_obj.is_frozen:
            raise ValueError("Round must be frozen before handling absentees")
        
        eliminated_count = 0
        reactivated_count = 0
        
        if eliminate_absentees:
            # Get all team scores for this round where teams are marked as absent
            absent_team_scores = self.db.query(TeamScore).filter(
                and_(
                    TeamScore.round_id == round_id,
                    TeamScore.is_present == False
                )
            ).all()
            
            for team_score in absent_team_scores:
                team = self.db.query(Team).filter(Team.team_id == team_score.team_id).first()
                if not team:
                    continue
                
                # Eliminate the team if not already eliminated
                if team.status != TeamStatus.ELIMINATED:
                    team.status = TeamStatus.ELIMINATED
                    eliminated_count += 1
        else:
            # When reactivating, handle both absent teams and already eliminated teams
            # Get all teams that participated in this round (have team scores)
            round_team_scores = self.db.query(TeamScore).filter(
                TeamScore.round_id == round_id
            ).all()
            
            for team_score in round_team_scores:
                team = self.db.query(Team).filter(Team.team_id == team_score.team_id).first()
                if not team:
                    continue
                
                # Reactivate the team if it was eliminated (regardless of whether it was absent or not)
                if team.status == TeamStatus.ELIMINATED:
                    team.status = TeamStatus.ACTIVE
                    reactivated_count += 1
        
        self.db.commit()
        
        return {
            "message": f"Teams processed successfully. {eliminated_count} teams eliminated, {reactivated_count} teams reactivated.",
            "eliminated_count": eliminated_count,
            "reactivated_count": reactivated_count,
            "eliminate_absentees": eliminate_absentees
        }
