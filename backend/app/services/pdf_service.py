from weasyprint import HTML, CSS
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path
import io
import base64
from typing import List, Dict, Any

class PDFService:
    def __init__(self):
        # Set up Jinja2 environment
        template_dir = Path(__file__).parent.parent / 'templates'
        self.env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=select_autoescape(['html', 'xml'])
        )
    
    def generate_official_leaderboard_pdf(
        self,
        teams: List[Dict[str, Any]],
        event_name: str = "CRESTORA'25",
        round_number: int = 3
    ) -> bytes:
        """
        Generate official leaderboard PDF using Jinja2 template and WeasyPrint
        
        Args:
            teams: List of team dictionaries with rank, team_id, team_name
            event_name: Name of the event (default: "CRESTORA'25")
            round_number: Round number (default: 3)
        
        Returns:
            PDF file as bytes
        """
        # Load the template
        template = self.env.get_template('leaderboard_official.html')
        
        # Render the template with data
        html_content = template.render(
            teams=teams,
            event_name=event_name,
            round_number=round_number
        )
        
        # Set base URL to the public directory for image resolution
        # __file__ is in backend/app/services/, so go up 2 levels to backend/, then into public/
        public_dir = Path(__file__).parent.parent.parent / 'public'
        
        # Convert images to base64 for embedding
        left_logo_path = public_dir / 'left.png'
        right_logo_path = public_dir / 'right.png'
        water_logo_path = public_dir / 'water.png'
        
        if left_logo_path.exists():
            with open(left_logo_path, 'rb') as f:
                left_logo_b64 = base64.b64encode(f.read()).decode('utf-8')
                left_logo_data = f'data:image/png;base64,{left_logo_b64}'
        else:
            left_logo_data = ''
        
        if right_logo_path.exists():
            with open(right_logo_path, 'rb') as f:
                right_logo_b64 = base64.b64encode(f.read()).decode('utf-8')
                right_logo_data = f'data:image/png;base64,{right_logo_b64}'
        else:
            right_logo_data = ''
        
        if water_logo_path.exists():
            with open(water_logo_path, 'rb') as f:
                water_logo_b64 = base64.b64encode(f.read()).decode('utf-8')
                water_logo_data = f'data:image/png;base64,{water_logo_b64}'
        else:
            water_logo_data = ''
        
        # Replace relative image paths with base64 data URLs
        html_content = html_content.replace('src="public/left.png"', f'src="{left_logo_data}"')
        html_content = html_content.replace('src="public/right.png"', f'src="{right_logo_data}"')
        html_content = html_content.replace('src="public/water.png"', f'src="{water_logo_data}"')
        
        # Generate PDF from HTML
        pdf_bytes = HTML(string=html_content).write_pdf()
        
        return pdf_bytes
    
    def generate_detailed_leaderboard_pdf(
        self,
        teams: List[Dict[str, Any]],
        event_name: str = "CRESTORA'25",
        include_scores: bool = True
    ) -> bytes:
        """
        Generate detailed leaderboard PDF with scores and statistics
        
        Args:
            teams: List of team dictionaries with full details
            event_name: Name of the event
            include_scores: Whether to include detailed scores
        
        Returns:
            PDF file as bytes
        """
        # Create a detailed HTML template inline for now
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>{event_name} - Detailed Leaderboard</title>
            <style>
                @page {{
                    size: A4 landscape;
                    margin: 15mm;
                }}
                
                body {{
                    font-family: Arial, sans-serif;
                    font-size: 10px;
                }}
                
                h1 {{
                    text-align: center;
                    font-size: 18px;
                    margin-bottom: 20px;
                }}
                
                table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }}
                
                th {{
                    background-color: #f0f0f0;
                    border: 1px solid #000;
                    padding: 8px;
                    text-align: center;
                    font-weight: bold;
                }}
                
                td {{
                    border: 1px solid #000;
                    padding: 6px;
                    text-align: center;
                }}
                
                .rank-1 {{ background-color: #ffd700; }}
                .rank-2 {{ background-color: #c0c0c0; }}
                .rank-3 {{ background-color: #cd7f32; }}
            </style>
        </head>
        <body>
            <h1>{event_name} - Detailed Leaderboard</h1>
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Team Code</th>
                        <th>Team Name</th>
                        <th>Leader Name</th>
                        <th>Final Score</th>
                        <th>Percentile</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
        """
        
        for team in teams:
            rank_class = ""
            if team['rank'] == 1:
                rank_class = "rank-1"
            elif team['rank'] == 2:
                rank_class = "rank-2"
            elif team['rank'] == 3:
                rank_class = "rank-3"
            
            html_content += f"""
                    <tr class="{rank_class}">
                        <td>{team['rank']}</td>
                        <td><strong>{team['team_id']}</strong></td>
                        <td>{team['team_name']}</td>
                        <td>{team['leader_name']}</td>
                        <td>{team['final_score']:.2f}</td>
                    <td>{team.get('normalized_score', 0):.2f}%</td>
                    <td>{team['status']}</td>
                    </tr>
            """
        
        html_content += """
                </tbody>
            </table>
        </body>
        </html>
        """
        
        # Generate PDF from HTML
        pdf_bytes = HTML(string=html_content).write_pdf()
        
        return pdf_bytes
    
    def generate_shortlisted_leaderboard_pdf(
        self,
        teams: List[Dict[str, Any]],
        event_name: str = "CRESTORA'25",
        round_number: int = 3
    ) -> bytes:
        """
        Generate shortlisted leaderboard PDF sorted by team name (alphabetically)
        
        Args:
            teams: List of team dictionaries with team_id, team_name
            event_name: Name of the event (default: "CRESTORA'25")
            round_number: Round number (default: 3)
        
        Returns:
            PDF file as bytes
        """
        # Sort teams alphabetically by team_name
        sorted_teams = sorted(teams, key=lambda x: (x.get("team_name") or "").upper())
        
        # Assign serial numbers (Si.No) starting from 1
        for index, team in enumerate(sorted_teams, start=1):
            team["si_no"] = index
        
        # Load the template
        template = self.env.get_template('leaderboard_shortlisted.html')
        
        # Render the template with data
        html_content = template.render(
            teams=sorted_teams,
            event_name=event_name,
            round_number=round_number
        )
        
        # Set base URL to the public directory for image resolution
        public_dir = Path(__file__).parent.parent.parent / 'public'
        
        # Convert images to base64 for embedding
        left_logo_path = public_dir / 'left.png'
        right_logo_path = public_dir / 'right.png'
        water_logo_path = public_dir / 'water.png'
        
        if left_logo_path.exists():
            with open(left_logo_path, 'rb') as f:
                left_logo_b64 = base64.b64encode(f.read()).decode('utf-8')
                left_logo_data = f'data:image/png;base64,{left_logo_b64}'
        else:
            left_logo_data = ''
        
        if right_logo_path.exists():
            with open(right_logo_path, 'rb') as f:
                right_logo_b64 = base64.b64encode(f.read()).decode('utf-8')
                right_logo_data = f'data:image/png;base64,{right_logo_b64}'
        else:
            right_logo_data = ''
        
        if water_logo_path.exists():
            with open(water_logo_path, 'rb') as f:
                water_logo_b64 = base64.b64encode(f.read()).decode('utf-8')
                water_logo_data = f'data:image/png;base64,{water_logo_b64}'
        else:
            water_logo_data = ''
        
        # Replace relative image paths with base64 data URLs
        html_content = html_content.replace('src="public/left.png"', f'src="{left_logo_data}"')
        html_content = html_content.replace('src="public/right.png"', f'src="{right_logo_data}"')
        html_content = html_content.replace('src="public/water.png"', f'src="{water_logo_data}"')
        
        # Generate PDF from HTML
        pdf_bytes = HTML(string=html_content).write_pdf()
        
        return pdf_bytes

