export const captureVideoFrame = (videoElement: HTMLVideoElement): string | null => {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  // Get base64 string
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  return dataUrl;
};

export interface MultiFrameCapture {
  frames: string[];
  timestamps: number[];
  centerFrameIndex: number;
}

export const captureMultipleFrames = async (
  videoElement: HTMLVideoElement,
  centerTime: number,
  frameCount: number = 3,
  intervalSeconds: number = 0.5
): Promise<MultiFrameCapture> => {
  const frames: string[] = [];
  const timestamps: number[] = [];
  const originalTime = videoElement.currentTime;
  
  // Calculate frame times (before, current, after)
  const halfFrames = Math.floor(frameCount / 2);
  const frameTimes: number[] = [];
  
  for (let i = -halfFrames; i <= halfFrames; i++) {
    const time = Math.max(0, Math.min(videoElement.duration, centerTime + (i * intervalSeconds)));
    frameTimes.push(time);
  }
  
  // Capture each frame
  for (const time of frameTimes) {
    videoElement.currentTime = time;
    
    // Wait for seek to complete
    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        videoElement.removeEventListener('seeked', onSeeked);
        resolve();
      };
      videoElement.addEventListener('seeked', onSeeked);
    });
    
    const frame = captureVideoFrame(videoElement);
    if (frame) {
      frames.push(frame);
      timestamps.push(time);
    }
  }
  
  // Restore original time
  videoElement.currentTime = originalTime;
  
  return {
    frames,
    timestamps,
    centerFrameIndex: halfFrames
  };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
