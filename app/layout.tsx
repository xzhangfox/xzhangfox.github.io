import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { JetBrains_Mono } from 'next/font/google'
import { LanguageProvider } from '@/lib/i18n'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Xi Zhang — Full-Stack Data Scientist',
  description: 'Full-Stack Data Scientist specializing in AI systems, RAG architecture, LLM orchestration, and scalable data platforms. Based in Irvine, CA.',
  keywords: ['Data Scientist', 'AI Engineer', 'Full-Stack', 'RAG', 'LLM', 'React', 'Python'],
  authors: [{ name: 'Xi Zhang' }],
  openGraph: {
    title: 'Xi Zhang — Full-Stack Data Scientist',
    description: 'Building AI systems that bridge intelligence with enterprise-grade platforms.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans bg-bg text-white antialiased">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  )
}
