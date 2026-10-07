import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function TestingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-extrabold text-white mb-6">Testing & Quality Assurance</h1>
        <div className="p-6 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-lg font-bold text-sky-400">Test Suites & Benchmarks</h2>
          <p className="text-sm text-slate-300">
            Our automated CI workflow enforces testing across all sub-modules on every pull request:
          </p>
          <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
            <li>Backend API Unit & Integration Tests (Pytest)</li>
            <li>AI Contract & Schema Validation Tests</li>
            <li>Frontend Next.js Lint & Build Verification</li>
            <li>Android Jetpack Compose Build Syntax Verification</li>
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}
