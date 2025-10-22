# Gmail Integration Setup

This document explains how to set up Gmail integration for automatic CSV export functionality in the Crestora'25 leaderboard.

## Prerequisites

1. A Google account with Gmail access
2. Google Cloud Console access
3. Python dependencies installed (already included in requirements.txt)

## Setup Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note down your project ID

### 2. Enable Gmail API

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Gmail API"
3. Click on "Gmail API" and then "Enable"

### 3. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in the required fields (App name, User support email, Developer contact)
   - Add your email to test users
4. For Application type, choose "Desktop application"
5. Give it a name (e.g., "Crestora Gmail Integration")
6. Click "Create"
7. Download the JSON file and rename it to `credentials.json`
8. Place this file in the backend root directory (`/backend/credentials.json`)

### 4. Configure Environment Variables (Optional)

You can set these environment variables to customize the file paths:

```bash
export GMAIL_CREDENTIALS_FILE="credentials.json"
export GMAIL_TOKEN_FILE="token.json"
```

### 5. First-Time Authentication

When you first run the application, the Gmail service will:

1. Open a browser window for OAuth authentication
2. Ask you to sign in to your Google account
3. Request permission to send emails on your behalf
4. Generate a `token.json` file for future use

### 6. File Structure

After setup, your backend directory should have:

```
backend/
├── credentials.json    # OAuth credentials (from Google Cloud Console)
├── token.json         # Generated after first authentication
├── app/
│   └── services/
│       └── gmail_service.py
└── ...
```

## Security Notes

- **Never commit `credentials.json` or `token.json` to version control**
- Add these files to your `.gitignore`:
  ```
  credentials.json
  token.json
  ```
- The `token.json` file contains refresh tokens and should be kept secure
- Consider using environment variables for production deployments

## Usage

Once set up, users with PDA role can:

1. Go to the Leaderboard page
2. Click "Email CSV" button
3. Enter recipient email addresses (comma-separated)
4. Optionally customize the event name
5. Click "Send Email"

The system will automatically:
- Generate the current leaderboard CSV
- Send it as an email attachment
- Show success/error notifications

## Troubleshooting

### Common Issues

1. **"Gmail service not configured" error**
   - Ensure `credentials.json` exists in the backend directory
   - Check that Gmail API is enabled in Google Cloud Console

2. **Authentication errors**
   - Delete `token.json` and restart the application to re-authenticate
   - Ensure the OAuth consent screen is properly configured

3. **Permission denied errors**
   - Check that the Google account has permission to send emails
   - Verify the OAuth scopes include `https://www.googleapis.com/auth/gmail.send`

4. **Email not received**
   - Check spam/junk folders
   - Verify email addresses are correct
   - Check Gmail API quotas in Google Cloud Console

### API Quotas

Gmail API has daily quotas:
- 1 billion quota units per day
- Sending an email costs 100 quota units
- Monitor usage in Google Cloud Console

## Production Considerations

For production deployment:

1. Use a dedicated Google account for the application
2. Set up proper OAuth consent screen with verified domain
3. Consider using service accounts for server-to-server authentication
4. Implement proper error handling and logging
5. Set up monitoring for API quota usage

## Support

If you encounter issues:

1. Check the application logs for detailed error messages
2. Verify all setup steps were completed correctly
3. Test with a simple email first
4. Contact the development team for assistance
