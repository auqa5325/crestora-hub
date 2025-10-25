# PDF Export Implementation Guide

## Overview

This implementation adds official PDF export functionality to the leaderboard using Python backend with Jinja2 templates and WeasyPrint. This approach provides pixel-perfect rendering of the official Anna University MIT PDA leaderboard format.

## Architecture

### Backend Components

1. **PDF Service** (`app/services/pdf_service.py`)
   - Handles PDF generation using WeasyPrint
   - Uses Jinja2 templates for HTML rendering
   - Supports multiple PDF formats (official and detailed)

2. **Jinja2 Template** (`app/templates/leaderboard_official.html`)
   - Official Anna University MIT PDA leaderboard template
   - Pixel-perfect match to the original design
   - Includes header with logos, contact info, and leaderboard table

3. **API Endpoint** (`app/api/leaderboard.py`)
   - `/api/leaderboard/export-pdf` - GET endpoint
   - Query parameters:
     - `round_number` (optional): Specific round number
     - `format_type`: 'official' or 'detailed'

### Frontend Components

1. **API Service** (`src/services/api.ts`)
   - `exportLeaderboardPDF()` method
   - Handles blob download and file naming

2. **Leaderboard Page** (`src/pages/Leaderboard.tsx`)
   - Two PDF export buttons:
     - "Official PDF" - Official format with Anna University branding
     - "Detailed PDF" - Comprehensive format with all scores

## Installation

### Backend Dependencies

Add to `requirements.txt`:
```
weasyprint==60.1
Jinja2==3.1.2
```

Install dependencies:
```bash
cd crestora-hub/backend
pip install -r requirements.txt
```

### WeasyPrint System Dependencies

WeasyPrint requires some system libraries:

**macOS:**
```bash
brew install python3 cairo pango gdk-pixbuf libffi
```

**Ubuntu/Debian:**
```bash
sudo apt-get install python3-dev python3-pip python3-setuptools python3-wheel python3-cffi libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info
```

**Windows:**
- Download GTK3 runtime from https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases
- Install and add to PATH

## Usage

### API Endpoint

**Official Format PDF:**
```bash
GET /api/leaderboard/export-pdf?format_type=official&round_number=3
```

**Detailed Format PDF:**
```bash
GET /api/leaderboard/export-pdf?format_type=detailed
```

### Frontend Usage

```typescript
// Export official PDF
await apiService.exportLeaderboardPDF(3, 'official');

// Export detailed PDF
await apiService.exportLeaderboardPDF(undefined, 'detailed');
```

## Template Customization

### Official Template

The official template (`leaderboard_official.html`) includes:

1. **Header Section:**
   - Anna University logos (left and right)
   - Institute name and address
   - Contact information (email and website)
   - Event name and round title

2. **Leaderboard Table:**
   - Three columns: Rank, Team Code, Team Name
   - Minimum 6 rows (empty rows added if needed)
   - Professional styling with borders

### Customizing the Template

Edit `app/templates/leaderboard_official.html`:

```html
<!-- Change event name -->
<div class="event-title">{{ event_name }}</div>

<!-- Change round title -->
<div class="round-title">ROUND {{ round_number }} – LEADERBOARD</div>

<!-- Modify table structure -->
<table class="leaderboard-table">
  <!-- Your custom table structure -->
</table>
```

### Adding New Templates

1. Create new template in `app/templates/`:
```html
<!-- app/templates/leaderboard_custom.html -->
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Your custom styles */
  </style>
</head>
<body>
  <!-- Your custom layout -->
</body>
</html>
```

2. Add method to `PDFService`:
```python
def generate_custom_leaderboard_pdf(self, teams, **kwargs):
    template = self.env.get_template('leaderboard_custom.html')
    html_content = template.render(teams=teams, **kwargs)
    return HTML(string=html_content).write_pdf()
```

3. Update API endpoint to support new format.

## Styling Guidelines

### CSS for Print

```css
@page {
    size: A4;
    margin: 15mm;
}

body {
    font-family: Arial, sans-serif;
    font-size: 12px;
}

/* Avoid page breaks inside elements */
.no-break {
    page-break-inside: avoid;
}
```

