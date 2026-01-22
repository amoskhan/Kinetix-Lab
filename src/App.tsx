import React, { useState, useEffect } from 'react';
import { BrainCircuit, Info, History as HistoryIcon, X, Activity } from 'lucide-react';
import VideoPlayer, { FrameSnapshot } from '../components/VideoPlayer';
import AnalysisDashboard from '../components/AnalysisDashboard';
import { analyzeMovement, analyzeMultiFrameMovement } from '../services/geminiService';
import { poseDetectionService, PoseData } from '../services/poseDetectionService';
import { AnalysisStatus, AnalysisResponse } from '../types';
import { MultiFrameCapture } from '../utils/fileUtils';

// History Item Interface
interface HistoryItem {
  id: string;
  thumbnail: string;
  timestamp: string;
  result: AnalysisResponse;
}

const App: React.FC = () => {
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPose, setCurrentPose] = useState<PoseData | undefined>(undefined);
  const [userDeclaredSkill, setUserDeclaredSkill] = useState<string>('');
  const [frameSnapshots, setFrameSnapshots] = useState<FrameSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<FrameSnapshot | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load History from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('analysis_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  const saveToHistory = (result: AnalysisResponse, thumbnail: string) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      thumbnail, // We'll use the analyzed frame as thumbnail
      timestamp: new Date().toLocaleString(),
      result
    };
    const updatedHistory = [newItem, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('analysis_history', JSON.stringify(updatedHistory));
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setAnalysisResult(item.result);
    setStatus(AnalysisStatus.COMPLETE);
    setShowHistory(false);
  };

  const handleMultiFrameSnapshot = (snapshots: FrameSnapshot[]) => {
    console.log(`📸 Captured ${snapshots.length} frame snapshots`);
    setFrameSnapshots(snapshots);
  };

  const handleViewSnapshot = (snapshot: FrameSnapshot) => {
    setSelectedSnapshot(snapshot);
    setShowSnapshotModal(true);
  };

  const handleDownloadSnapshot = (snapshot: FrameSnapshot, index: number) => {
    // Create a canvas to composite the image with angle data
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Set canvas size (image + info panel)
      const infoHeight = 200;
      canvas.width = img.width;
      canvas.height = img.height + infoHeight;

      // Draw the video frame with skeleton
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

  const handleDownloadAllSnapshots = () => {
    frameSnapshots.forEach((snapshot, index) => {
      setTimeout(() => {
        handleDownloadSnapshot(snapshot, index);
      }, index * 500); // Stagger downloads
    });
  };

  const handleMultiFrameCapture = async (capture: MultiFrameCapture, centerPose?: PoseData) => {
    setStatus(AnalysisStatus.ANALYZING);
    setErrorMessage(null);
    setAnalysisResult(null);

    try {
      console.log(`📸 Captured ${capture.frames.length} frames for analysis`);
      
      // 1. If no pose provided, detect it from center frame
      let poseData = centerPose;
      if (!poseData) {
        const img = new Image();
        img.src = capture.frames[capture.centerFrameIndex];
        await new Promise((resolve) => { img.onload = resolve; });
        poseData = await poseDetectionService.detectPoseFromImage(img);
      }

      if (poseData) {
        setCurrentPose(poseData);
        
        // 2. Analyze pose geometry to detect movement type
        const analysis = poseDetectionService.analyzePoseGeometry(poseData);
        console.log("🎯 Local Detection:", analysis.detectedSkill);
        console.log("📐 Key Angles:", analysis.keyAngles);
      } else {
        console.warn("⚠️ No pose detected in center frame");
      }

      // 3. Send multi-frame data to Gemini
      console.log("🧠 Sending multi-frame sequence to Gemini...");
      const result = await analyzeMultiFrameMovement({
        frames: capture.frames,
        timestamps: capture.timestamps,
        centerFrameIndex: capture.centerFrameIndex,
        poseData: poseData || undefined,
        detectedMovement: poseData ? poseDetectionService.analyzePoseGeometry(poseData).detectedSkill : undefined,
        userDeclaredSkill: userDeclaredSkill || undefined
      });

      // 4. Update State & Save (use center frame as thumbnail)
      setAnalysisResult(result);
      setStatus(AnalysisStatus.COMPLETE);
      saveToHistory(result, capture.frames[capture.centerFrameIndex]);

    } catch (error: any) {
      console.error(error);
      setStatus(AnalysisStatus.ERROR);
      setErrorMessage(error.message || "Failed to analyze the movement. Please check your API key and try again.");
    }
  };

  const handleFrameCapture = async (base64Frame: string) => {
    setStatus(AnalysisStatus.ANALYZING);
    setErrorMessage(null);
    setAnalysisResult(null);

    try {
      // 1. Convert Base64 to Image Element for Pose Detection
      const img = new Image();
      img.src = base64Frame;
      await new Promise((resolve) => { img.onload = resolve; });

      // 2. Local Pose Detection (Fast)
      console.log("Detecting Pose...");
      const poseData = await poseDetectionService.detectPoseFromImage(img);

      if (poseData) {
        setCurrentPose(poseData);
        console.log("Pose Detected:", poseData);
      } else {
        console.warn("No pose detected in frame.");
      }

      // 3. Send to Gemini "Brain"
      console.log("Sending to Brain...");
      const result = await analyzeMovement(base64Frame, poseData || undefined, userDeclaredSkill || undefined);

      // 4. Update State & Save
      setAnalysisResult(result);
      setStatus(AnalysisStatus.COMPLETE);
      saveToHistory(result, base64Frame);

    } catch (error: any) {
      console.error(error);
      setStatus(AnalysisStatus.ERROR);
      setErrorMessage(error.message || "Failed to analyze the movement. Please check your API key and try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
              <BrainCircuit className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Kinetix<span className="text-blue-500">Lab</span></h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Video Analysis Suite</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-md transition-colors flex items-center gap-2 ${showHistory ? 'text-blue-400 bg-slate-800' : 'text-slate-400 hover:text-white'}`}
              title="History"
            >
              <HistoryIcon size={20} />
              <span className="hidden sm:inline text-sm font-medium">History</span>
            </button>
            <button
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title="About"
            >
              <Info size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 relative">

        {/* History Sidebar Overlay (Mobile/Slide-in) */}
        {showHistory && (
          <div className="absolute inset-y-0 right-0 z-40 w-80 bg-slate-800 border-l border-slate-700 shadow-2xl p-4 overflow-y-auto transform transition-transform">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Analysis History</h2>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              {history.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No history yet.</p>}
              {history.map(item => (
                <div
                  key={item.id}
                  onClick={() => loadHistoryItem(item)}
                  className="group p-3 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-blue-500 cursor-pointer transition-all hover:bg-slate-800"
                >
                  <div className="flex gap-3">
                    <div className="w-16 h-16 bg-black rounded-md overflow-hidden flex-shrink-0">
                      <img src={item.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">{item.result.feedback.movementName}</h4>
                      <p className="text-xs text-blue-400 mb-1">{item.result.feedback.phaseDetected}</p>
                      <p className="text-[10px] text-slate-500">{item.timestamp}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Single Column Layout */}
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Input Section */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Input Source</h2>
            
            {/* Movement Skill Input */}
            <div className="mb-4">
              <label htmlFor="movement-skill" className="block text-sm font-medium text-slate-300 mb-2">
                Movement Skill (Optional)
              </label>
              <input
                id="movement-skill"
                type="text"
                value={userDeclaredSkill}
                onChange={(e) => setUserDeclaredSkill(e.target.value)}
                placeholder="e.g., Squat, Overhand Throw, Kick..."
                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <p className="mt-2 text-xs text-slate-500">
                Specify the movement to guide the AI analysis. Leave blank for automatic detection.
              </p>
            </div>

            <VideoPlayer
              onFrameCapture={handleFrameCapture}
              onMultiFrameCapture={handleMultiFrameCapture}
              onMultiFrameSnapshot={handleMultiFrameSnapshot}
              isAnalyzing={status === AnalysisStatus.ANALYZING}
              currentPose={currentPose}
            />

            {status === AnalysisStatus.ERROR && (
              <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200 text-sm">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Frame Snapshots Section */}
          {frameSnapshots.length > 0 && (
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Frame Snapshots ({frameSnapshots.length})</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadAllSnapshots}
                    className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download All
                  </button>
                  <button
                    onClick={() => setFrameSnapshots([])}
                    className="text-xs px-3 py-1.5 text-slate-400 hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {frameSnapshots.map((snapshot, idx) => (
                  <div 
                    key={idx} 
                    className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden hover:border-blue-500 transition-colors cursor-pointer group"
                    onClick={() => handleViewSnapshot(snapshot)}
                  >
                    <div className="relative aspect-video bg-black">
                      <img src={snapshot.frameImage} alt={`Frame ${idx + 1}`} className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="text-white text-sm font-semibold flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </div>
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-slate-400 font-mono">
                          {snapshot.timestamp.toFixed(2)}s
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadSnapshot(snapshot, idx);
                          }}
                          className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                          title="Download"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
                      {snapshot.angles.length > 0 && (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          {snapshot.angles.map(({ joint, angle }) => (
                            <div key={joint} className="flex justify-between items-center">
                              <span className="text-slate-400 text-[10px]">{joint.replace('Right ', 'R ').replace('Left ', 'L ')}</span>
                              <span className="text-green-400 font-mono font-semibold">{Math.round(angle)}°</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Snapshot Modal */}
          {showSnapshotModal && selectedSnapshot && (
            <div 
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowSnapshotModal(false)}
            >
              <div 
                className="bg-slate-800 rounded-2xl border border-slate-700 max-w-5xl w-full max-h-[90vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                  <h3 className="text-lg font-semibold text-white">Frame Analysis</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const idx = frameSnapshots.indexOf(selectedSnapshot);
                        handleDownloadSnapshot(selectedSnapshot, idx);
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                    <button
                      onClick={() => setShowSnapshotModal(false)}
                      className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Modal Content */}
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Image */}
                    <div className="lg:col-span-2">
                      <div className="bg-black rounded-lg overflow-hidden">
                        <img 
                          src={selectedSnapshot.frameImage} 
                          alt="Frame snapshot" 
                          className="w-full h-auto"
                        />
                      </div>
                      <div className="mt-3 text-sm text-slate-400 font-mono">
                        Timestamp: {selectedSnapshot.timestamp.toFixed(2)}s
                      </div>
                    </div>

                    {/* Angle Data */}
                    <div className="bg-slate-900 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Activity size={16} className="text-blue-400" />
                        Joint Angles
                      </h4>
                      <div className="space-y-3">
                        {selectedSnapshot.angles.map(({ joint, angle }) => (
                          <div key={joint} className="flex items-center justify-between">
                            <span className="text-slate-300 text-sm">{joint}</span>
                            <span className="text-green-400 font-mono font-bold text-lg">{Math.round(angle)}°</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Analysis Results Section */}
          {status === AnalysisStatus.IDLE && frameSnapshots.length === 0 && (
            <div className="bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-700 p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <BrainCircuit size={40} className="text-slate-600" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Ready to Analyze</h3>
                <p className="text-slate-400 max-w-md mb-6">
                  Upload a video of any movement or exercise. KinetixLab will identify the movement, 
                  measure joint angles, and provide objective biomechanical analysis.
                </p>
                <div className="flex gap-4 text-xs text-slate-500 uppercase tracking-widest font-semibold">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Pose Tracking</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Multi-Frame</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500"></span> Biomechanics</span>
                </div>
              </div>
            </div>
          )}

          {status === AnalysisStatus.ANALYZING && (
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="relative w-24 h-24 mb-6">
                  <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <BrainCircuit size={32} className="text-blue-400" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-white animate-pulse">Processing Biomechanics...</h3>
                <p className="text-slate-400 mt-2 max-w-sm">Measuring joint angles, comparing to the "Gold Standard", and referencing the FMS Checklist.</p>
              </div>
            </div>
          )}

          {status === AnalysisStatus.COMPLETE && analysisResult && (
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
              <AnalysisDashboard data={analysisResult.feedback} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
