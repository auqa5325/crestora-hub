# Quick Start: PDF Export

## Installation Steps

### 1. Install System Dependencies (macOS)

```bash
brew install python3 cairo pango gdk-pixbuf libffi
```

### 2. Install Python Dependencies

```bash
cd crestora-hub/backend
pip install weasyprint==60.1 Jinja2==3.1.2
```

Or install all dependencies:
```bash
pip install -r requirements.txt
```

### 3. Verify Installation

```bash
python -c "import weasyprint; print('WeasyPrint installed successfully!')"
```

## Testing the Implementation

### 1. Start the Backend Server

```bash
cd crestora-hub/backend
uvicorn app.main:app --reload
```

### 2. Test PDF Generation

Open your browser and navigate to:
```
http://localhost:8000/api/leaderboard/export-pdf?format_type=official
```

This should download a PDF file with the official leaderboard format.

### 3. Test from Frontend

1. Start the frontend:
```bash
cd crestora-hub
npm run dev
```

2. Navigate to the Leaderboard page
3. Click "Official PDF" button
4. PDF should download automatically

## Troubleshooting

### Error: "cairo library not found"

**Solution:**
```bash
brew install cairo
# or
brew reinstall cairo
```

### Error: "No module named 'weasyprint'"

**Solution:**
```bash
pip install weasyprint==60.1
```

### Error: "Template not found"

**Solution:**
- Ensure `app/templates/leaderboard_official.html` exists
- Check file permissions
- Verify template directory path in `pdf_service.py`

### PDF is blank or incorrectly formatted

**Solution:**
- Check browser console for errors
- Verify leaderboard data is loaded
- Check backend logs for PDF generation errors

## Customization

### Change Event Name

Edit `app/api/leaderboard.py`:
```python
pdf_bytes = pdf_service.generate_official_leaderboard_pdf(
    teams=teams,
    event_name="YOUR_EVENT_NAME",  # Change this
    round_number=round_number
)
```

### Modify Template

Edit `app/templates/leaderboard_official.html`:
- Update header text
- Change styling
- Modify table structure

### Add More Columns

Edit template to add columns:
```html
<th class="new-column">NEW COLUMN</th>
```

Update PDF service to pass additional data:
```python
template.render(
    teams=teams,
    event_name=event_name,
    round_number=round_number,
    custom_data=custom_data  # Add your data
)
```

## Next Steps

1. ✅ Install dependencies
2. ✅ Test PDF generation
3. ✅ Customize template (optional)
4. ✅ Deploy to production

For detailed documentation, see `README_PDF_EXPORT.md`