### Common Issues

1. **Fonts not rendering:**
   - Use web-safe fonts (Arial, Times New Roman, etc.)
   - Or install custom fonts on the server

2. **Images not showing:**
   - Use absolute URLs or base64-encoded images
   - Ensure proper CORS headers

3. **Layout issues:**
   - Test with different data sizes
   - Use `page-break-after` for multi-page documents

## Performance Considerations

1. **Caching:**
   - Consider caching generated PDFs for frequently accessed data
   - Use Redis or file-based caching

2. **Async Generation:**
   - For large leaderboards, consider async PDF generation
   - Use background tasks (Celery, RQ)

3. **Resource Limits:**
   - WeasyPrint can be memory-intensive
   - Set appropriate timeout limits
   - Monitor server resources

## Troubleshooting

### WeasyPrint Installation Issues

**Error: "cairo library not found"**
```bash
# macOS
brew install cairo

# Ubuntu
sudo apt-get install libcairo2
```

**Error: "Pango library not found"**
```bash
# macOS
brew install pango

# Ubuntu
sudo apt-get install libpango-1.0-0
```

### Template Rendering Issues

**Error: "Template not found"**
- Check template directory path in `PDFService.__init__`
- Ensure template file exists in `app/templates/`

**Error: "Invalid CSS"**
- Validate CSS syntax
- WeasyPrint supports CSS 2.1 and some CSS3 features

### PDF Generation Errors

**Error: "Failed to generate PDF"**
- Check server logs for detailed error messages
- Validate HTML structure
- Test template rendering separately

## Testing

### Manual Testing

1. Start the backend server:
```bash
cd crestora-hub/backend
uvicorn app.main:app --reload
```

2. Test endpoint directly:
```bash
curl -o test.pdf "http://localhost:8000/api/leaderboard/export-pdf?format_type=official"
```

3. Open generated PDF to verify formatting.

### Automated Testing

```python
# test_pdf_export.py
import pytest
from app.services.pdf_service import PDFService

def test_official_pdf_generation():
    pdf_service = PDFService()
    teams = [
        {"rank": 1, "team_id": "CRES-001", "team_name": "Team A"},
        {"rank": 2, "team_id": "CRES-002", "team_name": "Team B"},
    ]
    
    pdf_bytes = pdf_service.generate_official_leaderboard_pdf(
        teams=teams,
        event_name="CRESTORA'25",
        round_number=3
    )
    
    assert pdf_bytes is not None
    assert len(pdf_bytes) > 0
    assert pdf_bytes[:4] == b'%PDF'  # PDF magic number
```

## Deployment

### Production Considerations

1. **Install system dependencies** on production server
2. **Set appropriate file permissions** for template directory
3. **Configure logging** for PDF generation errors
4. **Set resource limits** in production config
5. **Enable HTTPS** for secure PDF downloads

### Docker Deployment

```dockerfile
# Dockerfile
FROM python:3.11-slim

# Install WeasyPrint dependencies
RUN apt-get update && apt-get install -y \
    python3-dev \
    python3-pip \
    python3-setuptools \
    python3-wheel \
    python3-cffi \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

# Copy application
COPY . /app
WORKDIR /app

# Install Python dependencies
RUN pip install -r requirements.txt

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Future Enhancements

1. **Email PDF Attachments:**
   - Extend email service to send PDFs
   - Add PDF option to email export modal

2. **Batch PDF Generation:**
   - Generate PDFs for multiple rounds
   - Create ZIP archive of PDFs

3. **Custom Branding:**
   - Allow dynamic logo uploads
   - Configurable color schemes

4. **Watermarks:**
   - Add "DRAFT" or "CONFIDENTIAL" watermarks
   - Include generation timestamp

5. **Digital Signatures:**
   - Add digital signatures for official documents
   - Integrate with certificate authorities

## Support

For issues or questions:
- Check logs in `backend/logs/`
- Review WeasyPrint documentation: https://doc.courtbouillon.org/weasyprint/
- Review Jinja2 documentation: https://jinja.palletsprojects.com/

## License

This implementation is part of the Crestora'25 project.

