import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function TechnologyPage() {
  const stack = [
    { category: 'Frontend', tech: 'Next.js 14, TypeScript, Tailwind CSS, Lucide Icons' },
    { category: 'Android', tech: 'Kotlin, Jetpack Compose, ViewModel, Retrofit, Navigation' },
    { category: 'Backend API', tech: 'Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic' },
    { category: 'Database & Queue', tech: 'PostgreSQL 16, Redis 7, Celery / Async Workers' },
    { category: 'AI / Computer Vision', tech: 'PyTorch, OpenCV, YOLO Detector, Tesseract/PaddleOCR' },
    { category: 'DevOps & Tooling', tech: 'Docker, Docker Compose, GitHub Actions CI, GitFlow' },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-extrabold text-white mb-6">Technology Stack</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {stack.map((item, idx) => (
            <div key={idx} className="p-6 rounded-lg bg-slate-900 border border-slate-800">
              <h2 className="text-lg font-bold text-sky-400 mb-2">{item.category}</h2>
              <p className="text-sm text-slate-300 font-mono">{item.tech}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
