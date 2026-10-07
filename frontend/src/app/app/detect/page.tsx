'use client';

import Sidebar from '@/components/Sidebar';
import { useState } from 'react';

export default function DetectPage() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-2">AI Vehicle & License Plate Detection Studio</h1>
        <p className="text-xs text-slate-400 mb-8">Upload images or videos to run the YOLO + OCR pipeline.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 rounded-xl bg-slate-900 border border-dashed border-slate-700 text-center flex flex-col items-center justify-center min-h-[300px]">
            <p className="text-sm font-semibold mb-2">Upload Image or Video</p>
            <p className="text-xs text-slate-400 mb-6">Supports JPG, PNG, MP4 (Max 25MB)</p>
            <input 
              type="file" 
              className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-sky-500 file:text-slate-950 hover:file:bg-sky-400"
              onChange={(e) => setSelectedFile(e.target.files?.[0]?.name || null)}
            />
            {selectedFile && (
              <p className="text-xs text-sky-400 mt-4">Selected: {selectedFile}</p>
            )}
          </div>

          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
            <h2 className="text-lg font-bold mb-4">Structured Detection Result Contract</h2>
            <pre className="p-4 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-sky-300 overflow-x-auto">
{`{
  "image_id": "demo_sample_01",
  "vehicles": [
    {
      "type": "car",
      "confidence": 0.94,
      "bbox": [120, 80, 540, 420],
      "plate": {
        "text": "RJ14AB1234",
        "confidence": 0.91,
        "bbox": [230, 350, 410, 395]
      }
    }
  ]
}`}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
