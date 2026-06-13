import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  publicKey: string | null
  token: string | null
  balance: string
  isLoading: boolean
  error: string | null
  setPublicKey: (key: string | null) => void
  setToken: (token: string | null) => void
  setBalance: (balance: string) => void
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      publicKey: null,
      token: null,
      balance: '0',
      isLoading: false,
      error: null,
      setPublicKey: (key) => set({ publicKey: key }),
      setToken: (token) => set({ token }),
      setBalance: (balance) => set({ balance }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      logout: () => set({ publicKey: null, token: null, balance: '0', error: null }),
    }),
    {
      name: 'remitroot-auth',
      version: 1,
    }
  )
)

export default useAuthStore
