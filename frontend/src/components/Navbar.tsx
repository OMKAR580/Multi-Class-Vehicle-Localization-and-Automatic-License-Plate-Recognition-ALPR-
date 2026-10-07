import Link from 'next/link';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-sky-400">
          <span className="bg-sky-500 text-slate-950 px-2 py-1 rounded text-xs tracking-wider uppercase font-black">ALPR</span>
          <span>VehicleVision</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <Link href="/about" className="hover:text-sky-400 transition">About</Link>
          <Link href="/how-it-works" className="hover:text-sky-400 transition">How It Works</Link>
          <Link href="/technology" className="hover:text-sky-400 transition">Technology</Link>
          <Link href="/model" className="hover:text-sky-400 transition">Model</Link>
          <Link href="/testing" className="hover:text-sky-400 transition">Testing</Link>
          <Link href="/documentation" className="hover:text-sky-400 transition">Docs</Link>
          <Link href="/download" className="hover:text-sky-400 transition">Download Android</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link 
            href="/app/login"
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 transition shadow-sm"
          >
            Launch Platform
          </Link>
        </div>
      </div>
    </header>
  );
}
