import { PoseData } from '../services/vision/poseDetectionService';

export interface FrameSnapshot {
  frameImage: string;
  timestamp: number;
  pose: PoseData | null;
  angles: { joint: string; angle: number }[];
}

export interface MultiFrameCapture {
  frames: string[];
  timestamps: number[];
  centerFrameIndex: number;
}
