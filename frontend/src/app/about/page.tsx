import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-extrabold text-white mb-6">About the ALPR Project</h1>
        <p className="text-slate-300 leading-relaxed mb-6">
          The Multi-Class Vehicle Localization and Automatic License Plate Recognition (ALPR) project is designed to address the challenges of automated traffic monitoring, toll collection, and parking management in diverse traffic environments with a specific focus on Indian road conditions.
        </p>
        <div className="p-6 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-xl font-bold text-sky-400">Project Timeline & Scope</h2>
          <ul className="list-disc list-inside text-sm text-slate-300 space-y-2">
            <li><strong>Target Completion Date:</strong> 12 November 2026</li>
            <li><strong>Development Team:</strong> 3-Person Engineering Team</li>
            <li><strong>Core Objective:</strong> Modular, scalable, non-overengineered architecture supporting high-accuracy vehicle localization and plate recognition.</li>
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}
