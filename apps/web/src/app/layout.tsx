import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '@/styles/tokens.css';
import '@/styles/global.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono-code', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'Upkeep — Uptime monitoring for public & private endpoints',
    template: '%s · Upkeep',
  },
  description:
    'Monitor public and private endpoints over SSH tunnels and OpenVPN. Email, SMS, webhook and push alerts with anti-flapping and cooldowns.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f5f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f1a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${mono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
