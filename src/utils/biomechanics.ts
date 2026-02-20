
export type Landmark = { x: number; y: number; z?: number; visibility?: number };

// Helper to calculate 2D angle between 3 points
export const calculateAngle = (a: Landmark, b: Landmark, c: Landmark): number => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    return angle > 180.0 ? 360 - angle : angle;
};

// 1. Calculate Center of Mass (CoM)
export const getCenterOfMass = (landmarks: Landmark[]) => {
    const ls = landmarks[11]; // Left Shoulder
    const rs = landmarks[12]; // Right Shoulder
    const lh = landmarks[23]; // Left Hip
    const rh = landmarks[24]; // Right Hip

    if (!ls || !rs || !lh || !rh) return null;

    return {
        x: (ls.x + rs.x + lh.x + rh.x) / 4,
        y: (ls.y + rs.y + lh.y + rh.y) / 4,
    };
};

// 2. Analyze Symmetry (Shoulders & Hips)
export const analyzeSymmetry = (landmarks: Landmark[]) => {
    const ls = landmarks[11];
    const rs = landmarks[12];
    const lh = landmarks[23];
    const rh = landmarks[24];

    // A difference in Y coordinate indicates a tilt. 
    // threshold of 0.05 (5% of screen height) is a good starting point.
    const shoulderTilt = Math.abs(ls.y - rs.y);
    const hipTilt = Math.abs(lh.y - rh.y);

    return {
        shouldersLevel: shoulderTilt < 0.05,
        hipsLevel: hipTilt < 0.05,
        shoulderTiltRaw: shoulderTilt,
        hipTiltRaw: hipTilt
    };
};

// 3. Calculate All Major Joint Angles
export const calculateAllJointAngles = (landmarks: Landmark[]): { joint: string; angle: number }[] => {
    // Check visibility threshold first
    const isVisible = (l: Landmark) => l && l.visibility !== undefined && l.visibility > 0.5;

    const angles: { joint: string; angle: number }[] = [];

    // Left Elbow (Shoulder -> Elbow -> Wrist)
    if (isVisible(landmarks[11]) && isVisible(landmarks[13]) && isVisible(landmarks[15])) {
        angles.push({ joint: 'Left Elbow', angle: Math.round(calculateAngle(landmarks[11], landmarks[13], landmarks[15])) });
    }
    // Right Elbow (Shoulder -> Elbow -> Wrist)
    if (isVisible(landmarks[12]) && isVisible(landmarks[14]) && isVisible(landmarks[16])) {
        angles.push({ joint: 'Right Elbow', angle: Math.round(calculateAngle(landmarks[12], landmarks[14], landmarks[16])) });
    }

    // Left Knee (Hip -> Knee -> Ankle)
    if (isVisible(landmarks[23]) && isVisible(landmarks[25]) && isVisible(landmarks[27])) {
        angles.push({ joint: 'Left Knee', angle: Math.round(calculateAngle(landmarks[23], landmarks[25], landmarks[27])) });
    }
    // Right Knee (Hip -> Knee -> Ankle)
    if (isVisible(landmarks[24]) && isVisible(landmarks[26]) && isVisible(landmarks[28])) {
        angles.push({ joint: 'Right Knee', angle: Math.round(calculateAngle(landmarks[24], landmarks[26], landmarks[28])) });
    }

    // Right Hip (Shoulder -> Hip -> Knee)
    if (isVisible(landmarks[12]) && isVisible(landmarks[24]) && isVisible(landmarks[26])) {
        angles.push({ joint: 'Right Hip', angle: Math.round(calculateAngle(landmarks[12], landmarks[24], landmarks[26])) });
    }

    // Left Hip (Shoulder -> Hip -> Knee)
    if (isVisible(landmarks[11]) && isVisible(landmarks[23]) && isVisible(landmarks[25])) {
        angles.push({ joint: 'Left Hip', angle: Math.round(calculateAngle(landmarks[11], landmarks[23], landmarks[25])) });
    }

    // Left Shoulder (Hip -> Shoulder -> Elbow)
    if (isVisible(landmarks[23]) && isVisible(landmarks[11]) && isVisible(landmarks[13])) {
        angles.push({ joint: 'Left Shoulder', angle: Math.round(calculateAngle(landmarks[23], landmarks[11], landmarks[13])) });
    }

    // Right Shoulder (Hip -> Shoulder -> Elbow)
    if (isVisible(landmarks[24]) && isVisible(landmarks[12]) && isVisible(landmarks[14])) {
        angles.push({ joint: 'Right Shoulder', angle: Math.round(calculateAngle(landmarks[24], landmarks[12], landmarks[14])) });
    }

    return angles;
};

