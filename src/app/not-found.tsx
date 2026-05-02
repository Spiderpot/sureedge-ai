import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-emerald-400">404</h1>
        <p className="text-gray-400 mt-4">Page not found</p>
        <Link href="/" className="mt-6 inline-block text-emerald-400 hover:text-emerald-300">
          Go home
        </Link>
      </div>
    </div>
  );
}
