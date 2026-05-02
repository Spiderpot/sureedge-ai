import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SureEdge AI — AI-Powered Sports Arbitrage Platform',
  description: 'Automatically detect surebets across 150+ bookmakers. AI-powered arbitrage detection, auto-bet execution, and risk management for consistent profits.',
  keywords: ['surebet', 'arbitrage', 'sports betting', 'AI', 'automated betting', 'odds comparison', 'profit'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[#0a0a0f] text-white">
        {children}
      </body>
    </html>
  );
}
