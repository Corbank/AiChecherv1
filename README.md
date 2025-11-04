# AiCheckerv1

An AI content detection tool with a user-friendly interface for checking text and documents.

## Features

- **Text Input**: Paste text directly into a text box for AI content analysis
- **File Upload**: Upload PDF or DOCX files for analysis
- **Drag & Drop**: Convenient drag-and-drop interface for file uploads
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Character Counter**: Real-time character count for text input

## Usage

1. Open `index.html` in your web browser
2. Choose your input method:
   - **Paste Text**: Click the "📝 Paste Text" tab and paste your content
   - **Upload File**: Click the "📄 Upload File" tab and either:
     - Click the drop zone to browse for files
     - Drag and drop a PDF or DOCX file
3. Click "Check for AI Content" to submit

## Supported File Formats

- PDF (.pdf)
- Microsoft Word (.docx, .doc)

## Development

The current implementation provides the UI/UX layer for input collection. The backend AI detection functionality will be implemented separately.

### Running Locally

Simply open `index.html` in any modern web browser. No build process or server required for the frontend.

## Next Steps

- Implement backend AI detection algorithm
- Add API integration for processing submissions
- Display analysis results to users
- Add authentication and user accounts
- Implement file parsing for PDF and DOCX formats