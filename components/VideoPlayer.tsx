import React, { useRef, useEffect, useState } from 'react';
import { Upload, Play, Pause, Camera, RotateCcw } from 'lucide-react';
import { captureVideoFrame } from '../utils/fileUtils';

interface VideoPlayerProps {
  onFrameCapture: (base64Data: string) => void;
  isAnalyzing: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ onFrameCapture, isAnalyzing }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setIsPlaying(false);
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

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleCapture = () => {
    if (videoRef.current) {
      // Pause to capture clear frame
      videoRef.current.pause();
      setIsPlaying(false);
      
      const base64 = captureVideoFrame(videoRef.current);
      if (base64) {
        onFrameCapture(base64);
      }
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
      <div className="relative w-full bg-slate-800 rounded-xl overflow-hidden shadow-2xl border border-slate-700 aspect-video group">
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
          </>
        )}
      </div>

      {/* Controls */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col gap-3">
        {/* Scrubber */}
        <div className="w-full flex items-center gap-3 text-xs text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={currentTime} 
                onChange={(e) => {
                    if(videoRef.current) {
                        videoRef.current.currentTime = Number(e.target.value);
                        setCurrentTime(Number(e.target.value));
                    }
                }}
                className="flex-1 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span>{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between">
           <div className="flex gap-2">
             <button 
                onClick={togglePlay}
                disabled={!videoSrc}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 transition-colors"
             >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
             </button>
             <button 
                onClick={() => {
                    if(videoRef.current) videoRef.current.currentTime = 0;
                }}
                disabled={!videoSrc}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 transition-colors"
             >
                <RotateCcw size={20} />
             </button>
           </div>

           <button
             onClick={handleCapture}
             disabled={!videoSrc || isAnalyzing}
             className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-white transition-all
               ${isAnalyzing 
                 ? 'bg-slate-600 cursor-not-allowed' 
                 : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-900/20'
               }`}
           >
             <Camera size={20} />
             {isAnalyzing ? 'Analyzing...' : 'Analyze Frame'}
           </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
