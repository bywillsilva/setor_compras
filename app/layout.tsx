import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { Inter, Roboto_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { normalizeThemePreference, THEME_COOKIE_NAME, themePreferenceToNextTheme } from '@/lib/theme'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--app-font-sans',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--app-font-mono',
})

function resolveMetadataBase() {
  const rawUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'http://localhost:3000'

  const normalizedUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`

  try {
    return new URL(normalizedUrl)
  } catch {
    return new URL('http://localhost:3000')
  }
}

const metadataBase = resolveMetadataBase()
const appTitle = 'AG Compras - Sistema Corporativo'
const appDescription = 'Sistema corporativo para gestao de compras, cotacoes, aprovacoes, entregas e documentos.'

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: appTitle,
    template: `%s | ${appTitle}`,
  },
  applicationName: appTitle,
  description: appDescription,
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: appTitle,
    title: appTitle,
    description: appDescription,
    images: [
      {
        url: '/opengraph-image.png',
        width: 1280,
        height: 1280,
        alt: appTitle,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: appTitle,
    description: appDescription,
    images: ['/twitter-image.png'],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const themePreference = normalizeThemePreference((await cookies()).get(THEME_COOKIE_NAME)?.value)

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={themePreference === "escuro" ? "dark bg-background" : "bg-background"}
    >
      <body className={`${inter.variable} ${robotoMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme={themePreferenceToNextTheme(themePreference)}
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </ThemeProvider>
      </body>
    </html>
  )
}
