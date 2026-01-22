# Project Structure

## Root Files

- `App.tsx` - Main application component with video analysis workflow
- `index.tsx` - React app entry point
- `types.ts` - Shared TypeScript interfaces and enums
- `index.html` - HTML entry point
- `vite.config.ts` - Vite configuration with path aliases and env setup
- `tsconfig.json` - TypeScript compiler configuration

## Folder Organization

### `/components`
React UI components for specific features:
- `VideoPlayer.tsx` - Video upload, playback controls, frame capture, live skeleton overlay
- `AnalysisDashboard.tsx` - Results display with step-by-step breakdown and joint angles

### `/services`
Business logic and external integrations:
- `geminiService.ts` - Google Gemini API integration for movement analysis
- `poseDetectionService.ts` - MediaPipe pose detection and ball tracking

### `/data`
Static reference data:
- `fundamentalMovementSkillsData.ts` - FMS checklist and proficiency rubrics (placeholder)
- `syllabusData.ts` - MOE PE Syllabus content

### `/utils`
Helper functions:
- `fileUtils.ts` - Video frame capture utilities

### `/.kiro`
Kiro IDE configuration:
- `/steering` - AI assistant guidance documents

## Architecture Patterns

### State Management
- React useState for local component state
- Props drilling for parent-child communication
- LocalStorage for persistence (analysis history)

### Service Layer
- Singleton pattern for pose detection service
- Lazy initialization of MediaPipe models
- Separate IMAGE and VIDEO mode landmarkers

### Data Flow
1. User uploads video → VideoPlayer
2. User scrubs to key frame → Capture
3. Frame sent to poseDetectionService (local, fast)
4. Frame + pose data sent to geminiService (cloud AI)
5. Structured response displayed in AnalysisDashboard
6. Result saved to history with thumbnail

### Styling
- Utility-first CSS with Tailwind classes
- Dark theme (slate color palette)
- Responsive grid layouts (xl:grid-cols-12)
- Gradient accents for CTAs

## Naming Conventions

- Components: PascalCase (e.g., `VideoPlayer.tsx`)
- Services: camelCase with 'Service' suffix (e.g., `geminiService.ts`)
- Types/Interfaces: PascalCase (e.g., `AnalysisResponse`)
- Enums: PascalCase with SCREAMING_SNAKE_CASE values
- Constants: SCREAMING_SNAKE_CASE (e.g., `MODEL_NAME`)
