import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Upload, Play, Pause, Maximize, Minimize, Activity } from 'lucide-react';
import { captureVideoFrame, captureMultipleFrames, MultiFrameCapture } from '../utils/fileUtils';
import { PoseData, poseDetectionService } from '../services/poseDetectionService';
import { getCenterOfMass, analyzeSymmetry, calculateAllJointAngles, formatTelemetryForPrompt, drawJointAngleStats } from '../utils/biomechanics';

// Define the handle interface for the parent to communicate with
export interface VideoPlayerHandle {
  captureFrame: () => Promise<{ base64: string; telemetry: string } | null>;
  captureMultiFrames: (count?: number, interval?: number, startTimeOverride?: number) => Promise<{ capture: MultiFrameCapture; centerPose: PoseData | undefined } | null>;
  getVideoElement: () => HTMLVideoElement | null;
  findPeak: () => Promise<number>;
}

export interface FrameSnapshot {
  frameImage: string;
  timestamp: number;
  pose: PoseData | null;
  angles: { joint: string; angle: number }[];
}

interface VideoPlayerProps {
  label?: string; // e.g. "Front View"
  onFrameCapture?: (base64Data: string, telemetry?: string) => void;
  onPoseUpdate?: (pose: PoseData | null, angles: { joint: string; angle: number }[]) => void;
  isActive?: boolean; // To style active state if needed
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(({ label = "Video Source", onPoseUpdate }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const latestTelemetryRef = useRef<string>("");

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showAngles, setShowAngles] = useState(true);
  const [currentAngles, setCurrentAngles] = useState<{ joint: string; angle: number }[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasStyle, setCanvasStyle] = useState<React.CSSProperties>({});

  // --- Expose Methods via Ref ---
  useImperativeHandle(ref, () => ({
    captureFrame: async () => {
      if (!videoRef.current) return null;
      videoRef.current.pause();
      setIsPlaying(false);

      // Ensure pose detected on current frame
      const livePose = await poseDetectionService.detectPoseFrame(videoRef.current);
      if (livePose) {
        const landmarks = livePose.landmarks;
        const symmetry = analyzeSymmetry(landmarks);
        const angs = calculateAllJointAngles(landmarks);
        latestTelemetryRef.current = formatTelemetryForPrompt(angs, symmetry);
      }

      const base64 = captureVideoFrame(videoRef.current);
      if (base64) {
        return { base64, telemetry: latestTelemetryRef.current };
      }
      return null;
    },
    captureMultiFrames: async (count: number = 3, interval: number = 0.5, startTimeOverride?: number) => {
      if (!videoRef.current) return null;
      videoRef.current.pause();
      setIsPlaying(false);

      const referenceTime = startTimeOverride ?? videoRef.current.currentTime;

      const onFrameDraw = async (ctx: CanvasRenderingContext2D, time: number) => {
        if (!videoRef.current) return;

        // 1. Detect pose at this specific timestamp
        const livePose = await poseDetectionService.detectPoseFrame(videoRef.current);

        if (livePose) {
          // 2. Draw Skeleton
          // We need to scale context to match original video resolution if not already
          poseDetectionService.drawSkeleton(ctx, livePose);

          // 3. Draw Angles
          const landmarks = livePose.landmarks;
          const angs = calculateAllJointAngles(landmarks);

          // Re-use the existing drawAnglesOnCanvas logic
          // Note: drawAnglesOnCanvas expects width/height of the canvas
          drawAnglesOnCanvas(ctx, livePose, angs, ctx.canvas.width, ctx.canvas.height);

          // 4. Draw Joint Angles Data Box
          drawJointAngleStats(ctx, angs, ctx.canvas.width, ctx.canvas.height);
        }
      };

      try {
        // Capture frames centered around current time
        const multiCapture = await captureMultipleFrames(
          videoRef.current,
          referenceTime,
          count,
          interval,
          onFrameDraw // Pass the overlay callback
        );

        const centerPose = await poseDetectionService.detectPoseFromVideo(videoRef.current, referenceTime * 1000);
        return { capture: multiCapture, centerPose: centerPose || undefined };
      } catch (e) {
        console.error("Multi-frame capture failed:", e);
        return null;
      }
    },
    findPeak: async () => {
      if (!videoRef.current) return 0;
      const originalTime = videoRef.current.currentTime;
      videoRef.current.pause();
      setIsPlaying(false);

      try {
        const { bestTime, score } = await poseDetectionService.findPeakMoment(videoRef.current);
        // Note: We DO NOT seek here anymore to avoid "replaying" or jumping.
        // We return the time, and the capture function will use it directly.
        console.log(`Smart Search found peak at ${bestTime}s (score: ${score})`);
        return bestTime;
      } catch (e) {
        console.error("Smart search failed, reverting", e);
        videoRef.current.currentTime = originalTime;
        return originalTime;
      }
    },
    getVideoElement: () => videoRef.current
  }));

  // --- Helper Functions ---

  const updateCanvasLayout = () => {
    const video = videoRef.current;
    const container = videoContainerRef.current;
    if (video && container) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cw = container.clientWidth;
      const ch = container.clientHeight;

      if (!vw || !vh || !cw || !ch) return;

      const videoRatio = vw / vh;
      const containerRatio = cw / ch;

      let width, height, left, top;

      if (containerRatio > videoRatio) {
        // Container is wider than video (pillarbox) - Video fills height
        height = ch;
        width = height * videoRatio;
        top = 0;
        left = (cw - width) / 2;
      } else {
        // Container is taller than video (letterbox) - Video fills width
        width = cw;
        height = width / videoRatio;
        left = 0;
        top = (ch - height) / 2;
      }

      setCanvasStyle({
        width: `${width}px`,
        height: `${height}px`,
        top: `${top}px`,
        left: `${left}px`,
        position: 'absolute',
        pointerEvents: 'none' // Ensure clicks pass through to video/controls
      });

      // Update canvas internal resolution to match source video
      if (canvasRef.current) {
        canvasRef.current.width = vw;
        canvasRef.current.height = vh;
      }
    }
  };

