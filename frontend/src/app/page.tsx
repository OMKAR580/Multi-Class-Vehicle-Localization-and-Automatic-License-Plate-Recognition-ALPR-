import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950 border border-sky-800 text-sky-400 text-xs font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
            Project Target Deadline: 12 November 2026
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6">
            Multi-Class Vehicle Localization & <span className="text-sky-400">ALPR Platform</span>
          </h1>
          <p className="max-w-3xl mx-auto text-lg text-slate-300 mb-10 leading-relaxed">
            An end-to-end intelligent traffic monitoring platform powered by YOLO-based vehicle/plate detection and OCR optimized for Indian license plate layouts.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/app/login"
              className="px-6 py-3 rounded-lg font-bold bg-sky-500 text-slate-950 hover:bg-sky-400 transition shadow-lg"
            >
              Access Dashboard
            </Link>
            <Link
              href="/download"
              className="px-6 py-3 rounded-lg font-bold border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition"
            >
              Download Mobile App
            </Link>
          </div>
        </section>

        {/* System Capabilities Grid */}
        <section className="py-16 bg-slate-900/50 border-t border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white text-center mb-12">Core Architecture Foundations</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
                <div className="w-10 h-10 rounded-lg bg-sky-900/50 border border-sky-700 flex items-center justify-center text-sky-400 font-bold mb-4">01</div>
                <h3 className="text-lg font-semibold text-white mb-2">YOLO + Indian Plate OCR</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Real-time multi-class vehicle detection coupled with fine-tuned OCR pipelines for standard and high-contrast Indian license plates.
                </p>
              </div>
              <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
                <div className="w-10 h-10 rounded-lg bg-sky-900/50 border border-sky-700 flex items-center justify-center text-sky-400 font-bold mb-4">02</div>
                <h3 className="text-lg font-semibold text-white mb-2">Cross-Platform (Web & Mobile)</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Seamless access via Next.js web application and Kotlin Jetpack Compose Android mobile application.
                </p>
              </div>
              <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
                <div className="w-10 h-10 rounded-lg bg-sky-900/50 border border-sky-700 flex items-center justify-center text-sky-400 font-bold mb-4">03</div>
                <h3 className="text-lg font-semibold text-white mb-2">Async Heavy Worker Queue</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  FastAPI backend backed by PostgreSQL and Redis job queues for non-blocking video and image inference.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
