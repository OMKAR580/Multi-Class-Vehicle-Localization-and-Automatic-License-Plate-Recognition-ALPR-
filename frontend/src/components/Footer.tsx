import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-800 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="text-white font-bold text-lg mb-3">VehicleVision ALPR</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Intelligent Multi-Class Vehicle Localization & Automatic License Plate Recognition platform tailored for Indian traffic scenarios.
          </p>
        </div>
        <div>
          <h4 className="text-slate-200 font-semibold text-sm mb-3">Navigation</h4>
          <ul className="space-y-2 text-xs">
            <li><Link href="/about" className="hover:text-sky-400">About Project</Link></li>
            <li><Link href="/how-it-works" className="hover:text-sky-400">Pipeline Workflow</Link></li>
            <li><Link href="/technology" className="hover:text-sky-400">Tech Stack</Link></li>
            <li><Link href="/download" className="hover:text-sky-400">Android APK</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-slate-200 font-semibold text-sm mb-3">Resources</h4>
          <ul className="space-y-2 text-xs">
            <li><Link href="/documentation" className="hover:text-sky-400">API Documentation</Link></li>
            <li><Link href="/model" className="hover:text-sky-400">AI Model Specs</Link></li>
            <li><Link href="/testing" className="hover:text-sky-400">Evaluation & Metrics</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-slate-200 font-semibold text-sm mb-3">Project Status</h4>
          <p className="text-xs text-slate-400">
            Target Completion: <span className="text-sky-400 font-semibold">12 Nov 2026</span><br/>
            Current Phase: <span className="text-amber-400 font-semibold">Foundation Established</span>
          </p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pt-6 border-t border-slate-900 text-center text-xs text-slate-500">
        © 2026 VehicleVision Team. Built for modern traffic intelligence.
      </div>
    </footer>
  );
}
