'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'
import { WalletButton } from '@/components/WalletButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, Leaf, TrendingUp, Zap } from 'lucide-react'
import Link from 'next/link'

export default function LandingPage() {
  const router = useRouter()
  const { publicKey } = useAuthStore()

  useEffect(() => {
    if (publicKey) {
      router.push('/sender')
    }
  }, [publicKey, router])

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <Leaf className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground">RemitRoot</span>
          </div>
          <WalletButton />
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight">
                Fund Farmers. Track Impact.
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                RemitRoot connects diaspora families with African farmers using blockchain technology. Send money with confidence. Watch it grow in real time.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <WalletButton />
              <Button variant="outline" size="lg">
                Learn More <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>

            <div className="pt-8 border-t border-border">
              <p className="text-sm text-muted-foreground mb-4">Powered by Stellar Blockchain</p>
              <div className="flex items-center gap-3 text-sm text-foreground">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>USDC transfers</span>
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>Smart escrow</span>
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>Real-time tracking</span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center justify-center">
            <div className="space-y-4 w-full max-w-sm">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="backdrop-blur">
                  <CardContent className="pt-6">
                    <div className="h-20 bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg animate-pulse"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-card/50 border-y border-border py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Send funds to African farmers in minutes, not days. Blockchain-backed transparency you can trust.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: 'Connect Wallet',
                description: 'Link your Freighter wallet and authenticate securely using SEP-0010.'
              },
              {
                icon: TrendingUp,
                title: 'Select & Fund',
                description: 'Browse verified farmers and vendors. Choose crops and funding amounts.'
              },
              {
                icon: Leaf,
                title: 'Track & Impact',
                description: 'Watch your funds move through the escrow process in real-time on Stellar.'
              },
            ].map((feature, i) => (
              <Card key={i} className="border border-border hover:border-primary/50 transition-colors">
                <CardHeader>
                  <feature.icon className="w-8 h-8 text-primary mb-2" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Card className="border-primary/50 bg-gradient-to-br from-primary/10 to-accent/10">
          <CardContent className="pt-12 text-center space-y-6">
            <h2 className="text-3xl font-bold text-foreground">Ready to make an impact?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Connect your wallet and start funding sustainable agriculture in Africa today.
            </p>
            <WalletButton />
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-foreground mb-4">RemitRoot</h3>
              <p className="text-sm text-muted-foreground">Impact-driven finance for African agriculture.</p>
            </div>
            {[
              { title: 'Product', links: ['Dashboard', 'Farmers', 'Impact'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers'] },
              { title: 'Developers', links: ['Docs', 'API', 'GitHub'] },
            ].map((section, i) => (
              <div key={i}>
                <h3 className="font-semibold text-foreground mb-4">{section.title}</h3>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>&copy; 2025 RemitRoot. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-foreground">Privacy</a>
              <a href="#" className="hover:text-foreground">Terms</a>
              <a href="#" className="hover:text-foreground">Status</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
