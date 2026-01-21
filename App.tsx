import React, { useState } from 'react';
import { BrainCircuit, Info } from 'lucide-react';
import VideoPlayer from './components/VideoPlayer';
import AnalysisDashboard from './components/AnalysisDashboard';
import { analyzeFrame } from './services/geminiService';
import { AnalysisStatus, AnalysisResponse } from './types';

const App: React.FC = () => {
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFrameCapture = async (base64Frame: string) => {
    setStatus(AnalysisStatus.ANALYZING);
    setErrorMessage(null);

    try {
      const result = await analyzeFrame(base64Frame);
      setAnalysisResult(result);
      setStatus(AnalysisStatus.COMPLETE);
    } catch (error) {
      console.error(error);
      setStatus(AnalysisStatus.ERROR);
      setErrorMessage("Failed to analyze the frame. Please check your API key and try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
              <BrainCircuit className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">BioMechanic<span className="text-blue-500">AI</span></h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Video Analysis Suite</p>
            </div>
          </div>
          <button 
             className="p-2 text-slate-400 hover:text-white transition-colors"
             title="About"
          >
             <Info size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Column: Video & Controls */}
        <div className="xl:col-span-5 flex flex-col gap-6">
           <div className="sticky top-24">
              <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white mb-1">Input Source</h2>
                  <p className="text-sm text-slate-400">Upload video, scrub to the key movement, and click Analyze.</p>
              </div>
              <VideoPlayer 
                onFrameCapture={handleFrameCapture} 
                isAnalyzing={status === AnalysisStatus.ANALYZING} 
              />
              
              {status === AnalysisStatus.ERROR && (
                <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200 text-sm animate-pulse">
                  {errorMessage}
                </div>
              )}
           </div>
        </div>

        {/* Right Column: Analysis Results */}
        <div className="xl:col-span-7">
           {status === AnalysisStatus.IDLE && (
             <div className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                   <BrainCircuit size={40} className="text-slate-600" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Ready to Analyze</h3>
                <p className="text-slate-400 max-w-md">
                  Upload a video of an exercise (e.g., Squat, Handstand, Swing). 
                  Our AI biomechanist will identify the movement, measure joint angles, and provide coaching feedback.
                </p>
             </div>
           )}

           {status === AnalysisStatus.ANALYZING && (
             <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-800/50 rounded-2xl border border-slate-700">
                <div className="relative w-24 h-24 mb-6">
                    <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                </div>
                <h3 className="text-xl font-semibold text-white animate-pulse">Processing Biomechanics...</h3>
                <p className="text-slate-400 mt-2">Reading articles, calculating vectors, and consulting the "virtual textbook".</p>
             </div>
           )}

           {status === AnalysisStatus.COMPLETE && analysisResult && (
             <AnalysisDashboard data={analysisResult.feedback} />
           )}
        </div>
      </main>
    </div>
  );
};

export default App;
