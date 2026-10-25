import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  preload: true,
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  preload: true,
})

export const metadata: Metadata = {
  // Base para resolver URLs sociais/og (usa PUBLIC_BASE_URL quando definida)
  metadataBase: new URL(process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'Consultório Dra. [Nome da Dentista] - Agendamento Online',
    template: '%s | Consultório Dra. [Nome da Dentista]',
  },
  description: 'Agende sua consulta odontológica de forma simples e rápida. Atendimento humanizado, 15 anos de experiência. Consultório próprio e posto de saúde.',
  keywords: ['dentista', 'odontologia', 'agendamento', 'consulta', 'clareamento', 'limpeza', 'tratamento de canal'],
  authors: [{ name: 'Consultório Dra. [Nome da Dentista]' }],
  creator: 'Consultório Dra. [Nome da Dentista]',
  publisher: 'Consultório Dra. [Nome da Dentista]',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://consultorio-exemplo.com',
    siteName: 'Consultório Dra. [Nome da Dentista]',
    title: 'Consultório Dra. [Nome da Dentista] - Agendamento Online',
    description: 'Agende sua consulta odontológica de forma simples e rápida. Atendimento humanizado, 15 anos de experiência.',
    images: [
      {
        url: '/images/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Consultório Dra. [Nome da Dentista]',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Consultório Dra. [Nome da Dentista]',
    description: 'Agende sua consulta odontológica de forma simples e rápida.',
    images: ['/images/og-image.svg'],
  },
  verification: {
    google: 'google-site-verification-code',
  },
}

export const viewport: Viewport = {
  themeColor: '#2d8a8a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${playfair.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/logo/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/logo/favicon-32.png" sizes="32x32" />
        <link rel="icon" type="image/png" href="/logo/icon-192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/logo/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen flex flex-col">
        <a href="#main-content" className="skip-link">
          Pular para o conteúdo principal
        </a>
        {children}
      </body>
    </html>
  )
}