
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
    // We calculate angles for all joints MediaPipe has detected, regardless of visibility.
    // The skeleton is already drawn without visibility gates, so the HUD should match.
    // We only check that the landmark index exists (not undefined).
    const exists = (l: Landmark) => l !== undefined && l !== null;

    const angles: { joint: string; angle: number }[] = [];

    // --- UPPER BODY ---

    // Left Shoulder (Hip -> Shoulder -> Elbow)
    if (exists(landmarks[23]) && exists(landmarks[11]) && exists(landmarks[13])) {
        angles.push({ joint: 'Left Shoulder', angle: Math.round(calculateAngle(landmarks[23], landmarks[11], landmarks[13])) });
    }
    // Right Shoulder (Hip -> Shoulder -> Elbow)
    if (exists(landmarks[24]) && exists(landmarks[12]) && exists(landmarks[14])) {
        angles.push({ joint: 'Right Shoulder', angle: Math.round(calculateAngle(landmarks[24], landmarks[12], landmarks[14])) });
    }

    // Left Elbow (Shoulder -> Elbow -> Wrist)
    if (exists(landmarks[11]) && exists(landmarks[13]) && exists(landmarks[15])) {
        angles.push({ joint: 'Left Elbow', angle: Math.round(calculateAngle(landmarks[11], landmarks[13], landmarks[15])) });
    }
    // Right Elbow (Shoulder -> Elbow -> Wrist)
    if (exists(landmarks[12]) && exists(landmarks[14]) && exists(landmarks[16])) {
        angles.push({ joint: 'Right Elbow', angle: Math.round(calculateAngle(landmarks[12], landmarks[14], landmarks[16])) });
    }

    // Left Wrist (Elbow -> Wrist -> Index)
    if (exists(landmarks[13]) && exists(landmarks[15]) && exists(landmarks[19])) {
        angles.push({ joint: 'Left Wrist', angle: Math.round(calculateAngle(landmarks[13], landmarks[15], landmarks[19])) });
    }
    // Right Wrist (Elbow -> Wrist -> Index)
    if (exists(landmarks[14]) && exists(landmarks[16]) && exists(landmarks[20])) {
        angles.push({ joint: 'Right Wrist', angle: Math.round(calculateAngle(landmarks[14], landmarks[16], landmarks[20])) });
    }

    // --- LOWER BODY ---

    // Left Hip (Shoulder -> Hip -> Knee)
    if (exists(landmarks[11]) && exists(landmarks[23]) && exists(landmarks[25])) {
        angles.push({ joint: 'Left Hip', angle: Math.round(calculateAngle(landmarks[11], landmarks[23], landmarks[25])) });
    }
    // Right Hip (Shoulder -> Hip -> Knee)
    if (exists(landmarks[12]) && exists(landmarks[24]) && exists(landmarks[26])) {
        angles.push({ joint: 'Right Hip', angle: Math.round(calculateAngle(landmarks[12], landmarks[24], landmarks[26])) });
    }

    // Left Knee (Hip -> Knee -> Ankle)
    if (exists(landmarks[23]) && exists(landmarks[25]) && exists(landmarks[27])) {
        angles.push({ joint: 'Left Knee', angle: Math.round(calculateAngle(landmarks[23], landmarks[25], landmarks[27])) });
    }
    // Right Knee (Hip -> Knee -> Ankle)
    if (exists(landmarks[24]) && exists(landmarks[26]) && exists(landmarks[28])) {
        angles.push({ joint: 'Right Knee', angle: Math.round(calculateAngle(landmarks[24], landmarks[26], landmarks[28])) });
    }

    // Left Ankle (Knee -> Ankle -> Foot Index)
    if (exists(landmarks[25]) && exists(landmarks[27]) && exists(landmarks[31])) {
        angles.push({ joint: 'Left Ankle', angle: Math.round(calculateAngle(landmarks[25], landmarks[27], landmarks[31])) });
    }
    // Right Ankle (Knee -> Ankle -> Foot Index)
    if (exists(landmarks[26]) && exists(landmarks[28]) && exists(landmarks[32])) {
        angles.push({ joint: 'Right Ankle', angle: Math.round(calculateAngle(landmarks[26], landmarks[28], landmarks[32])) });
    }

    return angles;
};

