import Sidebar from '@/components/Sidebar';

export default function ProfilePage() {
  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-2">User Profile & OAuth Settings</h1>
        <p className="text-xs text-slate-400 mb-8">Manage authentication methods and API tokens.</p>
        <div className="max-w-xl space-y-6">
          <div className="p-6 rounded-lg bg-slate-900 border border-slate-800">
            <h2 className="text-md font-semibold mb-4 text-sky-400">Connected Accounts</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs p-3 bg-slate-950 rounded border border-slate-800">
                <span>Google OAuth Provider</span>
                <span className="text-slate-500">Not Connected</span>
              </div>
              <div className="flex justify-between items-center text-xs p-3 bg-slate-950 rounded border border-slate-800">
                <span>GitHub OAuth Provider</span>
                <span className="text-slate-500">Not Connected</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-lg bg-slate-900 border border-slate-800">
            <h2 className="text-md font-semibold mb-2 text-sky-400">API Key Authorization</h2>
            <p className="text-xs text-slate-400 mb-4">Use API key to send inference requests from external scripts or mobile SDKs.</p>
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded border border-slate-700">
              Generate New API Key
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
