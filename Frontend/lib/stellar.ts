import * as StellarSdk from 'stellar-sdk'

const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet'
const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org'
const HORIZON_URL = process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org'

export const NETWORK_PASSPHRASE =
  NETWORK === 'testnet'
    ? StellarSdk.Networks.TESTNET_NETWORK_PASSPHRASE
    : StellarSdk.Networks.PUBLIC_NETWORK_PASSPHRASE

// Initialize Horizon server for querying blockchain data
export const horizonServer = new StellarSdk.Horizon.Server(HORIZON_URL, {
  allowHttp: HORIZON_URL.includes('localhost'),
})

// Format an amount (in stroops) to USDC display format
export function formatBalance(stroops: number | string): string {
  const amount = typeof stroops === 'string' ? parseFloat(stroops) : stroops
  const usdc = amount / 10000000 // Convert stroops to USDC (10^7)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  }).format(usdc)
}

// Check if wallet is connected
export async function checkWalletConnection(): Promise<boolean> {
  try {
    const { isConnected } = await (window as any).freighter.isConnected()
    return isConnected
  } catch {
    return false
  }
}

// Get the connected wallet public key
export async function getWalletPublicKey(): Promise<string | null> {
  try {
    const { publicKey } = await (window as any).freighter.getPublicKey()
    return publicKey
  } catch {
    return null
  }
}

// Request SEP-0010 auth from backend
export async function requestSep10Auth(
  publicKey: string,
  backendUrl: string
): Promise<string> {
  try {
    const response = await fetch(`${backendUrl}/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: publicKey }),
    })
    const { transaction } = await response.json()
    return transaction
  } catch (error) {
    throw new Error('Failed to get auth challenge')
  }
}

// Submit signed auth transaction to backend
export async function submitSep10Auth(
  signedTransaction: string,
  backendUrl: string
): Promise<string> {
  try {
    const response = await fetch(`${backendUrl}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: signedTransaction }),
    })
    const { token } = await response.json()
    return token
  } catch (error) {
    throw new Error('Failed to verify auth signature')
  }
}

// Sign a transaction with Freighter
export async function signTransaction(transaction: string): Promise<string> {
  try {
    const result = await (window as any).freighter.signTransaction(transaction, {
      networkPassphrase: NETWORK_PASSPHRASE,
    })
    return result
  } catch (error) {
    throw new Error('Failed to sign transaction')
  }
}

// Get wallet balance for a given asset
export async function getWalletBalance(
  publicKey: string,
  assetCode: string = 'USDC'
): Promise<string> {
  try {
    const account = await horizonServer.accounts().accountId(publicKey).call()
    const balance = account.balances.find(
      (b) => b.asset_code === assetCode && b.asset_issuer
    )
    return balance?.balance || '0'
  } catch (error) {
    console.error('Failed to fetch wallet balance:', error)
    return '0'
  }
}

export default {
  horizonServer,
  NETWORK_PASSPHRASE,
  formatBalance,
  checkWalletConnection,
  getWalletPublicKey,
  requestSep10Auth,
  submitSep10Auth,
  signTransaction,
  getWalletBalance,
}
