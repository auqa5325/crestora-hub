"""
Mock Gmail service for testing without actual Gmail API setup
"""

import logging
from typing import List

logger = logging.getLogger(__name__)

class MockGmailService:
    def __init__(self):
        self.service = "mock"
        self.credentials = "mock"
    
    def is_authenticated(self) -> bool:
        """Mock authentication - always returns True"""
        return True
    
    def send_email_with_attachment(
        self,
        to_emails: List[str],
        subject: str,
        body: str,
        attachment_data: bytes,
        attachment_filename: str,
        attachment_mime_type: str = 'text/csv',
        from_email: str = None
    ) -> bool:
        """Mock email sending - simulates success"""
        logger.info(f"Mock: Sending email to {to_emails}")
        logger.info(f"Mock: Subject: {subject}")
        logger.info(f"Mock: Attachment: {attachment_filename} ({len(attachment_data)} bytes)")
        return True
    
    def send_leaderboard_csv(
        self,
        to_emails: List[str],
        csv_data: bytes,
        event_name: str = "Crestora'25"
    ) -> bool:
        """Mock leaderboard CSV sending"""
        logger.info(f"Mock: Sending leaderboard CSV to {to_emails} for {event_name}")
        return True

# Mock instance for testing
mock_gmail_service = MockGmailService()
