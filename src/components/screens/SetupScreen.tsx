import React from 'react';
import { Layers, Square, Grid } from 'lucide-react';
import { ViewMode } from '../../types';

interface SetupScreenProps {
    setViewMode: (mode: ViewMode) => void;
    setCaptureWindow: (frames: number) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ setViewMode, setCaptureWindow }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-500">
            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl max-w-2xl w-full text-center">
                <div className="w-20 h-20 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Layers size={40} />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">Start Analysis</h2>
                <p className="text-slate-400 mb-8 max-w-md mx-auto">
                    Select your video configuration. Using two angles (Front & Side) provides the most accurate AI biomechanics analysis.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        onClick={() => setViewMode('single')}
                        className="group p-6 bg-slate-900 border border-slate-700 rounded-xl hover:border-blue-500 hover:bg-slate-800 transition-all text-left"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <Square size={24} className="text-blue-400" />
                            <span className="text-xs font-mono text-slate-500 group-hover:text-blue-400">BASIC</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">Single View</h3>
                        <p className="text-sm text-slate-400">Analyze movement from a single camera angle.</p>
                    </button>

                    <button
                        onClick={() => {
                            setViewMode('dual');
                            // On mobile use 5 frames (vs 10) to keep payloads manageable
                            const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
                            setCaptureWindow(isMobile ? 5 : 10);
                        }}
                        className="group p-6 bg-slate-900 border border-slate-700 rounded-xl hover:border-purple-500 hover:bg-slate-800 transition-all text-left relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-1 bg-purple-600 text-[10px] font-bold text-white rounded-bl-lg">RECOMMENDED</div>
                        <div className="flex items-center justify-between mb-4">
                            <Grid size={24} className="text-purple-400" />
                            <span className="text-xs font-mono text-slate-500 group-hover:text-purple-400">PRO</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">Dual View</h3>
                        <p className="text-sm text-slate-400">Sync Front & Side views for 3D biomechanics.</p>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SetupScreen;
