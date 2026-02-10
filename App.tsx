
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PayrollInput, 
  PayrollOutput, 
  Sector, 
  AppTab, 
  AdjustmentType, 
  WorkStatus,
  RiskLevel,
  WorkingStatus,
  ActivityLevel
} from './types';
import { calculatePayroll } from './services/geminiService';
import Header from './components/Header';
import StatCard from './components/StatCard';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';

const INITIAL_INPUT: PayrollInput = {
  employee_id: 'EM001',
  sector: Sector.MINING,
  check_in_time: '09:00',
  current_time: '17:30'
};

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('calculator');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [input, setInput] = useState<PayrollInput>(INITIAL_INPUT);
  const [history, setHistory] = useState<PayrollOutput[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<PayrollOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('payroll_history_v3');
    if (saved) setHistory(JSON.parse(saved));
    
    const theme = localStorage.getItem('theme');
    if (theme === 'light') setIsDarkMode(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('payroll_history_v3', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Camera Setup
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (activeTab === 'calculator') {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(s => {
          stream = s;
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(err => console.error("Camera access denied", err));
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [activeTab]);

  const captureImage = (): string | null => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        return canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Strict Rule: One ID can access only one time
    const isDuplicate = history.some(h => h.employee_id === input.employee_id && h.authorized);
    if (isDuplicate) {
      setError(`ACCESS DENIED: Employee ${input.employee_id} has already completed verification. Multiple shift entries are prohibited.`);
      setIsLoading(false);
      return;
    }

    // Client-side quick ID format check
    const idMatch = input.employee_id.match(/^EM(\d+)$/);
    if (!idMatch) {
      setError("INVALID ID: ID must follow the format 'EM###' (e.g., EM001).");
      setIsLoading(false);
      return;
    }
    
    const idNum = parseInt(idMatch[1]);
    if (idNum < 1 || idNum > 100) {
      setError(`UNAUTHORIZED: ID ${input.employee_id} is outside the valid workforce range (EM001-EM100).`);
      setIsLoading(false);
      return;
    }

    try {
      const worker_image = captureImage();
      const result = await calculatePayroll({ ...input, worker_image: worker_image || undefined });
      
      // Double check authorization from AI response
      if (result.authorized) {
        setCurrentResult(result);
        setHistory(prev => [result, ...prev].slice(0, 50));
      } else {
        setError(`SUPERVISOR ALERT: Identity ${input.employee_id} was rejected by Phoenix AI protocols.`);
        setCurrentResult(result);
        setHistory(prev => [result, ...prev].slice(0, 50));
      }
    } catch (err: any) {
      setError(err.message || "Phoenix AI Verification failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (history.length === 0) return null;
    const totalSalary = history.reduce((acc, curr) => acc + curr.final_salary, 0);
    const avgEfficiency = history.reduce((acc, curr) => acc + (curr.efficiency_percentage || 0), 0) / history.length;
    const highRiskCount = history.filter(h => h.risk_level === RiskLevel.HIGH || h.risk_level === RiskLevel.CRITICAL).length;
    const unauthorizedCount = history.filter(h => !h.authorized).length;
    
    const sectorData = Object.values(Sector).map(s => ({
      name: s,
      total: history.filter(h => h.sector === s).reduce((acc, curr) => acc + curr.final_salary, 0)
    }));

    const riskData = [
      { name: 'Low/None', value: history.filter(h => h.risk_level === RiskLevel.LOW || h.risk_level === RiskLevel.NONE).length },
      { name: 'Medium', value: history.filter(h => h.risk_level === RiskLevel.MEDIUM).length },
      { name: 'High', value: history.filter(h => h.risk_level === RiskLevel.HIGH).length },
      { name: 'Critical', value: history.filter(h => h.risk_level === RiskLevel.CRITICAL).length },
    ];

    return { totalSalary, avgEfficiency, highRiskCount, unauthorizedCount, sectorData, riskData };
  }, [history]);

  const RISK_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200 flex flex-col">
      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isDarkMode={isDarkMode} 
        toggleDarkMode={() => setIsDarkMode(!isDarkMode)} 
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'calculator' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Section */}
            <section className="space-y-6">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center">
                  <span className="w-2 h-6 bg-primary-600 rounded-full mr-3"></span>
                  Workforce Monitoring Terminal
                </h2>
                
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden mb-6 border-2 border-slate-200 dark:border-slate-700 shadow-inner">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Overlay UI */}
                  <div className="absolute top-4 left-4 px-3 py-1 bg-red-600/90 backdrop-blur-md rounded-full flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Supervisor Active</span>
                  </div>
                  
                  <div className="absolute inset-0 pointer-events-none border-[1px] border-white/5 flex items-center justify-center">
                    <div className="w-64 h-64 border-[1px] border-primary-500/40 rounded-3xl relative">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary-400 rounded-tl-lg"></div>
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary-400 rounded-tr-lg"></div>
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary-400 rounded-bl-lg"></div>
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary-400 rounded-br-lg"></div>
                    </div>
                  </div>

                  <div className="absolute bottom-4 right-4 text-white/50 text-[10px] font-mono bg-black/40 px-2 py-1 rounded">
                    SYS_V2.6.4_L{Math.random().toString(16).slice(2, 6).toUpperCase()}
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Manual Employee ID</label>
                      <input 
                        type="text" 
                        value={input.employee_id}
                        onChange={e => setInput({...input, employee_id: e.target.value.toUpperCase()})}
                        placeholder="EM###"
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-slate-900 dark:text-white font-mono placeholder:opacity-30"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Assigned Sector</label>
                      <select 
                        value={input.sector}
                        onChange={e => setInput({...input, sector: e.target.value as Sector})}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-slate-900 dark:text-white"
                      >
                        {Object.values(Sector).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Shift Check-in</label>
                      <input 
                        type="time" 
                        value={input.check_in_time}
                        onChange={e => setInput({...input, check_in_time: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Verification Time</label>
                      <input 
                        type="time" 
                        value={input.current_time}
                        onChange={e => setInput({...input, current_time: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  <button 
                    disabled={isLoading}
                    type="submit"
                    className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-white font-black rounded-xl shadow-lg shadow-primary-500/30 transition-all transform active:scale-[0.98] flex items-center justify-center space-x-3 uppercase tracking-[0.2em] text-sm"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Scanning & Calculating...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 11c0-1.894-.523-3.665-1.436-5.182M12 11c0-5.523 4.477-10 10-10m0 0l-1.5 1.5M22 1l-1.5 1.5M10.5 5.818a10.003 10.003 0 00-6.104 9.092l.054.09m3.44-2.04C6.149 10.138 6 8.591 6 7.151c0-2.636 1.018-5.034 2.684-6.818" />
                        </svg>
                        <span>Perform Supervision</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </section>

            {/* Results Section */}
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 min-h-[600px] flex flex-col relative overflow-hidden">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Supervisor Output Analysis</h2>
              
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl mb-6 shadow-md border-l-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {currentResult ? (
                <div className="flex-1 space-y-6 animate-in fade-in zoom-in-95 duration-500">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Access Status</p>
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full shadow-[0_0_8px] ${currentResult.authorized ? 'bg-green-500 shadow-green-500/50' : 'bg-red-500 shadow-red-500/50'}`}></div>
                        <span className={`font-black text-sm ${currentResult.authorized ? 'text-green-600' : 'text-red-600'}`}>
                          {currentResult.authorized ? 'AUTHORIZED' : 'DENIED'}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Risk Evaluation</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black inline-block ${
                        currentResult.risk_level === RiskLevel.CRITICAL ? 'bg-red-600 text-white' :
                        currentResult.risk_level === RiskLevel.HIGH ? 'bg-orange-500 text-white' :
                        currentResult.risk_level === RiskLevel.MEDIUM ? 'bg-yellow-400 text-slate-900' :
                        'bg-emerald-500 text-white'
                      }`}>
                        {currentResult.risk_level.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'HELMET', value: currentResult.helmet },
                      { label: 'SAFETY VEST', value: currentResult.vest },
                      { label: 'PRESENCE', value: currentResult.human_detected }
                    ].map(item => (
                      <div key={item.label} className={`flex flex-col items-center justify-center p-3 rounded-xl border ${item.value ? 'border-emerald-100 dark:border-emerald-900/20 bg-emerald-50/30 dark:bg-emerald-900/5' : 'border-red-100 dark:border-red-900/20 bg-red-50/30 dark:bg-red-900/5'}`}>
                        <p className={`text-[9px] font-black mb-2 tracking-tighter ${item.value ? 'text-emerald-600' : 'text-red-600'}`}>{item.label}</p>
                        {item.value ? (
                          <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                        ) : (
                          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-6 bg-slate-900 rounded-2xl border border-slate-700 relative shadow-2xl overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 blur-[60px] rounded-full group-hover:bg-primary-500/20 transition-all duration-700"></div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <p className="text-[10px] font-black text-primary-400 uppercase tracking-widest mb-1">Final Payroll Calculation</p>
                          <h3 className="text-5xl font-black text-white tabular-nums">${currentResult.final_salary.toFixed(2)}</h3>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Productivity</p>
                          <p className="text-2xl font-black text-emerald-400">{currentResult.efficiency_percentage}%</p>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ease-out rounded-full ${
                            currentResult.efficiency_percentage >= 90 ? 'bg-emerald-500' :
                            currentResult.efficiency_percentage >= 50 ? 'bg-primary-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${currentResult.efficiency_percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-800">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Activity</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">{currentResult.activity_level.replace('_', ' ')}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-800">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Work Hrs</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">{currentResult.hours_worked}H</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-800">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Rate</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">${currentResult.hourly_rate}/H</p>
                    </div>
                  </div>

                  <div className="p-4 bg-primary-50/50 dark:bg-primary-900/5 rounded-xl border-l-4 border-primary-500">
                    <div className="flex items-center space-x-2 mb-1">
                      <svg className="w-3 h-3 text-primary-500" fill="currentColor" viewBox="0 0 20 20"><path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/></svg>
                      <span className="text-[10px] font-black text-primary-600 dark:text-primary-400 tracking-widest uppercase">System Explanation</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">
                      "{currentResult.explanation}"
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-30 select-none">
                  <div className="w-32 h-32 mb-6 border-2 border-dashed border-slate-400 rounded-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-lg font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em]">Target Missing</p>
                  <p className="text-xs mt-2 font-medium">Visual verification required for payroll release.</p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Overview */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                  label="Verified Payroll Total" 
                  value={`$${stats.totalSalary.toLocaleString()}`} 
                  icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                />
                <StatCard 
                  label="Mean Workforce Efficiency" 
                  value={`${stats.avgEfficiency.toFixed(1)}%`} 
                  trend={{ value: 2.1, isPositive: true }}
                  icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                />
                <StatCard 
                  label="Incident Alerts" 
                  value={stats.highRiskCount} 
                  icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                />
                <StatCard 
                  label="Entry Denials" 
                  value={stats.unauthorizedCount} 
                  icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Log Table */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                  <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] text-xs">Verification Archives</h3>
                  <button 
                    onClick={() => { if(confirm('Purge history?')) setHistory([]); }}
                    className="text-[10px] text-red-500 hover:text-red-700 dark:hover:text-red-400 font-black tracking-widest border border-red-200 dark:border-red-900/40 px-3 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                  >
                    PURGE RECORDS
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/30 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        <th className="px-6 py-4">Asset ID</th>
                        <th className="px-6 py-4">Risk Level</th>
                        <th className="px-6 py-4">Efficiency</th>
                        <th className="px-6 py-4">Shift Status</th>
                        <th className="px-6 py-4 text-right">Payroll Output</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {history.length > 0 ? history.map((h, i) => (
                        <tr key={i} className="text-sm hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-black text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">{h.employee_id}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{h.sector}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                              h.risk_level === RiskLevel.CRITICAL ? 'bg-red-600 text-white shadow-sm shadow-red-500/30' :
                              h.risk_level === RiskLevel.HIGH ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30' :
                              'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                            }`}>
                              {h.risk_level.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs font-bold">{h.efficiency_percentage}%</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-tighter ${
                              h.work_status === WorkStatus.FULL_DAY ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400'
                            }`}>
                              {h.work_status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-black text-primary-600 dark:text-primary-400">
                            ${h.final_salary.toFixed(2)}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic font-medium tracking-wide">Empty archive. Supervisor active for new data.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sidebar Charts */}
              <div className="space-y-8">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <h3 className="font-black text-slate-900 dark:text-white mb-6 uppercase tracking-widest text-[10px]">Sector Weighting</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.sectorData || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                        <XAxis dataKey="name" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                          cursor={{fill: isDarkMode ? '#334155' : '#f1f5f9'}}
                        />
                        <Bar dataKey="total" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <h3 className="font-black text-slate-900 dark:text-white mb-6 uppercase tracking-widest text-[10px]">Compliance Distribution</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats?.riskData || []}
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {(stats?.riskData || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={RISK_COLORS[index % RISK_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                           contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', border: 'none', borderRadius: '8px', fontSize: '10px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4">
                      {stats?.riskData.map((item, idx) => (
                        <div key={item.name} className="flex items-center space-x-2">
                          <div className="w-2 h-2 rounded-full" style={{backgroundColor: RISK_COLORS[idx % RISK_COLORS.length]}} />
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{item.name}</span>
                          <span className="text-[9px] font-black text-slate-900 dark:text-white ml-auto">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto py-8 px-4 border-t border-slate-200 dark:border-slate-800 text-center bg-white dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="flex flex-col items-center space-y-3">
          <div className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 group-hover:bg-primary-600">
               <svg className="w-6 h-6 text-slate-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
               </svg>
            </div>
            <div className="text-left">
              <span className="block text-[10px] font-black uppercase tracking-[0.4em] text-primary-600 dark:text-primary-400 leading-none mb-1">MineGuard Core</span>
              <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Security Hardware Protocol 1.0.4</span>
            </div>
          </div>
          <div className="flex flex-col space-y-1">
            <p className="text-sm text-slate-900 dark:text-slate-100 font-bold tracking-tight">
              © 2026 Phoenix. All Rights Reserved.
            </p>
            <p className="text-[10px] text-slate-500 font-medium tracking-[0.2em] uppercase">
              Decentralized Workforce Supervision Infrastructure
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
