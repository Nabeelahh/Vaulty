'use client'

import { WalletButton } from '@/components/WalletButton'
import { useAuthStore } from '@/lib/auth-store'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { BarChart3, History, LogOut, Send, Home } from 'lucide-react'

const navItems = [
  { href: '/sender', icon: Home, label: 'Dashboard' },
  { href: '/sender/fund', icon: Send, label: 'Fund' },
  { href: '/sender/track', icon: BarChart3, label: 'Track' },
  { href: '/sender/history', icon: History, label: 'History' },
]

export default function SenderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { publicKey } = useAuthStore()

  useEffect(() => {
    // Redirect to home if not authenticated
    if (!publicKey && pathname !== '/') {
      router.push('/')
    }
  }, [publicKey, pathname, router])

  if (!publicKey) {
    return null
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/sender" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
                <Send className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg text-foreground hidden sm:inline">RemitRoot</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <WalletButton />
        </div>

        {/* Mobile navigation */}
        <div className="md:hidden border-t border-border overflow-x-auto">
          <div className="flex items-center px-4 gap-1 min-w-min">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>&copy; 2025 RemitRoot. Building impact-driven finance.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-foreground">Docs</a>
              <a href="#" className="hover:text-foreground">Support</a>
              <a href="#" className="hover:text-foreground">Status</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
