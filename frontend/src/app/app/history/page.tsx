import Sidebar from '@/components/Sidebar';

export default function HistoryPage() {
  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-2">Detection History Logs</h1>
        <p className="text-xs text-slate-400 mb-8">View past vehicle detections and plate extractions.</p>
        <div className="p-6 rounded-lg bg-slate-900 border border-slate-800 text-center text-slate-400 text-sm">
          History foundation established. Connect backend database service to stream past records.
        </div>
      </main>
    </div>
  );
}
