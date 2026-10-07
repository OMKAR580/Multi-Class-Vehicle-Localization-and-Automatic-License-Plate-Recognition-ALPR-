'use client';

import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4">
      <div className="max-w-md w-full p-8 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl">
        <div className="text-center mb-8">
          <span className="inline-block bg-sky-500 text-slate-950 font-black text-xs px-3 py-1 rounded uppercase tracking-wider mb-2">
            ALPR Platform
          </span>
          <h1 className="text-2xl font-bold text-white">Sign In to Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">Authenticate to access AI Detection, History, & Reports</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => alert('Google OAuth sign-in flow placeholder. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env')}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium border border-slate-700 transition"
          >
            <span>Continue with Google</span>
          </button>
          <button
            onClick={() => alert('GitHub OAuth sign-in flow placeholder. Set NEXT_PUBLIC_GITHUB_CLIENT_ID in .env')}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium border border-slate-700 transition"
          >
            <span>Continue with GitHub</span>
          </button>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-500">Dev Sandbox</span></div>
        </div>

        <Link
          href="/app/dashboard"
          className="block w-full text-center py-3 px-4 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold transition"
        >
          Bypass Login (Dev Mode)
        </Link>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-slate-400 hover:text-sky-400">
            ← Back to Public Website
          </Link>
        </div>
      </div>
    </div>
  );
}
