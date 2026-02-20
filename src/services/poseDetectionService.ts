import { PoseLandmarker, FilesetResolver, type NormalizedLandmark, ObjectDetector, type Detection } from '@mediapipe/tasks-vision';

export interface PoseData {
    landmarks: NormalizedLandmark[];
    worldLandmarks: NormalizedLandmark[];
    timestamp?: number;
    ball?: BallData;
}

export interface MovementAnalysis {
    detectedSkill?: string;
    keyAngles: { joint: string; angle: number }[];
    poseSummary: string;
    ballAnalysis?: {
        trajectory: { x: number; y: number; frame: number }[];
        releaseFrame?: number;
        releaseHeightInfo?: string; // e.g., "Above Waist, Below Shoulder"
    };
}

export interface BallData {
    center: { x: number; y: number };
    centerNormalized?: { x: number; y: number }; // Normalized (0-1) coordinates for AI analysis
    box: { originX: number; originY: number; width: number; height: number };
    isValid?: boolean; // True if it passes smart filters (proximity/movement)
    status?: string;   // Reason for validity (e.g., "Proximity Match", "Static Ignored", "Too Far")
}

class PoseDetectionService {
    private imageLandmarker: PoseLandmarker | null = null;
    private videoLandmarker: PoseLandmarker | null = null;
    private objectDetector: ObjectDetector | null = null;
    private initPromiseImage: Promise<void> | null = null;
    private initPromiseVideo: Promise<void> | null = null;
    private initPromiseObject: Promise<void> | null = null;

    // Helper to load vision tasks
    private async createVision() {
        return await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
    }

