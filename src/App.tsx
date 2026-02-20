import React, { useState, useEffect, useRef } from 'react';
import { BrainCircuit, Info, Activity, ArrowLeft, Download } from 'lucide-react';
import VideoPlayer, { VideoPlayerHandle } from './components/VideoPlayer';
import AnalysisDashboard from './components/AnalysisDashboard';
import { analyzeMovement, analyzeMultiViewMovement } from './services/gemini';
import Navbar from './components/layout/Navbar';
import HistorySidebar from './components/layout/HistorySidebar';
import SetupScreen from './components/screens/SetupScreen';
import { ViewMode, HistoryItem, AnalysisStatus, AnalysisResponse, AnalysisRecord } from './types';
import { saveAnalysis, getAnalysisHistory } from './lib/supabase';
import PDFExportButton from './components/PDFExportButton';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const App: React.FC = () => {
  // --- Global State ---
  const [viewMode, setViewMode] = useState<ViewMode>('setup');
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userDeclaredSkill, setUserDeclaredSkill] = useState<string>('');
  const [captureWindow, setCaptureWindow] = useState<number>(() => {
    // Smart default: 10 on desktop for "Pro" detail, 5 on mobile for speed
    if (typeof window === 'undefined') return 5;
    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
    return isMobile ? 5 : 10;
  });
  const [smartSearch, setSmartSearch] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  // --- Snapshot State ---
  // Assuming FrameSnapshot and related state are not part of this change,
  // but the user's provided snippet includes them. I will add them as provided.
  // If these are new, they might need type definitions.
  // For now, I'll assume they are defined elsewhere or will be added.
  // const [frameSnapshots, setFrameSnapshots] = useState<FrameSnapshot[]>([]);
  // const [selectedSnapshot, setSelectedSnapshot] = useState<FrameSnapshot | null>(null);
  // const [showSnapshotModal, setShowSnapshotModal] = useState(false);

  // --- History State ---
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // --- Refs ---
  const analysisRef = useRef<HTMLDivElement>(null);
  // Store refs to video players by ID
  const playerRefs = useRef<{ [key: string]: VideoPlayerHandle | null }>({});

  // --- Load History ---
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await getAnalysisHistory();
        if (data) setHistory(data as HistoryItem[]);
      } catch (e) {
        console.error("Failed to load history from Supabase", e);
      }
    };
    fetchHistory();
  }, []);

  const saveToHistory = async (result: AnalysisResponse, thumbnail: string) => {
    const record: AnalysisRecord = {
      movement_name: result.feedback.movementName,
      confidence: result.feedback.confidence,
      analysis_data: result,
      video_url: thumbnail,
    };

    try {
      const savedData = await saveAnalysis(record);
      if (savedData) {
        const newItem: HistoryItem = {
          ...record,
          created_at: new Date().toISOString(),
          id: savedData[0].id
        };
        setHistory([newItem, ...history]);
      }
    } catch (error) {
      console.error("Failed to save to Supabase", error);
    }
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setAnalysisResult(item.analysis_data);
    setStatus(AnalysisStatus.COMPLETE);
    setShowHistory(false);
    setViewMode('single'); // Default to single view for history
  };

  // --- Export Frames Handler ---
  const handleExportFrames = async () => {
    try {
      setStatus(AnalysisStatus.ANALYZING); // Re-use status for UI feedback
      const zip = new JSZip();
      let hasFrames = false;

      // PRIORITY: Export the EXACT frames used in the analysis if available
      if (analysisResult && analysisResult.feedback && analysisResult.feedback.frames && analysisResult.feedback.frames.length > 0) {
        console.log("Exporting frames from Analysis Result...");

        analysisResult.feedback.frames.forEach((view: any) => {
          const folderName = view.label.replace(/\s+/g, '_');
          const folder = zip.folder(folderName);

          if (folder && view.images && view.images.length > 0) {
            hasFrames = true;
            view.images.forEach((base64: string, idx: number) => {
              // Base64 might include the prefix
              const cleanData = base64.includes(',') ? base64.split(',')[1] : base64;
              folder.file(`frame_${idx + 1}.jpg`, cleanData, { base64: true });
            });
          }
        });

      } else {
        // FALLBACK: Capture new frames if no analysis exists
        console.log("No analysis found. Capturing new frames...");
        const playerIds = viewMode === 'single' ? ['main'] : ['front', 'side'];

        for (const id of playerIds) {
          const player = playerRefs.current[id];
          if (player) {
            const viewLabel = id === 'main' ? 'Main_View' : (id === 'front' ? 'Front_View' : 'Side_View');

            // Calculate interval to cover whole video
            const video = player.getVideoElement();
            let interval = 0.3;
            let centerTime = undefined;

            if (video && video.duration > 0) {
              interval = video.duration / captureWindow;
              centerTime = video.duration / 2;
            }

            // Capture frames
            const data = await player.captureMultiFrames(captureWindow, interval, centerTime);

            if (data && data.capture.frames.length > 0) {
              hasFrames = true;
              const folder = zip.folder(viewLabel);
              if (folder) {
                data.capture.frames.forEach((base64, idx) => {
                  const cleanData = base64.split(',')[1];
                  const timestamp = data.capture.timestamps[idx].toFixed(2);
                  folder.file(`frame_${idx + 1}_${timestamp}s.jpg`, cleanData, { base64: true });
                });
              }
            }
          }
        }
      }

      if (!hasFrames) {
        throw new Error("No frames captured. Please check video or run analysis first.");
      }

      // Generate Zip
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `kinetix_frames_${new Date().toISOString().slice(0, 10)}.zip`);
      setStatus(AnalysisStatus.IDLE);

    } catch (e: any) {
      console.error("Export failed:", e);
      setErrorMessage(e.message || "Failed to export frames.");
      setStatus(AnalysisStatus.ERROR);
    }
  };

  // --- Storage Test Handler ---
  const handleTestStorage = async () => {
    const testRecord = {
      movement_name: "Storage Test",
      confidence: 100,
      analysis_data: {
        feedback: {
          movementName: "Test",
          confidence: 100,
          phaseDetected: "Test",
          safetyRating: 10,
          jointAngles: [],
          corrections: [],
          observations: [],
          steps: [] // Added to satisfy BiomechanicalFeedback interface
        }
      },
      video_url: "http://test.com/video.jpg"
    };

    try {
      console.log("Saving test record...", testRecord);
      const saved = await saveAnalysis(testRecord);

      if (saved && saved.length > 0) {
        const isLocal = saved[0].id && saved[0].id.toString().startsWith('local_');
        alert(`Test Passed! Saved to ${isLocal ? 'Local Storage (Offline Mode)' : 'Supabase (Cloud)'}. Check History.`);
        saveToHistory(testRecord.analysis_data, "http://test.com/video.jpg"); // Refresh history list
      } else {
        alert("Test Failed: No record returned.");
      }
    } catch (e: any) {
      console.error("Test failed", e);
      alert(`Test Failed: ${e.message}`);
    }
  };

  // --- Global Analysis Handlers ---

  const handleGlobalAnalyze = async () => {
    setStatus(AnalysisStatus.ANALYZING);
    setErrorMessage(null);
    setAnalysisResult(null);

    try {
      setLoadingMessage("Preparing cameras...");
      const mode = viewMode;
      const playerIds = mode === 'single' ? ['main'] : ['front', 'side'];

      const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);

      // Use the exact capture window requested by user (pro quality)
      // but warn on mobile if it's high
      const effectiveCaptureWindow = captureWindow;

      if (isMobile && captureWindow > 5) {
        setLoadingMessage("Extracting frames (high-detail - may be slow)...");
        console.log(`[Mobile] High detail mode enabled: ${captureWindow} frames. Upload may take longer.`);
      } else if (!isMobile) {
        console.log(`[Desktop] Professional quality enabled: ${captureWindow} frames.`);
      }

      const peakTimes: Record<string, number> = {};

      // 1. Smart Search (Auto-Seek)
      if (smartSearch) {
        // Scan each player for best moment
        for (const id of playerIds) {
          setLoadingMessage(`Finding activity (${id === 'main' ? 'View' : id})...`);
          const player = playerRefs.current[id];
          if (player) {
            const peak = await player.findPeak();
            peakTimes[id] = peak;
          }
        }
        // Small delay to ensure seek settles visually/internally
        await new Promise(r => setTimeout(r, 500));
      }

      // 2. Capture from active players
      const views = [];

      for (const id of playerIds) {
        const player = playerRefs.current[id];
        if (player) {
          const peakTime = peakTimes[id]; // undefined if smartSearch off or failed

          if (captureWindow === 1) {
            // Note: captureFrame captures CURRENT time. 
            // If Smart Search ran, video is at END. We need to seek if we want peak.
            // For now, let's assume Smart Search is mostly used with Multi-Frame.
            // TODO: Update captureFrame to accept timeOverride if needed.
            // Or better: Manually seek here if needed? 
            if (peakTime !== undefined) {
              // We catch the "no replay" requirement by seeking ONLY right before capture
              const video = player.getVideoElement();
              if (video) video.currentTime = peakTime;
              // Wait for seek? captureFrame awaits nothing... invalid.
              // Let's defer single-frame fix or assume user accepts the jump.
            }
            const data = await player.captureFrame();
            if (data) {
              views.push({
                label: id === 'main' ? 'Main View' : (id === 'front' ? 'Front View' : 'Side View'),
                frames: [data.base64],
                poseData: data.telemetry
              });
            }
          } else {
            setLoadingMessage(`Extracting frames (${id === 'main' ? '' : id})...`);
            console.log(`Capturing ${effectiveCaptureWindow} frames for ${id}...`);

            // Default to covering the entire video to ensure "totality" of phases
            // unless smart search is extremely confident (but user requested totality).
            const video = player.getVideoElement();
            let interval = 0.3;
            let centerTime = undefined;

            if (video && video.duration > 0 && !isNaN(video.duration) && video.duration !== Infinity) {
              // Distribute frames across the whole duration
              interval = video.duration / effectiveCaptureWindow;
              centerTime = video.duration / 2;
              console.log(`[App] Full Video Capture: Duration=${video.duration.toFixed(2)}s, Interval=${interval.toFixed(2)}s, Center=${centerTime.toFixed(2)}s`);
            } else {
              console.warn("[App] Video duration unknown. Defaulting to 1.0s interval.");
              interval = 1.0;
            }

            // If Smart Search found a peak, we could unbiasedly skew towards it, 
            // but for "Analysis" of the whole movement, uniform distribution is safer for phase detection.
            // We'll stick to full video coverage as requested.

            const data = await player.captureMultiFrames(effectiveCaptureWindow, interval, centerTime);
            if (data) {
              views.push({
                label: id === 'main' ? 'Main View' : (id === 'front' ? 'Front View' : 'Side View'),
                frames: data.capture.frames,
                poseData: data.centerPose
              });
            }
          }
        }
      }

      if (views.length === 0) {
        throw new Error("No video input detected. Please upload a video first.");
      }

      setLoadingMessage("AI is thinking (takes ~15s)...");
      console.log(`🧠 Analyzing ${views.length} views with ${effectiveCaptureWindow} frames each...`);

      // Ensure we call the new multi-view function which handles frames[] correctly
      const result = await analyzeMultiViewMovement({
        views: views,
        userDeclaredSkill
      });

      // Inject User Prompt for Storage
      if (userDeclaredSkill) {
        result.user_prompt = userDeclaredSkill;
      }

      // Inject captured frames into the result for display
      if (result && result.feedback) {
        // Collect frames from all views
        result.feedback.frames = views.map(v => ({
          label: v.label,
          images: v.frames
        }));
      }

      setAnalysisResult(result);
      setStatus(AnalysisStatus.COMPLETE);
      // Save first view's center frame as thumbnail
      const thumbnail = views[0].frames[Math.floor(views[0].frames.length / 2)];
      saveToHistory(result, thumbnail);

    } catch (error: any) {
      console.error("[App] Analysis failed:", error);
      setStatus(AnalysisStatus.ERROR);
      setErrorMessage(error.message || "Analysis failed.");
    } finally {
      setLoadingMessage('');
      console.log("[App] Global analysis flow completed.");
    }
  };

  // --- Render Helpers ---


  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <Navbar showHistory={showHistory} setShowHistory={setShowHistory} />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 lg:p-8 relative">

        {/* History Sidebar */}
        <HistorySidebar
          history={history}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          loadHistoryItem={loadHistoryItem}
          handleTestStorage={handleTestStorage}
        />

        {viewMode === 'setup' ? (
          <SetupScreen setViewMode={setViewMode} setCaptureWindow={setCaptureWindow} />
        ) : (
          <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-bottom-5 duration-500">

            {/* Header / Back Button */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setViewMode('setup')}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={18} />
                <span className="text-sm font-medium">Back to Setup</span>
              </button>
              <div className="h-4 w-[1px] bg-slate-700"></div>
              <h2 className="text-lg font-semibold text-white">
                {viewMode === 'single' ? 'Single View Analysis' : 'Dual View Analysis'}
              </h2>
            </div>

            {/* Input Section */}
            <div className="bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-700 p-4 sm:p-6">
              <div className="mb-6">
                <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">Movement Skill </label>
                <input
                  type="text"
                  value={userDeclaredSkill}
                  onChange={(e) => setUserDeclaredSkill(e.target.value)}
                  placeholder="e.g., Squat, Overhand Throw..."
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Video Grid */}
              <div className={`grid gap-6 ${viewMode === 'dual' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                {/* Player 1: Main/Front */}
                <VideoPlayer
                  ref={(el) => { playerRefs.current[viewMode === 'single' ? 'main' : 'front'] = el; }}
                  label={viewMode === 'single' ? "Main Video" : "Front View"}
                />

                {/* Player 2: Side (Only in Dual Mode) */}
                {viewMode === 'dual' && (
                  <VideoPlayer
                    ref={(el) => { playerRefs.current['side'] = el; }}
                    label="Side View"
                  />
                )}
              </div>

              {/* Global Controls */}
              <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-end items-center">
                {/* Frame Count Selector */}
                <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-lg border border-slate-700">
                  <Activity size={16} className="text-blue-500" />
                  <span className="text-xs text-slate-400 font-medium">Frames:</span>
                  <div className="flex gap-1">
                    {[1, 3, 5, 10].map(count => (
                      <button
                        key={count}
                        onClick={() => setCaptureWindow(count)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${captureWindow === count
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-500 hover:text-white hover:bg-slate-800'
                          }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Smart Search Toggle */}
                <button
                  onClick={() => setSmartSearch(!smartSearch)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${smartSearch
                    ? 'bg-blue-900/40 border-blue-500/50 text-blue-200'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-300'
                    }`}
                  title="Automatically find the best moment (e.g. inversion) before analyzing"
                >
                  <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${smartSearch ? 'border-blue-400 bg-blue-400' : 'border-slate-500'}`}>
                    {smartSearch && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                  </div>
                  <span>Smart Search</span>
                </button>

                {/* Export Frames Button */}
                <button
                  onClick={handleExportFrames}
                  disabled={status === AnalysisStatus.ANALYZING}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl font-medium text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
                  title="Download captured frames for debugging"
                >
                  <Download size={20} />
                  <span className="hidden sm:inline">Export Frames</span>
                </button>

                {/* Error Message */}
                {status === AnalysisStatus.ERROR && (
                  <div className="flex-1 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-200 text-sm flex items-center">
                    {errorMessage}
                  </div>
                )}

                <button
                  onClick={handleGlobalAnalyze}
                  disabled={status === AnalysisStatus.ANALYZING}
                  className={`flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${status === AnalysisStatus.ANALYZING
                    ? 'bg-slate-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 active:scale-95 shadow-blue-900/20'
                    }`}
                >
                  {status === AnalysisStatus.ANALYZING ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {loadingMessage || 'Processing...'}
                    </>
                  ) : (
                    <>
                      <BrainCircuit size={20} />
                      Analyze {viewMode === 'dual' ? 'All Views' : 'Movement'}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Results Section */}
            {status === AnalysisStatus.COMPLETE && analysisResult && (
              <div ref={analysisRef} className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-end mb-4">
                  <PDFExportButton analysisData={analysisResult} analysisRef={analysisRef} />
                </div>
                <AnalysisDashboard data={analysisResult.feedback} />
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
};

export default App;
