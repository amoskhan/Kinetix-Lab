import React from 'react';
import { BrainCircuit, History as HistoryIcon } from 'lucide-react';

interface NavbarProps {
    showHistory: boolean;
    setShowHistory: (show: boolean) => void;
}

const Navbar: React.FC<NavbarProps> = ({ showHistory, setShowHistory }) => {
    return (
        <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
                        <BrainCircuit className="text-white" size={20} />
                    </div>
                    <div>
                        <h1 className="text-base sm:text-xl font-bold tracking-tight text-white">Kinetix<span className="text-blue-500">Lab</span></h1>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-semibold hidden sm:block">Video Analysis Suite</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`p-2 rounded-md transition-colors flex items-center gap-1 sm:gap-2 ${showHistory ? 'text-blue-400 bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                    >
                        <HistoryIcon size={18} className="sm:w-5 sm:h-5" />
                        <span className="hidden sm:inline text-sm font-medium">History</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
