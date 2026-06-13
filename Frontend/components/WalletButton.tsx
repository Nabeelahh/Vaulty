'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/lib/auth-store'
import {
  checkWalletConnection,
  getWalletPublicKey,
  formatBalance,
  requestSep10Auth,
  submitSep10Auth,
  signTransaction,
  getWalletBalance,
} from '@/lib/stellar'
import { Wallet, LogOut, Copy, Check } from 'lucide-react'
import { useState as useStateHook } from 'react'

export function WalletButton() {
  const { publicKey, balance, setPublicKey, setToken, setBalance, setError } = useAuthStore()
  const [isConnecting, setIsConnecting] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:4000'

  const handleConnect = async () => {
    try {
      setIsConnecting(true)
      setError(null)

      // Check if Freighter is available
      if (!window.freighter) {
        throw new Error('Freighter wallet not found. Please install it.')
      }

      // Get wallet public key
      const key = await getWalletPublicKey()
      if (!key) {
        throw new Error('Failed to get public key from Freighter')
      }

      setPublicKey(key)

      // Request auth challenge from backend
      const challengeXdr = await requestSep10Auth(key, backendUrl)

      // Sign the challenge with Freighter
      const signedXdr = await signTransaction(challengeXdr)

      // Submit signed challenge to backend
      const authToken = await submitSep10Auth(signedXdr, backendUrl)
      setToken(authToken)

      // Fetch wallet balance
      const bal = await getWalletBalance(key, 'USDC')
      setBalance(bal)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed'
      setError(errorMessage)
      console.error('Wallet connection error:', err)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = () => {
    setPublicKey(null)
    setToken(null)
    setBalance('0')
    setError(null)
  }

  const handleCopy = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  if (!publicKey) {
    return (
      <Button
        onClick={handleConnect}
        disabled={isConnecting}
        className="gap-2"
        variant="default"
      >
        <Wallet className="w-4 h-4" />
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Wallet className="w-4 h-4" />
          <span className="hidden sm:inline">{publicKey.slice(0, 6)}...{publicKey.slice(-6)}</span>
          <span className="sm:hidden">{publicKey.slice(0, 4)}...</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm">
          <div className="font-medium text-foreground">Wallet Address</div>
          <div className="text-xs text-muted-foreground break-all mt-1">{publicKey}</div>
        </div>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-sm">
          <div className="font-medium text-foreground">USDC Balance</div>
          <div className="text-lg font-bold text-primary mt-1">${balance}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
          {isCopied ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Copy Address
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDisconnect} className="cursor-pointer text-destructive">
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
