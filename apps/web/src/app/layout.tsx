import { Providers } from '../components/providers';
import { Inter } from 'next/font/google';
import './global.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'Wound Care Clinical Portal',
  description: 'Clinical Portal for Wound Care Management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} font-sans`}>
      <body className="bg-background text-foreground antialiased min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