// 4. Format for Gemini Prompt Injection
export const formatTelemetryForPrompt = (angles: { joint: string; angle: number }[], symmetry: any) => {
    let telemetryString = `\n--- LIVE BIOMECHANICS TELEMETRY ---\n`;

    telemetryString += `- Symmetry: Shoulders are ${symmetry.shouldersLevel ? 'LEVEL' : 'TILTED'}. Hips are ${symmetry.hipsLevel ? 'LEVEL' : 'TILTED'}.\n`;
    telemetryString += `- Tilted Angles: Shoulder Tilt ~${(symmetry.shoulderTiltRaw * 100).toFixed(1)}%, Hip Tilt ~${(symmetry.hipTiltRaw * 100).toFixed(1)}%\n`;

    telemetryString += `- Joint Angles (Degrees):\n`;

    // Group by Joint Type for cleaner reading
    const joints = ['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee', 'Ankle'];
    joints.forEach(joint => {
        const left = angles.find(a => a.joint === `Left ${joint}`)?.angle;
        const right = angles.find(a => a.joint === `Right ${joint}`)?.angle;

        if (left !== undefined || right !== undefined) {
            telemetryString += `  * ${joint}: L=${left ?? 'N/A'}° | R=${right ?? 'N/A'}°\n`;
        }
    });

    telemetryString += `\nUse this exact mathematical data to verify the posture in the image. Do not guess joint angles visually if they are provided here.`;

    return telemetryString;
};

// 5. Draw Joint Angles Data HUD (Overlay)
export const drawJointAngleStats = (
    ctx: CanvasRenderingContext2D,
    angles: { joint: string; angle: number }[],
    canvasWidth: number,
    canvasHeight: number
) => {
    // Configuration
    const boxWidth = 260; // Wider to accommodate 3 columns (Label, L, R)
    const padding = 15;
    const lineHeight = 24;
    const headerHeight = 35;

    // Define the grid rows we want to show
    const rows = ['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee', 'Ankle'];

    // Prepare data grid
    const gridData = rows.map(joint => ({
        label: joint,
        left: angles.find(a => a.joint === `Left ${joint}`)?.angle ?? null,
        right: angles.find(a => a.joint === `Right ${joint}`)?.angle ?? null
    }));

    const contentHeight = (gridData.length * lineHeight) + padding;
    const boxHeight = headerHeight + contentHeight;

    // Position: Top-Right corner with margin
    const margin = 20;
    const x = canvasWidth - boxWidth - margin;
    const y = margin;

    // 1. Draw Glassmorphism Background
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // Slate-900 with opacity
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'; // Slate-400 border
    ctx.lineWidth = 1;

    // Rounded Rect
    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, boxHeight, 12);
    ctx.fill();
    ctx.stroke();

    // 2. Draw Header Area
    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, headerHeight, [12, 12, 0, 0]);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.8)'; // Slightly lighter header
    ctx.fill();

    // Header Text
    ctx.fillStyle = '#e2e8f0'; // Slate-200
    ctx.font = 'bold 15px "Inter", sans-serif'; // Use Inter if available, fallback system
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Biomechanics Data', x + padding, y + (headerHeight / 2));

    // Live Indicator (Green Dot)
    ctx.beginPath();
    ctx.arc(x + boxWidth - padding - 5, y + (headerHeight / 2), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e'; // Green-500
    ctx.fill();

    // 3. Draw Column Headers
    const col1X = x + padding; // Label
    const col2X = x + boxWidth - 100; // Left
    const col3X = x + boxWidth - 40; // Right

    const startY = y + headerHeight + 15;

    // Subtle Column Labels (L / R)
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#94a3b8'; // Slate-400
    ctx.textAlign = 'right';
    ctx.fillText("L(°)", col2X + 10, y + headerHeight - 8); // In header area actually? No, maybe subheader
    ctx.fillText("R(°)", col3X + 10, y + headerHeight - 8);

    // 4. Draw Rows
    ctx.font = '14px monospace';

    gridData.forEach((row, i) => {
        const rowY = startY + (i * lineHeight);

        // Joint Label
        ctx.textAlign = 'left';
        ctx.fillStyle = '#cbd5e1'; // Slate-300
        ctx.fillText(row.label, col1X, rowY);

        // Left Value
        ctx.textAlign = 'right';
        if (row.left !== null) {
            ctx.fillStyle = '#38bdf8'; // Sky-400 for Left
            ctx.fillText(row.left.toString(), col2X + 10, rowY);
        } else {
            ctx.fillStyle = '#475569'; // Slate-600 dimmed
            ctx.fillText("--", col2X + 10, rowY);
        }

        // Right Value
        if (row.right !== null) {
            ctx.fillStyle = '#f472b6'; // Pink-400 for Right
            ctx.fillText(row.right.toString(), col3X + 10, rowY);
        } else {
            ctx.fillStyle = '#475569'; // Slate-600 dimmed
            ctx.fillText("--", col3X + 10, rowY);
        }
    });

    ctx.restore();
};
