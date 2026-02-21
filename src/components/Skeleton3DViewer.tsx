import React, { useMemo, useState, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Line } from '@react-three/drei';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

// MediaPipe POSE_CONNECTIONS — same as used in poseDetectionService
const POSE_CONNECTIONS: [number, number][] = [
    // Face
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    // Upper torso
    [9, 10],
    [11, 12],
    [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
    // Lower torso
    [11, 23], [12, 24], [23, 24],
    // Legs
    [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
    [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
];

// Color coding: Left (odd indices) = Cyan, Right (even indices) = Orange, Center = White
const BONE_COLORS: Record<string, string> = {
    left: '#00FFFF',
    right: '#FFA500',
    center: '#FFFFFF',
};

const JOINT_COLORS: Record<string, string> = {
    left: '#00E5FF',
    right: '#FF8C00',
    center: '#CCCCCC',
};

function getBoneColor(startIdx: number, endIdx: number): string {
    const isLeft = startIdx % 2 !== 0 && endIdx % 2 !== 0;
    const isRight = startIdx % 2 === 0 && endIdx % 2 === 0;
    if (isLeft) return BONE_COLORS.left;
    if (isRight) return BONE_COLORS.right;
    return BONE_COLORS.center;
}

function getJointColor(idx: number): string {
    if (idx % 2 !== 0) return JOINT_COLORS.left;
    if (idx !== 0) return JOINT_COLORS.right; // idx 0 is nose (center)
    return JOINT_COLORS.center;
}

// Convert MediaPipe world landmark to Three.js coords (without vertical offset)
// MediaPipe world: Y is positive downward (gravity). We flip so Y is up in Three.js.
function landmarkToVec3(lm: NormalizedLandmark, yOffset = 0): [number, number, number] {
    return [lm.x * 2, -lm.y * 2 + yOffset, -lm.z * 2];
}

const GRID_Y = -1.8; // Where the floor grid sits
const FLOOR_MARGIN = 0.08; // Small gap between lowest joint and the grid

interface SkeletonBonesProps {
    worldLandmarks: NormalizedLandmark[];
}

function SkeletonBones({ worldLandmarks }: SkeletonBonesProps) {
    // Compute vertical offset so the lowest visible landmark sits just above the grid
    const yOffset = useMemo(() => {
        const visibleYs = worldLandmarks
            .filter(lm => (lm.visibility ?? 1) > 0.3)
            .map(lm => -lm.y * 2); // Three.js Y values (before offset)
        if (visibleYs.length === 0) return 0;
        const lowestY = Math.min(...visibleYs); // most negative = lowest joint
        // Shift the whole skeleton up so lowestY lands at GRID_Y + FLOOR_MARGIN
        return (GRID_Y + FLOOR_MARGIN) - lowestY;
    }, [worldLandmarks]);

    return (
        <>
            {POSE_CONNECTIONS.map(([startIdx, endIdx], i) => {
                const start = worldLandmarks[startIdx];
                const end = worldLandmarks[endIdx];
                if (!start || !end) return null;

                const startVis = start.visibility ?? 1;
                const endVis = end.visibility ?? 1;
                if (startVis < 0.3 || endVis < 0.3) return null;

                const color = getBoneColor(startIdx, endIdx);
                const points: [number, number, number][] = [
                    landmarkToVec3(start, yOffset),
                    landmarkToVec3(end, yOffset),
                ];

                return (
                    <Line
                        key={i}
                        points={points}
                        color={color}
                        lineWidth={2.5}
                        opacity={Math.min(startVis, endVis)}
                        transparent
                    />
                );
            })}

            {/* Joint dots */}
            {worldLandmarks.map((lm, i) => {
                const vis = lm.visibility ?? 1;
                if (vis < 0.3) return null;
                // Skip face landmarks (0-10) for cleaner look except nose (0)
                if (i > 0 && i < 11) return null;

                const pos = landmarkToVec3(lm, yOffset);
                const color = getJointColor(i);
                const isKeyJoint = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(i);

                return (
                    <mesh key={i} position={pos}>
                        <sphereGeometry args={[isKeyJoint ? 0.04 : 0.025, 8, 8]} />
                        <meshStandardMaterial
                            color={color}
                            emissive={color}
                            emissiveIntensity={0.6}
                            transparent
                            opacity={vis}
                        />
                    </mesh>
                );
            })}
        </>
    );
}

interface Skeleton3DViewerProps {
    worldLandmarks: NormalizedLandmark[] | null | undefined;
}

export default function Skeleton3DViewer({ worldLandmarks }: Skeleton3DViewerProps) {
    console.log("Rendering Skeleton3DViewer", !!worldLandmarks);
    const hasPose = worldLandmarks && worldLandmarks.length > 0;

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const renderChunksRef = useRef<Blob[]>([]);

    const handleCanvasCreated = useCallback((state: any) => {
        const canvas = state.gl.domElement;

        // Try mp4 first, then webm
        let mimeType = 'video/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
        }

        try {
            const stream = canvas.captureStream(30); // 30 FPS
            const options = { mimeType };
            const mediaRecorder = new MediaRecorder(stream, options);

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    renderChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(renderChunksRef.current, { type: mimeType });
                renderChunksRef.current = [];
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const ext = mimeType === 'video/mp4' ? 'mp4' : 'webm';
                a.download = `kinetix-3d-skeleton.${ext}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            };

            mediaRecorderRef.current = mediaRecorder;
        } catch (error) {
            console.error("Error setting up MediaRecorder for 3D Canvas:", error);
        }
    }, []);

    const toggleRecording = useCallback(() => {
        if (!mediaRecorderRef.current) return;

        if (isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        } else {
            renderChunksRef.current = []; // Clear previous
            mediaRecorderRef.current.start(100); // Collect data every 100ms
            setIsRecording(true);
        }
    }, [isRecording]);

    return (
        <div className="relative w-full h-56 sm:h-64 bg-slate-900 rounded-xl border border-slate-700 overflow-hidden group">
            {/* Label */}
            <div className="absolute top-2 left-3 z-10 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">3D Skeleton</span>
            </div>

            {/* Color legend & Record Button */}
            <div className="absolute top-2 right-3 z-10 flex items-center gap-3">
                <div className="flex items-center gap-3 text-[9px] font-mono text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />Left</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Right</span>
                </div>

                {/* Record Button */}
                <button
                    onClick={toggleRecording}
                    className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${isRecording ? 'bg-red-500/20 animate-pulse' : 'bg-slate-800 hover:bg-slate-700'
                        }`}
                    title={isRecording ? "Stop Recording 3D Viewer" : "Record 3D Viewer"}
                >
                    <div className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-red-500 rounded-sm' : 'bg-red-500'}`} />
                </button>
            </div>

            {!hasPose && (
                <div className="absolute inset-0 flex items-center justify-center z-10 text-slate-600 text-xs font-mono">
                    No pose detected — play video to see 3D skeleton
                </div>
            )}

            <Canvas
                onCreated={handleCanvasCreated}
                camera={{ position: [0, 1.2, 5], fov: 45 }}
                style={{ background: 'transparent' }}
                gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
            >
                {/* Lighting */}
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 5, 5]} intensity={0.8} />
                <pointLight position={[-3, 3, -3]} intensity={0.4} color="#4488ff" />

                {/* Floor grid */}
                <Grid
                    position={[0, GRID_Y, 0]}
                    args={[8, 8]}
                    cellSize={0.5}
                    cellThickness={0.5}
                    cellColor="#1e3a5f"
                    sectionSize={2}
                    sectionThickness={1}
                    sectionColor="#2563eb"
                    fadeDistance={10}
                    fadeStrength={1}
                    followCamera={false}
                    infiniteGrid={false}
                />

                {/* 3D Skeleton */}
                {hasPose && <SkeletonBones worldLandmarks={worldLandmarks} />}

                {/* Orbit controls — auto-rotate when idle */}
                <OrbitControls
                    autoRotate
                    autoRotateSpeed={1.2}
                    enablePan={false}
                    minDistance={2}
                    maxDistance={8}
                    target={[0, 0, 0]}
                />
            </Canvas>
        </div>
    );
}