  const drawAnglesOnCanvas = (
    ctx: CanvasRenderingContext2D,
    pose: PoseData,
    angles: { joint: string; angle: number }[],
    width: number,
    height: number
  ) => {
    const landmarks = pose.landmarks;

    // Define joint positions for angle labels
    const jointPositions: { [key: string]: { x: number; y: number } } = {
      'Left Shoulder': landmarks[11],
      'Right Shoulder': landmarks[12],
      'Left Elbow': landmarks[13],
      'Right Elbow': landmarks[14],
      'Left Wrist': landmarks[15],
      'Right Wrist': landmarks[16],
      'Left Hip': landmarks[23],
      'Right Hip': landmarks[24],
      'Left Knee': landmarks[25],
      'Right Knee': landmarks[26],
      'Left Ankle': landmarks[27],
      'Right Ankle': landmarks[28]
    };

    angles.forEach(({ joint, angle }) => {
      const pos = jointPositions[joint];
      if (pos) {
        const x = pos.x * width;
        const y = pos.y * height;

        // Draw background box
        const text = `${Math.round(angle)}°`;
        ctx.font = 'bold 14px Arial';
        const metrics = ctx.measureText(text);
        const padding = 4;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(
          x - metrics.width / 2 - padding,
          y - 20 - padding,
          metrics.width + padding * 2,
          20 + padding * 2
        );

        // Draw text
        ctx.fillStyle = '#00FF00';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y - 10);
      }
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setIsPlaying(false);
    }
  };

  const toggleFullscreen = async () => {
    if (!videoContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await videoContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };



  // --- Effects ---

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      requestAnimationFrame(updateCanvasLayout); // Update layout on fullscreen change
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Update layout on metadata load and resize
  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(updateCanvasLayout);
    };

    window.addEventListener('resize', handleResize);

