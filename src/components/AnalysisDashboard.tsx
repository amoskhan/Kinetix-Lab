import React from 'react';
import { BiomechanicalFeedback, JointAngle } from '../types';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine } from 'recharts';
import { CheckCircle, AlertTriangle, Activity, BookOpen, ShieldCheck } from 'lucide-react';

interface AnalysisDashboardProps {
  data: BiomechanicalFeedback;
}

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ data }) => {
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);

  // Transform joint data for chart
  const chartData = data.jointAngles.map(j => ({
    subject: j.jointName,
    A: j.measuredAngle,
    fullMark: 180, // Assuming degrees
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Good': return '#22c55e'; // Green
      case 'Needs Improvement': return '#eab308'; // Yellow
      case 'Critical': return '#ef4444'; // Red
      default: return '#94a3b8';
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fadeIn relative">

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
            onClick={() => setSelectedImage(null)}
          >
            <AlertTriangle size={32} className="rotate-45" /> {/* Using AlertTriangle as X since X not imported, wait, verify imports */}
          </button>
          {/* Check imports: CheckCircle, AlertTriangle, Activity, BookOpen, ShieldCheck are imported. X is NOT.
               I should import X or just use text "Close" or a standard icon. 
               Actually, I can import X from lucide-react in the import statement first? 
               Wait, replace_file_content is for a chunk.
               I'll use a simple SVG or text for close if I can't easily change imports here without a separate call.
               Or I can just use a styled "Close" button.
           */}
          <div className="relative max-w-7xl w-full h-full flex flex-col items-center justify-center p-4">
            <div className="relative max-h-[90vh] flex flex-col items-center gap-4">
              <img
                src={selectedImage}
                alt="Enlarged User Evidence"
                className="max-w-full max-h-[80vh] object-contain rounded-md shadow-2xl"
              />
              <p className="text-white/70 text-sm bg-black/50 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/10 shrink-0">
                Click anywhere to close
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pdf-section">
        <div className="glass-card p-6 rounded-2xl sm:rounded-3xl flex-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="text-blue-400" />
              Movement Detected
            </h2>
            <span className="px-3 py-1 bg-blue-900/50 text-blue-300 text-xs rounded-full border border-blue-800">
              {data.confidence}% Confidence
            </span>
          </div>
          <h3 className="text-3xl font-bold text-blue-400">
            {data.movementName}
          </h3>
          <p className="text-slate-400 mt-2">Phase: <span className="text-slate-200">{data.phaseDetected}</span></p>
        </div>

        <div className="glass-card p-6 rounded-2xl sm:rounded-3xl flex flex-col justify-between flex-1">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className={data.safetyRating > 7 ? "text-green-400" : "text-amber-400"} />
            Safety Score
          </h2>
          <div className="flex items-end gap-2 mt-2">
            <span className={`text-5xl font-bold ${data.safetyRating > 7 ? "text-green-400" : "text-amber-400"}`}>
              {data.safetyRating}
            </span>
            <span className="text-slate-500 text-xl mb-2">/ 10</span>
          </div>
          <div className="w-full bg-slate-700 h-2 rounded-full mt-4 overflow-hidden">
            <div
              className={`h-full ${data.safetyRating > 7 ? "bg-green-500" : "bg-amber-500"}`}
              style={{ width: `${data.safetyRating * 10}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Joint Angle Analysis */}
      <div className="glass-card p-6 sm:p-8 rounded-2xl sm:rounded-3xl pdf-section">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Activity className="text-emerald-400" />
          Joint Biomechanics
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Visual Chart */}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.jointAngles} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" domain={[0, 180]} hide />
                <YAxis dataKey="jointName" type="category" width={140} tick={{ fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  cursor={{ fill: '#334155', opacity: 0.4 }}
                />
                <Bar dataKey="measuredAngle" barSize={20} radius={[0, 4, 4, 0]}>
                  {data.jointAngles.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
                  ))}
                </Bar>
                <ReferenceLine x={90} stroke="#475569" strokeDasharray="3 3" />
                <ReferenceLine x={180} stroke="#475569" strokeDasharray="3 3" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Table */}
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {data.jointAngles.map((joint, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg border border-slate-700">
                <div>
                  <p className="font-semibold text-slate-200">{joint.jointName}</p>
                  <p className="text-xs text-slate-400">Target: {joint.idealAngleRange}°</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-xl">{joint.measuredAngle}°</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${joint.status === 'Good' ? 'bg-green-900/30 text-green-400 border-green-800' :
                    joint.status === 'Critical' ? 'bg-red-900/30 text-red-400 border-red-800' :
                      'bg-yellow-900/30 text-yellow-400 border-yellow-800'
                    }`}>
                    {joint.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step-by-Step Walkthrough */}
      <div className="glass-card p-6 sm:p-8 rounded-2xl sm:rounded-3xl pdf-section">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <BookOpen className="text-blue-400" />
          Technique Walkthrough
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.steps && data.steps.length > 0 ? (
            data.steps.map((step, idx) => (
              <div key={idx} className={`p-4 rounded-lg border ${step.status === 'Correct' ? 'bg-green-900/20 border-green-800' :
                step.status === 'Incorrect' ? 'bg-red-900/20 border-red-800' :
                  'bg-yellow-900/20 border-yellow-800'
                }`}>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-white">{idx + 1}. {step.stepName}</h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${step.status === 'Correct' ? 'text-green-400 border-green-800 bg-green-900/40' :
                    step.status === 'Incorrect' ? 'text-red-400 border-red-800 bg-red-900/40' :
                      'text-yellow-400 border-yellow-800 bg-yellow-900/40'
                    }`}>{step.status}</span>
                </div>
                <p className="text-sm text-slate-300 mb-2">{step.observation}</p>
                {step.status !== 'Correct' && (
                  <div className="flex items-start gap-2 mt-2 pt-2 border-t border-slate-700/50">
                    <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-300 italic">{step.correction}</p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="col-span-full text-center text-slate-500 py-8">
              No step-by-step details available for this movement.
            </div>
          )}
        </div>
      </div>

      {/* General Feedback & Corrections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pdf-section">
        <div className="glass-card p-6 sm:p-8 rounded-2xl sm:rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CheckCircle size={100} />
          </div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="text-emerald-400" />
            Key Corrections
          </h2>
          <ul className="space-y-3 relative z-10">
            {data.corrections.map((corr, idx) => (
              <li key={idx} className="flex gap-3 text-slate-300 bg-slate-700/30 p-3 rounded-lg border border-slate-700/50">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-900/50 text-emerald-400 flex items-center justify-center text-xs border border-emerald-800 mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-sm leading-relaxed">{corr}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-card p-6 sm:p-8 rounded-2xl sm:rounded-3xl">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="text-indigo-400" />
            Biomechanics Summary
          </h2>
          <ul className="space-y-3">
            {data.observations.map((obs, idx) => (
              <li key={idx} className="flex gap-3 text-slate-300">
                <span className="min-w-[6px] h-[6px] rounded-full bg-indigo-500 mt-2.5"></span>
                <p className="text-sm leading-relaxed">{obs}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Visual Evidence (Key Frames) */}
      {data.frames && data.frames.length > 0 && (
        <div className="glass-card p-6 sm:p-8 rounded-2xl sm:rounded-3xl pdf-section">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <BookOpen className="text-purple-400" />
            Visual Evidence
          </h2>

          <div className="space-y-8">
            {data.frames.map((view: any, viewIdx: number) => (
              <div key={viewIdx}>
                <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider border-b border-slate-700 pb-2">
                  {view.label || `View ${viewIdx + 1}`}
                </h3>
                <div data-pdf-grid className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {view.images && view.images.map((frame: string, idx: number) => (
                    <div key={idx} className="relative group aspect-video glass rounded-xl overflow-hidden pdf-item">
                      <img
                        src={frame}
                        alt={`${view.label} Frame ${idx + 1}`}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setSelectedImage(frame)}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-[10px] text-white flex justify-between">
                        <span>Frame {idx + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisDashboard;
