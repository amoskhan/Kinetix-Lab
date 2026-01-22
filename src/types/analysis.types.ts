export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface JointAngle {
  jointName: string;
  measuredAngle: number;
  idealAngleRange: string;
  status: 'Good' | 'Needs Improvement' | 'Critical';
}

export interface BiomechanicalFeedback {
  movementName: string;
  confidence: number;
  phaseDetected: string;

  steps: {
    stepName: string;
    status: 'Correct' | 'Incorrect' | 'Needs Improvement';
    observation: string;
    correction: string;
  }[];

  jointAngles: JointAngle[];
  observations: string[];
  corrections: string[];
  safetyRating: number;
}

export interface AnalysisResponse {
  feedback: BiomechanicalFeedback;
}

export interface HistoryItem {
  id: string;
  thumbnail: string;
  timestamp: string;
  result: AnalysisResponse;
}
