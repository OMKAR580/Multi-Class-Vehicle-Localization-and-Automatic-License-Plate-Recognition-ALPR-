import Sidebar from '@/components/Sidebar';

export default function AnalyticsPage() {
  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-2">Traffic Analytics & Insights</h1>
        <p className="text-xs text-slate-400 mb-8">Vehicle categorization breakdown and peak traffic distribution.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-lg bg-slate-900 border border-slate-800">
            <h2 className="text-md font-semibold mb-4 text-sky-400">Vehicle Type Classification Breakdown</h2>
            <div className="h-40 bg-slate-950 border border-slate-800 rounded flex items-center justify-center text-slate-500 text-xs">
              Chart Placeholder (Cars, Trucks, Buses, Motorbikes)
            </div>
          </div>
          <div className="p-6 rounded-lg bg-slate-900 border border-slate-800">
            <h2 className="text-md font-semibold mb-4 text-sky-400">Hourly Recognition Volume</h2>
            <div className="h-40 bg-slate-950 border border-slate-800 rounded flex items-center justify-center text-slate-500 text-xs">
              Chart Placeholder (Volume vs Hour)
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
