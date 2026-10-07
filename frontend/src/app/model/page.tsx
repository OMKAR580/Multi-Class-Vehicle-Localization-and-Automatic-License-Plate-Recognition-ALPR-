import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function ModelPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-extrabold text-white mb-6">AI Model Specifications</h1>
        <div className="p-6 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
          <p className="text-sm text-slate-300">
            The AI subsystem uses a two-stage detection pipeline followed by custom Indian license plate character extraction.
          </p>
          <div className="border-t border-slate-800 pt-4">
            <h3 className="font-semibold text-sky-400 mb-2">Planned Architecture Boundaries</h3>
            <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
              <li>Vehicle Detection: YOLOv8 / YOLOv9 multi-class (Car, Bus, Truck, Two-Wheeler)</li>
              <li>Plate Localization: Specialized YOLO bounding box detector</li>
              <li>OCR Engine: Hybrid PaddleOCR & Tesseract tuned for Indian state codes</li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
