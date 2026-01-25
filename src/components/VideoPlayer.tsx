import React, { useRef, useEffect, useState } from 'react';
import { Upload, Play, Pause, Camera, RotateCcw, Activity, Maximize, Minimize } from 'lucide-react';
import { captureVideoFrame, captureMultipleFrames, MultiFrameCapture } from '../utils/fileUtils';
import { PoseData, poseDetectionService } from '../services/poseDetectionService';

interface VideoPlayerProps {
  onFrameCapture: (base64Data: string) => void;
  onMultiFrameCapture?: (capture: MultiFrameCapture, centerPose?: PoseData) => void;
  onMultiFrameSnapshot?: (snapshots: FrameSnapshot[]) => void;
  isAnalyzing: boolean;
  currentPose?: PoseData;
  onPoseUpdate?: (pose: PoseData | null, angles: { joint: string; angle: number }[]) => void;
}

export interface FrameSnapshot {
  frameImage: string;
  timestamp: number;
  pose: PoseData | null;
  angles: { joint: string; angle: number }[];
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ onFrameCapture, onMultiFrameCapture, onMultiFrameSnapshot, isAnalyzing, currentPose, onPoseUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showAngles, setShowAngles] = useState(true);
  const [currentAngles, setCurrentAngles] = useState<{ joint: string; angle: number }[]>([]);
  const [snapshotCount, setSnapshotCount] = useState<number>(5);
  const [isCapturingSnapshots, setIsCapturingSnapshots] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setIsPlaying(false);
      // Reset pose when new video loads
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

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Live Pose Tracking Loop
  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = async () => {
      if (videoRef.current && canvasRef.current && showSkeleton && isPlaying) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          // Ensure canvas matches video dimensions
          if (canvas.width !== videoRef.current.videoWidth || canvas.height !== videoRef.current.videoHeight) {
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
          }

          // Detect pose on current video frame
          const livePose = await poseDetectionService.detectPoseFrame(videoRef.current);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (livePose) {
            poseDetectionService.drawSkeleton(ctx, livePose);
            
            // Calculate and display angles
            const angles = poseDetectionService.analyzePoseGeometry(livePose).keyAngles;
            setCurrentAngles(angles);
            
            // Draw angles on canvas if enabled
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
        // Clear canvas when video is paused
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setCurrentAngles([]);
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, showSkeleton, showAngles, onPoseUpdate]);

  // Update angles when scrubbing (not playing)
  const handleTimeUpdate = async () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
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
          setCurrentAngles([]);
          if (onPoseUpdate) {
            onPoseUpdate(null, []);
          }
        }
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
      'Right Elbow': landmarks[13],
      'Left Elbow': landmarks[14],
      'Right Knee': landmarks[25],
      'Left Knee': landmarks[26],
      'Right Shoulder': landmarks[11],
      'Left Shoulder': landmarks[12]
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

  const handleCapture = async () => {
    if (videoRef.current) {
      // Pause to capture clear frames
      videoRef.current.pause();
      setIsPlaying(false);

      const currentVideoTime = videoRef.current.currentTime;

      // Use multi-frame capture if callback is provided
      if (onMultiFrameCapture) {
        try {
          // Capture 3 frames: 0.5s before, current, 0.5s after
          const multiCapture = await captureMultipleFrames(videoRef.current, currentVideoTime, 3, 0.5);
          
          // Detect pose on center frame
          const centerPose = await poseDetectionService.detectPoseFromVideo(videoRef.current, currentVideoTime * 1000);
          
          onMultiFrameCapture(multiCapture, centerPose || undefined);
        } catch (error) {
          console.error("Multi-frame capture failed:", error);
          // Fallback to single frame
          const base64 = captureVideoFrame(videoRef.current);
          if (base64) {
            onFrameCapture(base64);
          }
        }
      } else {
        // Fallback to single frame capture
        const base64 = captureVideoFrame(videoRef.current);
        if (base64) {
          onFrameCapture(base64);
        }
      }
    }
  };

  const handleMultiSnapshot = async () => {
    if (!videoRef.current || !onMultiFrameSnapshot) return;
    
    setIsCapturingSnapshots(true);
    const video = videoRef.current;
    const originalTime = video.currentTime;
    
    try {
      const snapshots: FrameSnapshot[] = [];
      const interval = duration / (snapshotCount + 1);
      
      for (let i = 1; i <= snapshotCount; i++) {
        const timestamp = interval * i;
        video.currentTime = timestamp;
        
        // Wait for seek
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
        });
        
        // Detect pose
        const pose = await poseDetectionService.detectPoseFrame(video);
        
        // Calculate angles
        const angles = pose ? poseDetectionService.analyzePoseGeometry(pose).keyAngles : [];
        
        // Create canvas with skeleton and angles
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Draw video frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Draw skeleton and angles if pose detected
          if (pose) {
            poseDetectionService.drawSkeleton(ctx, pose);
            drawAnglesOnCanvas(ctx, pose, angles, canvas.width, canvas.height);
          }
          
          const frameImage = canvas.toDataURL('image/jpeg', 0.9);
          
          snapshots.push({
            frameImage,
            timestamp,
            pose,
            angles
          });
        }
      }
      
      // Restore original time
      video.currentTime = originalTime;
      
      // Send snapshots to parent
      onMultiFrameSnapshot(snapshots);
      
    } catch (error) {
      console.error("Multi-snapshot capture failed:", error);
    } finally {
      setIsCapturingSnapshots(false);
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
      <div 
        ref={videoContainerRef}
        className="relative w-full bg-slate-800 rounded-xl overflow-hidden shadow-2xl border border-slate-700 aspect-video group"
      >
        {!videoSrc ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <Upload size={48} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">Upload a video to begin analysis</p>
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
              className="absolute inset-0 w-full h-full pointer-events-none"
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
            <button
              onClick={() => {
                if (videoRef.current) videoRef.current.currentTime = 0;
              }}
              disabled={!videoSrc}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 transition-colors touch-manipulation"
              title="Restart"
            >
              <RotateCcw size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Display Toggles */}
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setShowSkeleton(!showSkeleton)}
              className={`px-2 sm:px-3 py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-colors touch-manipulation ${
                showSkeleton 
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
              className={`px-2 sm:px-3 py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-colors touch-manipulation ${
                showAngles 
                  ? 'bg-green-600 text-white' 
                  : 'bg-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Toggle Angles"
            >
              ° Angles
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            {/* Snapshot Controls */}
            <select
              value={snapshotCount}
              onChange={(e) => setSnapshotCount(Number(e.target.value))}
              className="bg-slate-700 text-white text-xs px-2 py-2 rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 touch-manipulation"
              title="Number of snapshots"
            >
              <option value={3}>3 frames</option>
              <option value={5}>5 frames</option>
              <option value={7}>7 frames</option>
              <option value={10}>10 frames</option>
            </select>

            <div className="flex gap-2">
              <button
                onClick={handleMultiSnapshot}
                disabled={!videoSrc || isCapturingSnapshots || isAnalyzing}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all touch-manipulation ${
                  isCapturingSnapshots || isAnalyzing
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-500 text-white active:scale-95'
                }`}
                title="Capture multiple snapshots"
              >
                <Camera size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden sm:inline">{isCapturingSnapshots ? 'Capturing...' : 'Snapshots'}</span>
                <span className="sm:hidden">{isCapturingSnapshots ? 'Wait...' : 'Snap'}</span>
              </button>

              <button
                onClick={handleCapture}
                disabled={!videoSrc || isAnalyzing || isCapturingSnapshots}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all touch-manipulation ${
                  isAnalyzing || isCapturingSnapshots
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/20 active:scale-95'
                }`}
                title="Analyze current frame"
              >
                <Camera size={18} className="sm:w-5 sm:h-5" />
                {isAnalyzing ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