    // Also observe the container for size changes using ResizeObserver
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateCanvasLayout);
    });

    if (videoContainerRef.current) {
      observer.observe(videoContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [videoSrc]); // Re-run if videoSrc changes to re-observe

  // Live Pose Tracking Loop
  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = async () => {
      // 1. Check conditions
      if (videoRef.current && canvasRef.current && showSkeleton && isPlaying) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          // 2. Ensure canvas matches video dimensions
          if (canvas.width !== videoRef.current.videoWidth || canvas.height !== videoRef.current.videoHeight) {
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            // If resolution changed, update layout too
            updateCanvasLayout();
          }

          // 3. Detect pose on current video frame
          const livePose = await poseDetectionService.detectPoseFrame(videoRef.current);

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (livePose) {
            // Draw Skeleton
            poseDetectionService.drawSkeleton(ctx, livePose);

            // --- UNIVERSAL BIOMECHANICS ---
            const landmarks = livePose.landmarks;
            const com = getCenterOfMass(landmarks);
            const symmetry = analyzeSymmetry(landmarks);
            const angs = calculateAllJointAngles(landmarks);

            // Format for AI & Store
            latestTelemetryRef.current = formatTelemetryForPrompt(angs, symmetry);

            // Draw CoM (Plumb Line)
            if (com) {
              ctx.beginPath();
              ctx.moveTo(com.x * canvas.width, com.y * canvas.height);
              ctx.lineTo(com.x * canvas.width, canvas.height);
              ctx.lineWidth = 2;
              ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)'; // Cyan dashed
              ctx.setLineDash([5, 5]);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.beginPath();
              ctx.arc(com.x * canvas.width, com.y * canvas.height, 5, 0, 2 * Math.PI);
              ctx.fillStyle = '#00FFFF';
              ctx.fill();
            }

            // Draw Symmetry Lines
            const drawSym = (i1: number, i2: number, level: boolean) => {
              if (landmarks[i1].visibility && landmarks[i1].visibility! > 0.5 &&
                landmarks[i2].visibility && landmarks[i2].visibility! > 0.5) {
                ctx.beginPath();
                ctx.moveTo(landmarks[i1].x * canvas.width, landmarks[i1].y * canvas.height);
                ctx.lineTo(landmarks[i2].x * canvas.width, landmarks[i2].y * canvas.height);
                ctx.lineWidth = 3;
                ctx.strokeStyle = level ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 0, 0, 0.6)';
                ctx.stroke();
              }
            };
            drawSym(11, 12, symmetry.shouldersLevel); // Shoulders
            drawSym(23, 24, symmetry.hipsLevel);       // Hips

            // Calculate and display angles (Legacy/Visual)
            const angles = poseDetectionService.analyzePoseGeometry(livePose).keyAngles;
            setCurrentAngles(angles);

            // Draw numerical angles on canvas if enabled
            if (showAngles) {
              drawAnglesOnCanvas(ctx, livePose, angles, canvas.width, canvas.height);
            }

            // Notify parent component
            if (onPoseUpdate) {
              onPoseUpdate(livePose, angles);
            }
          } else {
            setCurrentAngles([]);
            if (onPoseUpdate) {
              onPoseUpdate(null, []);
            }
          }
        }
      } else if (canvasRef.current && !isPlaying) {
        // Clear canvas when video is paused/stopped, unless we want to keep the last frame?
        // Usually better to clear to avoid stale overlays, or handleTimeUpdate will redraw if paused.
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // We might want to NOT clear if we are just paused, to show the static pose.
          // But wait, renderLoop runs constantly. If !isPlaying, it clears.
          // But handleTimeUpdate redraws when scrubbing/paused. 
          // So if just paused, we might clear it here? 
          // Actually, if !isPlaying, this block runs.
          // Let's only clear if we really need to.
          // For now, keep existing logic: clear if !isPlaying.
          // But `handleTimeUpdate` will re-draw if scrubbing.
          // If just paused, `handleTimeUpdate` isn't firing constantly.
          // So the canvas might be cleared and stay empty?
          // The original code passed `!isPlaying` to the else if block.
          // Let's modify: if just paused, don't clear.
          // Only clear if no video?
          // Original code:
          // } else if (canvasRef.current && !isPlaying) {
          //    ctx.clearRect...
          // }
          // This implies when you pause, the skeleton disappears.
          // Maybe we want it to stay?
          // For now, I'll stick to the original behavior to avoid regressions, but the user *might* want it to stay.
          // Actually, `handleTimeUpdate` handles the "scrubbing" case.
          // Providing a "Pause" keeps the video element on the frame.
          // `renderLoop` only updates when `isPlaying`.
          // So if `!isPlaying`, the canvas is cleared.
          // This means pausing hides the skeleton. That seems like bad UX.
          // I will COMMENT OUT the clearRect for !isPlaying to see if it improves UX (skeleton stays).
          // Wait, if I comment it out, the skeleton on the LAST frame persists.
          // But if I scrub, `handleTimeUpdate` clears and redraws.
          // So it is safe to remove the aggressive clearing on pause.

          // ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        // setCurrentAngles([]); // Don't clear angles on pause either
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, showSkeleton, showAngles, onPoseUpdate]);

  // Update angles when scrubbing (not playing)
  const handleTimeUpdate = async () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);

      // Update pose and angles when scrubbing (paused)
      if (!isPlaying && videoRef.current && canvasRef.current && showSkeleton) {
        const livePose = await poseDetectionService.detectPoseFrame(videoRef.current);

        if (livePose) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            // Ensure canvas matches video dimensions
            if (canvas.width !== videoRef.current.videoWidth || canvas.height !== videoRef.current.videoHeight) {
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            poseDetectionService.drawSkeleton(ctx, livePose);

            // Biomechanics (CoM/Symmetry) on scrubbing too
            const landmarks = livePose.landmarks;
            const com = getCenterOfMass(landmarks);
            const symmetry = analyzeSymmetry(landmarks);
            const angs = calculateAllJointAngles(landmarks);
            latestTelemetryRef.current = formatTelemetryForPrompt(angs, symmetry);

            // Draw CoM
            if (com) {
              ctx.beginPath();
              ctx.moveTo(com.x * canvas.width, com.y * canvas.height);
              ctx.lineTo(com.x * canvas.width, canvas.height);
              ctx.lineWidth = 2;
              ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
              ctx.setLineDash([5, 5]);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.beginPath();
              ctx.arc(com.x * canvas.width, com.y * canvas.height, 5, 0, 2 * Math.PI);
              ctx.fillStyle = '#00FFFF';
              ctx.fill();
            }

            // Draw Symmetry
            const drawSym = (i1: number, i2: number, level: boolean) => {
              if (landmarks[i1].visibility && landmarks[i1].visibility! > 0.5 &&
                landmarks[i2].visibility && landmarks[i2].visibility! > 0.5) {
                ctx.beginPath();
                ctx.moveTo(landmarks[i1].x * canvas.width, landmarks[i1].y * canvas.height);
                ctx.lineTo(landmarks[i2].x * canvas.width, landmarks[i2].y * canvas.height);
                ctx.lineWidth = 3;
                ctx.strokeStyle = level ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 0, 0, 0.6)';
                ctx.stroke();
              }
            };
            drawSym(11, 12, symmetry.shouldersLevel);
            drawSym(23, 24, symmetry.hipsLevel);


            const angles = poseDetectionService.analyzePoseGeometry(livePose).keyAngles;
            setCurrentAngles(angles);

            if (showAngles) {
              drawAnglesOnCanvas(ctx, livePose, angles, canvas.width, canvas.height);
            }

            if (onPoseUpdate) {
              onPoseUpdate(livePose, angles);
            }
          }
        } else {
          // If no pose found during scrubbing (e.g. empty frame), clear
          if (canvasRef.current && !isPlaying) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
          setCurrentAngles([]);
          if (onPoseUpdate) {
            onPoseUpdate(null, []);
          }
        }
      }
    }
  };


  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Video Display Area */}
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Activity size={16} className="text-blue-500" />
          {label}
        </h3>
        {videoSrc && (
          <button
            onClick={() => setVideoSrc(null)}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Remove
          </button>
        )}
      </div>

      <div
        ref={videoContainerRef}
        className="relative w-full bg-slate-800 rounded-xl overflow-hidden shadow-2xl border border-slate-700 aspect-video group"
      >
        {!videoSrc ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <Upload size={48} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">Upload {label}</p>
            <p className="text-sm opacity-60">Supports MP4, WebM</p>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              playsInline
              loop
            />
            {/* Overlay Grid (Kinovea Style) */}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

            {/* Skeleton Canvas Overlay */}
            <canvas
              ref={canvasRef}
              style={canvasStyle}
              className="absolute pointer-events-none"
            />

            {/* Fullscreen Button Overlay */}
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 p-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>

            {/* Angle Display Panel */}
            {showAngles && currentAngles.length > 0 && (
              <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg p-3 max-w-xs">
                <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
                  <Activity size={14} className="text-blue-400" />
                  Joint Angles
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {currentAngles.map(({ joint, angle }) => (
                    <div key={joint} className="flex justify-between items-center">
                      <span className="text-slate-400 truncate">{joint.replace('Right ', 'R ').replace('Left ', 'L ')}</span>
                      <span className="text-green-400 font-mono font-semibold ml-2">{Math.round(angle)}°</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700">
        {/* Scrubber */}
        <div className="w-full flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-slate-400 mb-3">
          <span className="font-mono w-10 sm:w-12">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={(e) => {
              if (videoRef.current) {
                videoRef.current.currentTime = Number(e.target.value);
                setCurrentTime(Number(e.target.value));
              }
            }}
            className="flex-1 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="font-mono w-10 sm:w-12 text-right">{formatTime(duration)}</span>
        </div>

        {/* Control Buttons Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
          {/* Playback Controls */}
          <div className="flex gap-2 justify-center sm:justify-start">
            <button
              onClick={togglePlay}
              disabled={!videoSrc}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 transition-colors touch-manipulation"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={18} className="sm:w-5 sm:h-5" /> : <Play size={18} className="sm:w-5 sm:h-5" />}
            </button>
          </div>

          {/* Display Toggles */}
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setShowSkeleton(!showSkeleton)}
              className={`px-2 sm:px-3 py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-colors touch-manipulation ${showSkeleton
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}
              title="Toggle Skeleton"
            >
              <Activity size={14} className="inline mr-1 sm:w-4 sm:h-4" />
              Skeleton
            </button>
            <button
              onClick={() => setShowAngles(!showAngles)}
              className={`px-2 sm:px-3 py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-colors touch-manipulation ${showAngles
                ? 'bg-green-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}
              title="Toggle Angles"
            >
              ° Angles
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default VideoPlayer;
