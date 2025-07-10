import { Inter } from 'next/font/google';
import './globals.css';
import { ReactNode } from 'react';
import ChatWidget from './components/ChatWidget'; // Re-import ChatWidget

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata = {
  title: 'Esus Audit AI',
  description: 'AI-powered audit automation platform for finance and audit firms',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
