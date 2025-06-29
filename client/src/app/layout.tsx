import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { Auth0Provider } from '@auth0/nextjs-auth0'
import { AuthProvider } from '@/contexts/auth-context'
import { AppLayoutWrapper } from '@/components/layout/app-layout-wrapper'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PromptPulse Dashboard',
  description: 'Track and analyze your Claude Code usage across multiple machines',
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
          <Auth0Provider>
            <AuthProvider>
              <AppLayoutWrapper>
                {children}
              </AppLayoutWrapper>
            </AuthProvider>
          </Auth0Provider>
        </ThemeProvider>
      </body>
    </html>
  )
}