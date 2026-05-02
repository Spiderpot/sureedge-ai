'use client';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-400">Something went wrong</h1>
        <button
          onClick={reset}
          className="mt-6 px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
