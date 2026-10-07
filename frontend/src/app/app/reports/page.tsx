import Sidebar from '@/components/Sidebar';

export default function ReportsPage() {
  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-2">Automated Traffic Reports</h1>
        <p className="text-xs text-slate-400 mb-8">Generate and export CSV/PDF reports for traffic violations and vehicle logs.</p>
        <div className="p-6 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-sm">Daily Vehicle Log Report Template</h3>
            <p className="text-xs text-slate-400">Automated daily summary of detected license plates</p>
          </div>
          <button className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold rounded">
            Generate Template
          </button>
        </div>
      </main>
    </div>
  );
}
