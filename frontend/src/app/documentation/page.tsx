import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function DocumentationPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-extrabold text-white mb-6">Documentation Hub</h1>
        <p className="text-slate-300 mb-8">
          Detailed technical documentation and architecture blueprints are maintained in the repository under <code className="text-sky-400 bg-slate-900 px-2 py-1 rounded">/docs</code>.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded border border-slate-800 bg-slate-900">
            <h3 className="font-semibold text-white">System Architecture</h3>
            <p className="text-xs text-slate-400 mt-1">docs/architecture/system_architecture.md</p>
          </div>
          <div className="p-4 rounded border border-slate-800 bg-slate-900">
            <h3 className="font-semibold text-white">AI Output Contract</h3>
            <p className="text-xs text-slate-400 mt-1">docs/ai/output_contract.md</p>
          </div>
          <div className="p-4 rounded border border-slate-800 bg-slate-900">
            <h3 className="font-semibold text-white">Authentication Flow</h3>
            <p className="text-xs text-slate-400 mt-1">docs/architecture/authentication_flow.md</p>
          </div>
          <div className="p-4 rounded border border-slate-800 bg-slate-900">
            <h3 className="font-semibold text-white">Git Workflow</h3>
            <p className="text-xs text-slate-400 mt-1">docs/architecture/git_workflow.md</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
