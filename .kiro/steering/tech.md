# Technology Stack

## Build System

- **Bundler**: Vite 6.2.0
- **Package Manager**: npm
- **TypeScript**: 5.8.2

## Frontend Framework

- **React**: 19.2.3 with TypeScript
- **UI Components**: Custom components with Tailwind CSS (utility classes)
- **Icons**: lucide-react
- **Charts**: recharts for data visualization

## AI & Computer Vision

- **Pose Detection**: MediaPipe Tasks Vision (@mediapipe/tasks-vision)
  - PoseLandmarker for skeleton tracking
  - ObjectDetector for ball detection
  - Runs client-side in browser
- **AI Analysis**: Google Gemini 2.5 Flash (@google/genai)
  - Structured JSON output with response schemas
  - Thinking budget for complex reasoning
  - Multimodal input (image + pose data)

## Configuration

- **Environment Variables**: Stored in `.env` file
  - `GEMINI_API_KEY` required for AI analysis
  - Exposed via Vite's `import.meta.env.VITE_GEMINI_API_KEY`
- **Path Aliases**: `@/*` maps to project root
- **Dev Server**: Runs on port 3000, host 0.0.0.0

## Common Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm build

# Preview production build
npm run preview
```

## Key Dependencies

- MediaPipe models loaded from CDN at runtime
- No backend server required (fully client-side)
- LocalStorage for analysis history persistence
