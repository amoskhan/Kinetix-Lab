import React from 'react';
import { X } from 'lucide-react';
import { HistoryItem } from '../../types';

interface HistorySidebarProps {
    history: HistoryItem[];
    showHistory: boolean;
    setShowHistory: (show: boolean) => void;
    loadHistoryItem: (item: HistoryItem) => void;
    handleTestStorage: () => void;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({
    history,
    showHistory,
    setShowHistory,
    loadHistoryItem,
    handleTestStorage
}) => {
    if (!showHistory) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setShowHistory(false)} />
            <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 bg-slate-800 border-l border-slate-700 shadow-2xl p-4 overflow-y-auto transform transition-transform">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-white">Analysis History</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleTestStorage}
                            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded"
                        >
                            Test Storage
                        </button>
                        <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                    </div>
                </div>
                <div className="space-y-4">
                    {history.length === 0 ? (
                        <p className="text-slate-500 text-center text-sm py-8">No history found.</p>
                    ) : (
                        history.map((item) => (
                            <div key={item.id} onClick={() => loadHistoryItem(item)} className="group p-3 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-blue-500 cursor-pointer transition-all">
                                <div className="flex gap-3">
                                    <div className="w-16 h-16 bg-black rounded-md overflow-hidden flex-shrink-0">
                                        {item.video_url ? (
                                            <img src={item.video_url} className="w-full h-full object-cover" alt="Thumb" />
                                        ) : (
                                            <div className="w-full h-full bg-slate-800" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-medium text-white truncate">{item.movement_name || "Untitled Analysis"}</h4>
                                        <p className="text-xs text-blue-400 truncate">{item.analysis_data?.feedback?.phaseDetected || "Completed"}</p>
                                        <p className="text-[10px] text-slate-500 mt-1">{new Date(item.created_at || "").toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
};

export default HistorySidebar;
