import Sidebar from '@/components/Sidebar';

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold">ALPR System Dashboard</h1>
            <p className="text-xs text-slate-400">Authenticated Operational Area</p>
          </div>
          <span className="px-3 py-1 rounded bg-emerald-950 text-emerald-400 text-xs font-semibold border border-emerald-800">
            System Status: Healthy
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="p-5 rounded-lg bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-400">Total Detections</p>
            <p className="text-3xl font-black text-sky-400 mt-2">0</p>
          </div>
          <div className="p-5 rounded-lg bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-400">Active Camera Feeds</p>
            <p className="text-3xl font-black text-sky-400 mt-2">0</p>
          </div>
          <div className="p-5 rounded-lg bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-400">Plate OCR Accuracy Target</p>
            <p className="text-3xl font-black text-emerald-400 mt-2">95%+</p>
          </div>
          <div className="p-5 rounded-lg bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-400">Average Processing Time</p>
            <p className="text-3xl font-black text-amber-400 mt-2">120ms</p>
          </div>
        </div>

        <div className="p-6 rounded-lg bg-slate-900 border border-slate-800">
          <h2 className="text-lg font-bold mb-2">Recent Detection Jobs</h2>
          <p className="text-xs text-slate-400">No detection jobs processed yet. Foundation ready.</p>
        </div>
      </main>
    </div>
  );
}
