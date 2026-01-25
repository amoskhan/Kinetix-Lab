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
}

export interface AnalysisResponse {
  feedback: BiomechanicalFeedback;
}
