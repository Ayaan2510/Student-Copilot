# School Co-Pilot Chrome Extension

A privacy-focused educational assistant that provides students with AI-powered help using only school-approved documents. Teachers maintain complete control over access and content.

## Project Structure

```
school-copilot/
├── extension/              # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── service_worker.ts
│   ├── popup.html
│   ├── sidepanel.html
│   ├── content_script.ts
│   ├── options.html
│   └── assets/
├── backend/               # FastAPI Backend Service
│   ├── main.py
│   ├── models/
│   ├── services/
│   ├── api/
│   └── tests/
├── dashboard/             # Teacher Dashboard (React)
│   ├── src/
│   ├── public/
│   └── package.json
├── shared/               # Shared TypeScript types
│   └── types.ts
└── config/
    └── school.config.json
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.9+
- Chrome Browser

### Development Setup

1. **Clone and install dependencies:**
   ```bash
   cd school-copilot
   npm install
   cd backend && pip install -r requirements.txt
   cd ../dashboard && npm install
   ```

2. **Start the backend:**
   ```bash
   cd backend
   python -m uvicorn main:app --reload --port 8000
   ```

3. **Start the teacher dashboard:**
   ```bash
   cd dashboard
   npm start
   ```

4. **Load the Chrome extension:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `extension/` folder

### Configuration

Edit `config/school.config.json` to customize settings for your school:

```json
{
  "school": {
    "name": "Your School Name",
    "domain": "yourschool.edu"
  },
  "features": {
    "maxDailyQuestions": 50,
    "enableAnimations": true
  }
}
```

## Features

- **Student Extension**: Clean, Copilot-style interface for asking questions
- **Teacher Dashboard**: Complete control over access, documents, and monitoring
- **RAG Pipeline**: Local document processing with citations
- **FERPA Compliant**: No external data sharing, complete privacy control
- **Accessibility**: Full keyboard navigation and screen reader support

## Usage

### For Students
1. Press `Alt+Shift+C` to open the extension
2. Select your class from the dropdown
3. Ask questions using the input field or quick action chips
4. View answers with citations from school documents

### For Teachers
1. Access the dashboard at `http://localhost:3000`
2. Upload and assign documents to classes
3. Control student access per class or individual
4. Monitor usage through audit logs
5. Configure content guardrails and policies

## Testing

```bash
# Backend tests
cd backend && python -m pytest

# Extension tests
cd extension && npm test

# Dashboard tests
cd dashboard && npm test

# End-to-end tests
npm run test:e2e
```

## Security & Privacy

- **Minimal Permissions**: Extension requests only necessary Chrome permissions
- **Local Processing**: All document processing occurs locally or on school servers
- **No External APIs**: Zero external data sharing or web search
- **Audit Logging**: Complete activity tracking for compliance
- **Data Isolation**: Strict separation between class document collections

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment instructions.

## License

MIT License - See [LICENSE](LICENSE) for details.