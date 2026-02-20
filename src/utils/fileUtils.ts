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
  intervalSeconds: number = 0.5,
  onFrame?: (ctx: CanvasRenderingContext2D, time: number) => Promise<void>
): Promise<MultiFrameCapture> => {
  const frames: string[] = [];
  const timestamps: number[] = [];
  const originalTime = videoElement.currentTime;

  // Calculate frame times (before, current, after)
  const halfFrames = Math.floor(frameCount / 2);
  const frameTimes: number[] = [];

  // The original loop `for (let i = -halfFrames; i <= halfFrames; i++)`
  // captures `2 * halfFrames + 1` frames.
  // If frameCount is odd, `2 * (frameCount - 1)/2 + 1 = frameCount`. Correct.
  // If frameCount is even, `2 * (frameCount / 2) + 1 = frameCount + 1`. Incorrect, it captures one extra frame.
  // To ensure exactly `frameCount` frames, we adjust the loop range.
  // We want `frameCount` iterations.
  // If frameCount is 3, halfFrames is 1. We want i = -1, 0, 1. (3 iterations)
  // If frameCount is 4, halfFrames is 2. We want 4 iterations.
  //   e.g., i = -1, 0, 1, 2 (if we want to bias slightly after center)
  //   or i = -2, -1, 0, 1 (if we want to bias slightly before center)
  // Let's keep the centering as much as possible, so for even frameCount,
  // we can go from `-halfFrames` to `halfFrames - 1`.
  // This gives `(halfFrames - 1) - (-halfFrames) + 1 = 2 * halfFrames` iterations.
  // If frameCount is 4, halfFrames is 2. Loop from -2 to 1. Iterations: -2, -1, 0, 1 (4 iterations). Correct.
  // If frameCount is 3, halfFrames is 1. Loop from -1 to 0. Iterations: -1, 0 (2 iterations). Incorrect.

  // A more robust way to get `frameCount` iterations centered around 0:
  // Start index: `-(Math.floor((frameCount - 1) / 2))`
  // End index: `Math.floor(frameCount / 2)`
  const startIndex = -Math.floor((frameCount - 1) / 2);
  const endIndex = Math.floor(frameCount / 2);

  for (let i = startIndex; i <= endIndex; i++) {
    const time = Math.max(0, Math.min(videoElement.duration, centerTime + (i * intervalSeconds)));
    frameTimes.push(time);
  }

  console.log(`📸 Capture Request: Center=${centerTime.toFixed(2)}s, Count=${frameCount}, Interval=${intervalSeconds}s`);

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

    if (onFrame) {
      // Create a temporary canvas for this frame to allow drawing
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        await onFrame(ctx, time);
        frames.push(canvas.toDataURL('image/jpeg', 0.8));
        timestamps.push(time);
      }
    } else {
      // Standard capture
      const frame = captureVideoFrame(videoElement);
      if (frame) {
        frames.push(frame);
        timestamps.push(time);
      }
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