    // Helper to create options
    private createOptions(runningMode: 'IMAGE' | 'VIDEO') {
        return {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
                delegate: 'CPU' as const
            },
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            runningMode: runningMode
        };
    }

    async initializeImageMode() {
        if (this.initPromiseImage) return this.initPromiseImage;

        this.initPromiseImage = (async () => {
            console.log('📷 Initializing MediaPipe Pose Landmarker (IMAGE Mode)...');
            const vision = await this.createVision();
            this.imageLandmarker = await PoseLandmarker.createFromOptions(vision, this.createOptions('IMAGE'));
            console.log('✅ MediaPipe Pose Landmarker (IMAGE Mode) initialized');
        })();

        return this.initPromiseImage;
    }

    async initializeVideoMode() {
        if (this.initPromiseVideo) return this.initPromiseVideo;

        this.initPromiseVideo = (async () => {
            console.log('🎥 Initializing MediaPipe Pose Landmarker (VIDEO Mode)...');
            const vision = await this.createVision();
            this.videoLandmarker = await PoseLandmarker.createFromOptions(vision, this.createOptions('VIDEO'));
            console.log('✅ MediaPipe Pose Landmarker (VIDEO Mode) initialized');
        })();

        return this.initPromiseVideo;
    }

    async initializeObjectDetector() {
        if (this.initPromiseObject) return this.initPromiseObject;

        this.initPromiseObject = (async () => {
            console.log('⚽ Initializing MediaPipe Object Detector...');
            const vision = await this.createVision();
            this.objectDetector = await ObjectDetector.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/1/efficientdet_lite2.tflite',
                    delegate: 'CPU'
                },
                scoreThreshold: 0.15, // Lower threshold for better recall
                runningMode: 'IMAGE',
                // categoryAllowlist: ['sports ball'] // Removed to allow manual filtering of misclassifications
            });
            console.log('✅ MediaPipe Object Detector initialized');
        })();

        return this.initPromiseObject;
    }

    async detectPoseFromImage(imageElement: HTMLImageElement): Promise<PoseData | null> {
        if (!this.imageLandmarker) await this.initializeImageMode();

        try {
            // IMAGE mode doesn't need timestamp
            const result = this.imageLandmarker!.detect(imageElement);
            if (result.landmarks.length > 0) {
                return {
                    landmarks: result.landmarks[0] as NormalizedLandmark[],
                    worldLandmarks: result.worldLandmarks[0] as NormalizedLandmark[]
                };
            }
        } catch (error) {
            console.error('Pose detection error (Image):', error);
        }
        return null;
    }

    async detectPoseFrame(videoElement: HTMLVideoElement): Promise<PoseData | null> {
        if (!this.imageLandmarker) await this.initializeImageMode();

        try {
            // Treat video frame as an image (stateless detection)
            // This is more robust for playback loops or seeking than VIDEO mode
            const result = this.imageLandmarker!.detect(videoElement);
            if (result.landmarks.length > 0) {
                return {
                    landmarks: result.landmarks[0] as NormalizedLandmark[],
                    worldLandmarks: result.worldLandmarks[0] as NormalizedLandmark[]
                };
            }
        } catch (error) {
            console.warn('Pose detection warning (Frame/Image Mode):', error);
        }
        return null;
    }


    async detectPoseFromVideo(videoElement: HTMLVideoElement, timestamp: number): Promise<PoseData | null> {
        if (!this.videoLandmarker) await this.initializeVideoMode();

        try {
            const result = this.videoLandmarker!.detectForVideo(videoElement, timestamp);
            if (result.landmarks.length > 0) {
                return {
                    landmarks: result.landmarks[0] as NormalizedLandmark[],
                    worldLandmarks: result.worldLandmarks[0] as NormalizedLandmark[]
                };
            }
        } catch (error) {
            console.warn('Pose detection warning (Video):', error);
        }
        return null;
    }

    drawPose(ctx: CanvasRenderingContext2D, pose: PoseData) {
        const landmarks = pose.landmarks;
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        // Draw connections
        if (PoseLandmarker.POSE_CONNECTIONS) {
            for (const connection of PoseLandmarker.POSE_CONNECTIONS) {
                const startIdx = connection.start;
                const endIdx = connection.end;

                const startLandmark = landmarks[startIdx];
                const endLandmark = landmarks[endIdx];

                const x1 = startLandmark.x * width;
                const y1 = startLandmark.y * height;
                const x2 = endLandmark.x * width;
                const y2 = endLandmark.y * height;

                // Draw white outline/base (Thicker for better visibility)
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 8;
                ctx.stroke();

                // Draw colored inner line based on side (Left=Cyan, Right=Orange)
                // Left side indices are usually odd, Right side even (in MediaPipe Body)
                let color = '#FFFFFF';

                if (startIdx % 2 !== 0 && endIdx % 2 !== 0) {
                    color = '#00FFFF'; // Cyan
                } else if (startIdx % 2 === 0 && endIdx % 2 === 0) {
                    color = '#FFA500'; // Orange
                }

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = color;
                ctx.lineWidth = 4;
                ctx.stroke();
            }
        }

        // Draw Landmarks (Joints)
        for (let i = 0; i < landmarks.length; i++) {
            const landmark = landmarks[i];
            const x = landmark.x * width;
            const y = landmark.y * height;

            // Inner color
            let color = '#FFFFFF';
            if (i % 2 !== 0) color = '#00FFFF'; // Cyan
            else if (i % 2 === 0) color = '#FFA500'; // Orange

            // Draw circle
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();

            // White border
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'white';
            ctx.stroke();
        }
    }

    analyzePoseGeometry(pose: PoseData): MovementAnalysis {
        const landmarks = pose.landmarks;
        const worldLandmarks = pose.worldLandmarks;
        const angles = this.calculateJointAngles(landmarks);
        const summary = this.generatePoseSummary(landmarks, worldLandmarks);
        const detectedSkill = this.detectMovementType(landmarks, angles);
        return { detectedSkill, keyAngles: angles, poseSummary: summary };
    }

    detectMovementType(landmarks: NormalizedLandmark[], angles: { joint: string; angle: number }[]): string {
        // Extract key landmarks
        const rightShoulder = landmarks[11];
        const leftShoulder = landmarks[12];
        const rightElbow = landmarks[13];
        const leftElbow = landmarks[14];
        const rightWrist = landmarks[15];
        const leftWrist = landmarks[16];
        const rightHip = landmarks[23];
        const leftHip = landmarks[24];
        const rightKnee = landmarks[25];
        const leftKnee = landmarks[26];
        const rightAnkle = landmarks[27];
        const leftAnkle = landmarks[28];

        // Get angles
        const rightKneeAngle = angles.find(a => a.joint === 'Right Knee')?.angle || 180;
        const leftKneeAngle = angles.find(a => a.joint === 'Left Knee')?.angle || 180;
        const rightElbowAngle = angles.find(a => a.joint === 'Right Elbow')?.angle || 180;
        const leftElbowAngle = angles.find(a => a.joint === 'Left Elbow')?.angle || 180;
        const rightShoulderAngle = angles.find(a => a.joint === 'Right Shoulder')?.angle || 180;
        const leftShoulderAngle = angles.find(a => a.joint === 'Left Shoulder')?.angle || 180;

        // Calculate hip height (average of both hips)
        const hipY = (rightHip.y + leftHip.y) / 2;
        const kneeY = (rightKnee.y + leftKnee.y) / 2;
        const shoulderY = (rightShoulder.y + leftShoulder.y) / 2;

        // SQUAT DETECTION: Both knees bent, hips low
        if ((rightKneeAngle < 120 || leftKneeAngle < 120) && hipY > kneeY - 0.1) {
            return "Squat";
        }

        // OVERHAND THROW DETECTION: One arm raised above shoulder, elbow extended
        const rightArmRaised = rightWrist.y < rightShoulder.y - 0.1;
        const leftArmRaised = leftWrist.y < leftShoulder.y - 0.1;
        const armExtended = rightElbowAngle > 140 || leftElbowAngle > 140;

        if ((rightArmRaised || leftArmRaised) && armExtended) {
            return "Overhand Throw";
        }

        // UNDERHAND THROW DETECTION: Arm below hip, extended
        const rightArmLow = rightWrist.y > rightHip.y;
        const leftArmLow = leftWrist.y > leftHip.y;

        if ((rightArmLow || leftArmLow) && armExtended) {
            return "Underhand Throw";
        }

        // KICK DETECTION: One leg raised significantly, knee bent
        const rightLegRaised = rightKnee.y < rightHip.y - 0.15;
        const leftLegRaised = leftKnee.y < leftHip.y - 0.15;

        if (rightLegRaised || leftLegRaised) {
            return "Kick";
        }

        // CATCHING DETECTION: Both arms forward, elbows bent
        const armsForward = (rightElbow.y < shoulderY && leftElbow.y < shoulderY);
        const elbowsBent = (rightElbowAngle < 150 && leftElbowAngle < 150);

        if (armsForward && elbowsBent) {
            return "Catching";
        }

        // HANDSTAND DETECTION: Hips passed above shoulders (Inversion)
        // Note: In normalized coordinates, 0 is top. So Smaller Y = Higher up.
        if (hipY < shoulderY - 0.05) {
            return "Handstand";
        }

        // JUMPING DETECTION: Both knees bent, body elevated
        if ((rightKneeAngle < 140 && leftKneeAngle < 140) && hipY < 0.6) {
            return "Jump";
        }

        return "Unknown Movement";
    }

    private calculateJointAngles(landmarks: NormalizedLandmark[]) {
        const angles = [];

        // Right elbow
        const rightElbow = this.calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
        if (!isNaN(rightElbow)) angles.push({ joint: 'Right Elbow', angle: Math.round(rightElbow) });

        // Left elbow
        const leftElbow = this.calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
        if (!isNaN(leftElbow)) angles.push({ joint: 'Left Elbow', angle: Math.round(leftElbow) });

        // Right knee
        const rightKnee = this.calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
        if (!isNaN(rightKnee)) angles.push({ joint: 'Right Knee', angle: Math.round(rightKnee) });

        // Left knee
        const leftKnee = this.calculateAngle(landmarks[24], landmarks[26], landmarks[28]);
        if (!isNaN(leftKnee)) angles.push({ joint: 'Left Knee', angle: Math.round(leftKnee) });

        // Right shoulder
        const rightShoulder = this.calculateAngle(landmarks[11], landmarks[13], landmarks[23]);
        if (!isNaN(rightShoulder)) angles.push({ joint: 'Right Shoulder', angle: Math.round(rightShoulder) });

        // Left shoulder  
        const leftShoulder = this.calculateAngle(landmarks[12], landmarks[14], landmarks[24]);
        if (!isNaN(leftShoulder)) angles.push({ joint: 'Left Shoulder', angle: Math.round(leftShoulder) });

        return angles;
    }

    private calculateAngle(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number {
        const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs(radians * 180.0 / Math.PI);
        if (angle > 180.0) angle = 360.0 - angle;
        return angle;
    }

    private generatePoseSummary(landmarks: NormalizedLandmark[], worldLandmarks: NormalizedLandmark[]): string {
        // NOTE: We reverted to 2D-only summary because 3D depth logic assumes Camera = Target.
        // In side-profile videos (common for biomechanics), "Facing Target" != "Facing Camera".
        // We defer "Face Target" judgment to the AI's visual reasoning.
        return this.generatePoseSummary2D(landmarks);
    }

    private generatePoseSummary2D(landmarks: NormalizedLandmark[]): string {
        const rightWrist = landmarks[15];
        const leftWrist = landmarks[16];
        const rightShoulder = landmarks[11];
        const leftShoulder = landmarks[12];
        const rightHip = landmarks[23];
        const leftHip = landmarks[24];

        // Describe arm positions objectively
        const rightArmPosition = rightWrist.y < rightShoulder.y - 0.1 ? 'raised above shoulder' :
            rightWrist.y > rightHip.y + 0.1 ? 'lowered below hip' : 'at mid-level';
        const leftArmPosition = leftWrist.y < leftShoulder.y - 0.1 ? 'raised above shoulder' :
            leftWrist.y > leftHip.y + 0.1 ? 'lowered below hip' : 'at mid-level';

        // Body rotation estimate
        const shoulderWidth = Math.abs(landmarks[11].x - landmarks[12].x);
        const bodyAlignment = shoulderWidth > 0.25 ? 'body rotated/sideways' : 'facing camera';

        return `Right arm: ${rightArmPosition}, Left arm: ${leftArmPosition}, Body: ${bodyAlignment}`;
    }

    async drawPoseToImage(imageElement: HTMLImageElement, pose: PoseData, ball?: BallData): Promise<string> {
        const canvas = document.createElement('canvas');
        canvas.width = imageElement.naturalWidth;
        canvas.height = imageElement.naturalHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) return '';

        // Draw original image
        ctx.drawImage(imageElement, 0, 0);

        // Draw pose on top
        this.drawPose(ctx, pose);

        // Draw Ball if present
        if (ball) {
            ctx.beginPath();
            ctx.arc(ball.center.x, ball.center.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#FFFF00';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label
            ctx.fillStyle = '#FFFF00';
            ctx.font = 'bold 12px Arial';
            ctx.fillText('BALL', ball.center.x + 10, ball.center.y);
        }

        // Return base64
        return canvas.toDataURL('image/jpeg', 0.8);
    }

    // Alias for explicit dashboard usage
    drawSkeleton(ctx: CanvasRenderingContext2D, pose: PoseData) {
        this.drawPose(ctx, pose);
    }

    async detectBallFrame(videoElement: HTMLVideoElement, pose?: PoseData): Promise<BallData | null> {
        if (!this.objectDetector) await this.initializeObjectDetector();

        try {
            const result = this.objectDetector!.detect(videoElement);
            // Video dimensions are inherent in the element
            return this.processBallDetectionResult(result, { width: videoElement.videoWidth, height: videoElement.videoHeight }, pose);
        } catch (error) {
            // silent fail
        }
        return null;
    }

    async detectBallFromImage(imageElement: HTMLImageElement, pose?: PoseData): Promise<BallData | null> {
        if (!this.objectDetector) await this.initializeObjectDetector();

        try {
            const result = this.objectDetector!.detect(imageElement);
            return this.processBallDetectionResult(result, { width: imageElement.naturalWidth, height: imageElement.naturalHeight }, pose);
        } catch (error) {
            console.error('Ball detection error (Image):', error);
        }
        return null;
    }

    private processBallDetectionResult(
        result: { detections: import('@mediapipe/tasks-vision').Detection[] },
        imageSize: { width: number, height: number },
        pose?: PoseData
    ): BallData | null {
        // Expanded list to catch white soccer balls (often 'clock'/'bowl'/'frisbee')
        const validCategories = ['sports ball', 'apple', 'orange', 'baseball', 'tennis ball', 'clock', 'bowl', 'frisbee'];

        const candidates = result.detections.filter(d => validCategories.includes(d.categories[0].categoryName));

        if (candidates.length === 0) return null;

        let bestMatch = candidates[0];

        // INTELLIGENT SORTING: Prioritize candidates close to the skeleton
        if (pose && pose.landmarks) {
            const scoredCandidates = candidates.map(candidate => {
                const box = candidate.boundingBox!;
                const center = {
                    x: box.originX + (box.width / 2),
                    y: box.originY + (box.height / 2)
                };

                const rw = pose.landmarks[16]; // Right Wrist
                const lw = pose.landmarks[15]; // Left Wrist
                const rk = pose.landmarks[26]; // Right Knee
                const lk = pose.landmarks[25]; // Left Knee
                const rf = pose.landmarks[28]; // Right Ankle/Foot
                const lf = pose.landmarks[27]; // Left Ankle/Foot

                const getDist = (lm: import('@mediapipe/tasks-vision').NormalizedLandmark) => {
                    return Math.hypot(center.x - (lm.x * imageSize.width), center.y - (lm.y * imageSize.height));
                };

                // Find closest joint distance
                const minDist = Math.min(getDist(rw), getDist(lw), getDist(rk), getDist(lk), getDist(rf), getDist(lf));

                // Normalized Proximity Score (0 to 1, where 1 is touching)
                // Assuming max reasonable distance is image width
                const proximityScore = Math.max(0, 1 - (minDist / (imageSize.width * 0.5)));

                const labelScore = candidate.categories[0].categoryName === 'sports ball' ? 1.0 : 0.5;
                const confidence = candidate.categories[0].score;

                // WEIGHTED SCORE:
                // Proximity is King (User Req: "Constantly close to performer")
                // Weight: Proximity (60%) + Label (20%) + Confidence (20%)
                const totalScore = (proximityScore * 3.0) + (labelScore * 1.0) + confidence;

                return { candidate, score: totalScore, minDist };
            });

            // Sort by total score descending
            scoredCandidates.sort((a, b) => b.score - a.score);
            bestMatch = scoredCandidates[0].candidate;
        } else {
            // Fallback if no pose: Confidence and Label only
            candidates.sort((a, b) => {
                const aScore = a.categories[0].categoryName === 'sports ball' ? 10 : 0;
                const bScore = b.categories[0].categoryName === 'sports ball' ? 10 : 0;
                return (b.categories[0].score + bScore) - (a.categories[0].score + aScore);
            });
            bestMatch = candidates[0];
        }


        if (bestMatch && bestMatch.boundingBox) {
            const box = bestMatch.boundingBox;
            const center = {
                x: box.originX + (box.width / 2),
                y: box.originY + (box.height / 2)
            };

            let isValid = true;
            let status = "Detected";

            // Validation Logic: Proximity (Again, for final Pass/Fail)
            if (pose && pose.landmarks) {
                // Re-calculate min dist for the winner
                const rw = pose.landmarks[16];
                const lw = pose.landmarks[15];
                const rk = pose.landmarks[26];
                const lk = pose.landmarks[25];
                const rf = pose.landmarks[28];
                const lf = pose.landmarks[27];

                const getDist = (lm: import('@mediapipe/tasks-vision').NormalizedLandmark) => {
                    return Math.hypot(center.x - (lm.x * imageSize.width), center.y - (lm.y * imageSize.height));
                };

                const minDist = Math.min(getDist(rw), getDist(lw), getDist(rk), getDist(lk), getDist(rf), getDist(lf));

                // Threshold: Relaxed slightly to 30% of width to allow for tosses
                const THRESHOLD = Math.max(imageSize.width * 0.3, 250);

                if (minDist > THRESHOLD) {
                    if (bestMatch.categories[0].score > 0.85 && bestMatch.categories[0].categoryName === 'sports ball') {
                        status = "In Flight (High Confidence)";
                    } else {
                        isValid = false;
                        status = `Too far from body (${Math.round(minDist)}px)`;
                    }
                } else {
                    status = "Proximity Confirmed"; // Likely the one we sorted to the top
                }
            }

            return {
                center: center,
                centerNormalized: {
                    x: center.x / imageSize.width,
                    y: center.y / imageSize.height
                },
                box: box,
                isValid: isValid,
                status: status
            };
        }
        return null;
    }

    analyzeBallTrajectory(ballT: { x: number; y: number; frame: number }[], poseT: { pose: PoseData; frame: number }[]): { releaseFrame?: number; releaseHeightInfo?: string } {
        return { releaseFrame: undefined, releaseHeightInfo: "Analysis Pending Integration" };
    }

    // NEW: Post-process filter to remove objects that never move (e.g. floor markers)
    // This is called by App.tsx after collecting all frames
    filterStaticObjects(poseData: PoseData[]): PoseData[] {
        // Collect all valid ball centers
        const ballPositions: { x: number; y: number; index: number }[] = [];

        poseData.forEach((p, idx) => {
            if (p.ball && p.ball.isValid) {
                ballPositions.push({ x: p.ball.center.x, y: p.ball.center.y, index: idx });
            }
        });

        if (ballPositions.length < 2) return poseData; // Needs movement to compare

        // Calculate max distance moved
        let maxDist = 0;
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        ballPositions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            maxX = Math.max(minX, pos.x); // Wait, maxX calculation was bugged in thought process, fixing:
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
        });

        // Use bounding box of movement
        const moveX = maxX - minX;
        const moveY = maxY - minY;
        const totalMovement = Math.hypot(moveX, moveY);

        // THRESHOLD: If the object moved less than 30 pixels total across the entire video, it's a marker.
        // (Assuming standard 640x480 analysis or similar). 
        // 30px is conservative but safe for floor markers.
        const STATIC_THRESHOLD = 30;

        if (totalMovement < STATIC_THRESHOLD) {
            console.log(`🧹 Filtered Static Object: Moved only ${totalMovement.toFixed(1)}px (Threshold: ${STATIC_THRESHOLD}px)`);
            return poseData.map(p => {
                if (p.ball) {
                    return {
                        ...p,
                        ball: {
                            ...p.ball,
                            isValid: false,
                            status: `Static Object (Moved < ${STATIC_THRESHOLD}px)`
                        }
                    };
                }
                return p;
            });
        }

        return poseData;
    }
    async findPeakMoment(videoElement: HTMLVideoElement): Promise<{ bestTime: number; score: number }> {
        const duration = videoElement.duration;
        const step = 0.5; // Check every 0.5 seconds
        let bestTime = 0;
        let maxScore = -1;

        console.log("🔍 Smart Search: Scanning video for peak action...");

        for (let t = 0; t < duration; t += step) {
            // Detect pose at time t
            // Note: detectPoseFromVideo creates a new request. 
            // We need to ensure the video element is seeked or use detectForVideo timestamp?
            // MediaPipe video mode expects sequential frames usually.
            // But here we are skipping. Randomized access might be better served by 'detectPoseFrame' after seeking.
            // Seeking is slow. 
            // Better approach: Let's trust 'detectPoseFromVideo' with explicit timestamp?
            // Actually, MediaPipe Video mode requires sequential timestamps. 
            // If we skip, we might break internal tracking. 
            // Safe bet: Use 'detectPoseFrame' (Image mode) but we need to seek the video element.

            // Seeking the video element in a loop is very slow because we have to wait for 'seeked'.
            // Optimization: We will try to rely on MediaPipe's ability to handle gaps if we verify it works, 
            // OR just accept the seek delay for "Smart Search" which is an explicit user action.

            videoElement.currentTime = t;
            await new Promise<void>(resolve => {
                const onSeeked = () => { videoElement.removeEventListener('seeked', onSeeked); resolve(); };
                videoElement.addEventListener('seeked', onSeeked);
            });

            const pose = await this.detectPoseFrame(videoElement);

            if (pose && pose.worldLandmarks) {
                const lm = pose.worldLandmarks;
                const headY = (lm[0].y + lm[2].y + lm[5].y) / 3; // Nose, eyes
                const hipY = (lm[23].y + lm[24].y) / 2; // Hips

                // Score 1: Inversion (Head below hips) based on Y coordinate
                // In World Landmarks, Y is vertical? MediaPipe World: Y is gravity aligned?
                // Actually MediaPipe World: Y is down? NO, Y is up?
                // Let's use Normalized Landmarks for easier logic (0 top, 1 bottom)
                // In Normalized: Head (y < hip y) = Upright. Head (y > hip y) = Inverted?
                // Wait, 0 is TOP. So Head Y (0.1) < Hip Y (0.5) is UPRIGHT.
                // Head Y (0.8) > Hip Y (0.5) is INVERTED.

                const nlm = pose.landmarks;
                const nHeadY = (nlm[0].y + nlm[2].y + nlm[5].y) / 3;
                const nHipY = (nlm[23].y + nlm[24].y) / 2;

                let score = 0;

                // INVERSION BONUS
                if (nHeadY > nHipY) {
                    score += 50; // Huge bonus for inversion (Handstand/Cartwheel)
                    score += (nHeadY - nHipY) * 100; // Deeper inversion = better
                }

                // VISIBILITY/ACTIVITY BONUS
                // Check if limbs are extended/visible
                const visibleCount = nlm.filter(l => l.visibility && l.visibility > 0.6).length;
                score += visibleCount;

                if (score > maxScore) {
                    maxScore = score;
                    bestTime = t;
                }
            }
        }

        console.log(`✅ Smart Search Found Peak at ${bestTime.toFixed(2)}s (Score: ${maxScore.toFixed(0)})`);
        return { bestTime, score: maxScore };
    }
}

export const poseDetectionService = new PoseDetectionService();

