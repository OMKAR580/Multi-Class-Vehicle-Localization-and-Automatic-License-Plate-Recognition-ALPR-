import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function DownloadPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-extrabold text-white mb-4">Download Android Mobile App</h1>
        <p className="text-slate-300 max-w-xl mx-auto mb-8">
          Access vehicle localization and plate recognition on the field using our native Android application.
        </p>
        <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 max-w-md mx-auto">
          <div className="w-16 h-16 bg-sky-950 border border-sky-800 rounded-2xl mx-auto flex items-center justify-center text-sky-400 text-2xl font-bold mb-4">
            APK
          </div>
          <h2 className="text-xl font-bold text-white mb-2">VehicleVision Android v0.1.0-alpha</h2>
          <p className="text-xs text-slate-400 mb-6">Target: Android 8.0+ (API 26+) | Native Jetpack Compose</p>
          <button 
            disabled 
            className="w-full py-3 px-4 rounded-lg bg-slate-800 text-slate-500 font-semibold cursor-not-allowed border border-slate-700"
          >
            Download Build (Release Pending 12 Nov 2026)
          </button>
          <p className="text-xs text-amber-400 mt-4">
            Public Download does not require authentication. App usage requires OAuth login.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