// 4. Format for Gemini Prompt Injection
export const formatTelemetryForPrompt = (angles: { joint: string; angle: number }[], symmetry: any) => {
    let telemetryString = `\n--- LIVE BIOMECHANICS TELEMETRY ---\n`;

    telemetryString += `- Symmetry: Shoulders are ${symmetry.shouldersLevel ? 'LEVEL' : 'TILTED'}. Hips are ${symmetry.hipsLevel ? 'LEVEL' : 'TILTED'}.\n`;

    telemetryString += `- Joint Angles: \n`;
    angles.forEach(({ joint, angle }) => {
        telemetryString += `  * ${joint}: ${angle}°\n`;
    });

    telemetryString += `\nUse this exact mathematical data to verify the posture in the image. Do not guess joint angles visually if they are provided here.`;

    return telemetryString;
};

// 5. Draw Joint Angles Data Box (Overlay)
export const drawJointAngleStats = (
    ctx: CanvasRenderingContext2D,
    angles: { joint: string; angle: number }[],
    canvasWidth: number,
    canvasHeight: number
) => {
    // Configuration
    const boxWidth = 220;
    const padding = 15;
    const lineHeight = 24;
    const headerHeight = 30;

    // Filter for key joints we want to show
    const keyJoints = ['Elbow', 'Knee', 'Shoulder'];
    const displayData: { label: string; left: number | null; right: number | null }[] = keyJoints.map(joint => {
        const left = angles.find(a => a.joint === `Left ${joint}`)?.angle ?? null;
        const right = angles.find(a => a.joint === `Right ${joint}`)?.angle ?? null;
        return { label: joint, left, right };
    }).filter(d => d.left !== null || d.right !== null);

    const boxHeight = headerHeight + (displayData.length * lineHeight) + padding;

    // Position: Top-Right corner with margin
    const margin = 20;
    const x = canvasWidth - boxWidth - margin;
    const y = margin;

    // Draw Box Background (Dark Blue/Slate with opacity)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; // Slate-900 with 0.9 opacity
    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, boxHeight, 12); // Rounded corners
    ctx.fill();
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)'; // Slate-700 border
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw Header
    ctx.fillStyle = '#e2e8f0'; // Slate-200
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Analysis Data', x + padding, y + padding + 8);

    // Draw Icon (Simple line representing chart)
    ctx.strokeStyle = '#3b82f6'; // Blue-500
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + padding - 2, y + padding + 8);
    ctx.lineTo(x + padding - 2 + 5, y + padding + 8 - 5);
    ctx.lineTo(x + padding - 2 + 10, y + padding + 8 + 2);
    ctx.lineTo(x + padding - 2 + 15, y + padding + 8 - 8);
    ctx.stroke();

    // Draw Data Grid
    let currentY = y + headerHeight + padding;

    ctx.font = '14px monospace'; // Monospace for alignment

    displayData.forEach(item => {
        // Label (e.g., "Elbow")
        ctx.fillStyle = '#94a3b8'; // Slate-400
        ctx.textAlign = 'center';
        ctx.fillText(item.label, x + (boxWidth / 2), currentY);

        // Left Value
        if (item.left !== null) {
            ctx.fillStyle = '#4ade80'; // Green-400
            ctx.textAlign = 'left';
            ctx.fillText(`L: ${item.left}°`, x + padding, currentY);
        }

        // Right Value
        if (item.right !== null) {
            ctx.fillStyle = '#4ade80'; // Green-400
            ctx.textAlign = 'right';
            ctx.fillText(`R: ${item.right}°`, x + boxWidth - padding, currentY);
        }

        currentY += lineHeight;
    });
};
