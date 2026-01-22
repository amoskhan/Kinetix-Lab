import { FrameSnapshot } from '../types/snapshot.types';

export const downloadSnapshot = (snapshot: FrameSnapshot, index: number) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = new Image();
  img.onload = () => {
    const infoHeight = 200;
    canvas.width = img.width;
    canvas.height = img.height + infoHeight;

    // Draw video frame with skeleton
    ctx.drawImage(img, 0, 0);

    // Draw info panel background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, img.height, canvas.width, infoHeight);

    // Draw title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('KinetixLab Analysis', 20, img.height + 40);

    // Draw timestamp
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Arial';
    ctx.fillText(`Time: ${snapshot.timestamp.toFixed(2)}s`, 20, img.height + 70);

    // Draw joint angles
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('Joint Angles:', 20, img.height + 105);

    let yOffset = 130;
    const columnWidth = canvas.width / 3;
    
    snapshot.angles.forEach((angle, idx) => {
      const column = idx % 3;
      const row = Math.floor(idx / 3);
      const x = 20 + (column * columnWidth);
      const y = img.height + yOffset + (row * 30);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Arial';
      ctx.fillText(angle.joint, x, y);

      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`${Math.round(angle.angle)}°`, x + 120, y);
    });

    // Download
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kinetixlab-frame-${index + 1}-${snapshot.timestamp.toFixed(2)}s.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  };
  img.src = snapshot.frameImage;
};

export const downloadAllSnapshots = (snapshots: FrameSnapshot[]) => {
  snapshots.forEach((snapshot, index) => {
    setTimeout(() => {
      downloadSnapshot(snapshot, index);
    }, index * 500);
  });
};
