import Link from 'next/link';

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 min-h-screen p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 px-2 py-4 mb-6 border-b border-slate-800">
          <span className="bg-sky-500 text-slate-950 font-black text-xs px-2 py-1 rounded">ALPR</span>
          <span className="font-bold text-white text-lg">Dashboard</span>
        </div>
        <nav className="space-y-1">
          <Link href="/app/dashboard" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition">
            Overview
          </Link>
          <Link href="/app/detect" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition">
            AI Detection Studio
          </Link>
          <Link href="/app/history" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition">
            Detection History
          </Link>
          <Link href="/app/analytics" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition">
            Traffic Analytics
          </Link>
          <Link href="/app/reports" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition">
            Generated Reports
          </Link>
          <Link href="/app/profile" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition">
            Account & API Keys
          </Link>
        </nav>
      </div>
      <div className="pt-4 border-t border-slate-800">
        <Link href="/" className="block w-full text-center px-3 py-2 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition">
          ← Exit to Public Site
        </Link>
      </div>
    </aside>
  );
}
