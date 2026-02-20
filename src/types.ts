export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface JointAngle {
  jointName: string;
  measuredAngle: number;
  idealAngleRange: string; // e.g., "160-180"
  status: 'Good' | 'Needs Improvement' | 'Critical';
}

export interface BiomechanicalFeedback {
  movementName: string;
  confidence: number;
  phaseDetected: string; // e.g., "Hold Phase", "Ascent"

  // Step-by-step breakdown
  steps: {
    stepName: string;
    status: 'Correct' | 'Incorrect' | 'Needs Improvement';
    observation: string;
    correction: string;
  }[];

  jointAngles: JointAngle[];
  observations: string[];
  corrections: string[];
  safetyRating: number; // 1-10
  frames?: { label: string; images: string[] }[];
}

export interface AnalysisResponse {
  feedback: BiomechanicalFeedback;
  user_prompt?: string; // Captured user input for storage
}

export interface AnalysisRecord {
  id?: string;
  created_at?: string;
  movement_name: string;
  confidence: number;
  analysis_data: AnalysisResponse; // Use strict type 
  video_url?: string;
}

export interface HistoryItem extends AnalysisRecord {
  thumbnail?: string;
}

export type ViewMode = 'setup' | 'single' | 'dual';
