import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TargetVision - AI Photo Search',
  description: 'Search and chat with your photo library using AI',
  keywords: 'photo, search, AI, RAG, chat',
  authors: [{ name: 'TargetVision Team' }],
  icons: {
    icon: '/targetvision-icon.svg',
    shortcut: '/targetvision-icon.svg',
    apple: '/targetvision-icon.svg',
  },
  openGraph: {
    title: 'TargetVision - AI Photo Search',
    description: 'Search and chat with your photo library using AI',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}