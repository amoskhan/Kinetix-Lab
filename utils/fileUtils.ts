export const captureVideoFrame = (videoElement: HTMLVideoElement): string | null => {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return null;
  
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  
  // Get base64 string (remove data prefix for API)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  return dataUrl.split(',')[1];
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
