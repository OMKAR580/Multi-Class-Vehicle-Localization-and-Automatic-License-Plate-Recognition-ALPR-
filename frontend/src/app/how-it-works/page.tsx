import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function HowItWorksPage() {
  const steps = [
    { title: '1. Media Ingestion', desc: 'Upload image or video feed via Web Studio or Android Native Mobile Client.' },
    { title: '2. Vehicle Detection', desc: 'YOLO-based localization categorizes vehicle type (Car, Truck, Bus, Motorbike).' },
    { title: '3. License Plate Bounding Box', desc: 'Secondary detection network extracts precise region of interest for the license plate.' },
    { title: '4. Image Preprocessing', desc: 'Grayscale conversion, adaptive thresholding, and perspective transformation for Indian plate layouts.' },
    { title: '5. OCR & Postprocessing', desc: 'Optical Character Recognition coupled with Indian plate format validation regex.' },
    { title: '6. Structured Output Contract', desc: 'Standardized JSON results stored in PostgreSQL and delivered to frontends.' },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-extrabold text-white mb-6">How It Works</h1>
        <p className="text-slate-300 leading-relaxed mb-10">
          The end-to-end processing pipeline transforms raw visual inputs into validated vehicle and license plate intelligence.
        </p>
        <div className="space-y-6">
          {steps.map((s, idx) => (
            <div key={idx} className="p-6 rounded-lg bg-slate-900 border border-slate-800">
              <h2 className="text-lg font-bold text-sky-400 mb-2">{s.title}</h2>
              <p className="text-sm text-slate-300">{s.desc}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
