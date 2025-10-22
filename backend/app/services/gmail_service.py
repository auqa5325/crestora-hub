import os
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Optional
import logging

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Gmail API scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.send']

logger = logging.getLogger(__name__)

class GmailService:
    def __init__(self):
        self.service = None
        self.credentials = None
        self._authenticated = False
        self._auth_error = None
        try:
            self._authenticate()
        except Exception as e:
            logger.error(f"Failed to initialize Gmail service: {str(e)}")
            self._auth_error = str(e)
    
    def _authenticate(self):
        """Authenticate with Gmail API"""
        try:
            # Check if credentials file exists
            creds_file = os.getenv('GMAIL_CREDENTIALS_FILE', 'credentials.json')
            token_file = os.getenv('GMAIL_TOKEN_FILE', 'token.json')
            
            if not os.path.exists(creds_file):
                logger.warning(f"Gmail credentials file not found at {creds_file}")
                return
            
            # Load existing credentials
            if os.path.exists(token_file):
                self.credentials = Credentials.from_authorized_user_file(token_file, SCOPES)
            
            # If there are no valid credentials, authenticate
            if not self.credentials or not self.credentials.valid:
                if self.credentials and self.credentials.expired and self.credentials.refresh_token:
                    self.credentials.refresh(Request())
                else:
                    flow = InstalledAppFlow.from_client_secrets_file(creds_file, SCOPES)
                    self.credentials = flow.run_local_server(port=0)
                
                # Save credentials for next run
                with open(token_file, 'w') as token:
                    token.write(self.credentials.to_json())
            
            # Build the Gmail service
            self.service = build('gmail', 'v1', credentials=self.credentials)
            self._authenticated = True
            logger.info("Gmail service authenticated successfully")
            
        except Exception as e:
            logger.error(f"Failed to authenticate with Gmail API: {str(e)}")
            self.service = None
            self._authenticated = False
            self._auth_error = str(e)
    
    def is_authenticated(self) -> bool:
        """Check if Gmail service is authenticated"""
        return self._authenticated and self.service is not None
    
    def get_auth_error(self) -> str:
        """Get authentication error message"""
        return self._auth_error or "Unknown authentication error"
    
    def send_email_with_attachment(
        self,
        to_emails: List[str],
        subject: str,
        body: str,
        attachment_data: bytes,
        attachment_filename: str,
        attachment_mime_type: str = 'text/csv',
        from_email: Optional[str] = None
    ) -> bool:
        """
        Send email with CSV attachment
        
        Args:
            to_emails: List of recipient email addresses
            subject: Email subject
            body: Email body (HTML or plain text)
            attachment_data: CSV data as bytes
            attachment_filename: Name of the attachment file
            attachment_mime_type: MIME type of the attachment
            from_email: Sender email (optional, uses authenticated account if not provided)
        
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        if not self.is_authenticated():
            logger.error("Gmail service not authenticated")
            return False
        
        try:
            # Create message
            message = MIMEMultipart()
            message['to'] = ', '.join(to_emails)
            message['subject'] = subject
            
            # Add body
            message.attach(MIMEText(body, 'html'))
            
            # Add attachment
            attachment = MIMEBase('application', 'octet-stream')
            attachment.set_payload(attachment_data)
            encoders.encode_base64(attachment)
            attachment.add_header(
                'Content-Disposition',
                f'attachment; filename= {attachment_filename}'
            )
            message.attach(attachment)
            
            # Encode message
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
            
            # Send message
            send_message = self.service.users().messages().send(
                userId='me',
                body={'raw': raw_message}
            ).execute()
            
            logger.info(f"Email sent successfully. Message ID: {send_message['id']}")
            return True
            
        except HttpError as error:
            logger.error(f"Gmail API error: {error}")
            logger.error(f"Error details: {error.error_details}")
            
            # Check for specific error types
            if error.resp.status == 403:
                if "accessNotConfigured" in str(error.error_details):
                    logger.error("Gmail API is not enabled. Please enable it in Google Cloud Console.")
                elif "access_denied" in str(error.error_details):
                    logger.error("Access denied. Please check OAuth permissions.")
            
            return False
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False
    
    def send_leaderboard_csv(
        self,
        to_emails: List[str],
        csv_data: bytes,
        event_name: str = "Crestora'25"
    ) -> bool:
        """
        Send leaderboard CSV via email
        
        Args:
            to_emails: List of recipient email addresses
            csv_data: CSV data as bytes
            event_name: Name of the event
        
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        subject = f"{event_name} - Leaderboard Export"
        
        body = f"""
        <html>
        <body>
            <h2>{event_name} Leaderboard Export</h2>
            <p>Please find the attached leaderboard CSV file with current team rankings and scores.</p>
            <p>This export includes:</p>
            <ul>
                <li>Team rankings and final scores</li>
                <li>Weighted averages across all evaluated rounds</li>
                <li>Team status and round completion information</li>
            </ul>
            <p>Best regards,<br>
            Crestora'25 Team</p>
        </body>
        </html>
        """
        
        return self.send_email_with_attachment(
            to_emails=to_emails,
            subject=subject,
            body=body,
            attachment_data=csv_data,
            attachment_filename="leaderboard.csv",
            attachment_mime_type="text/csv"
        )

# Global instance
gmail_service = GmailService()
