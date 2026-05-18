// Mock data and API utilities for RemitRoot
// In production, these would connect to your backend API

export interface Farmer {
  id: string
  name: string
  location: string
  crops: string[]
  rating: number
  verified: boolean
  image?: string
}

export interface Vendor {
  id: string
  name: string
  location: string
  products: string[]
  rating: number
  verified: boolean
}

export interface Escrow {
  id: string
  farmerId: string
  vendorId: string
  amount: string
  crop: string
  status: 'funded' | 'voucher_minted' | 'redeemed' | 'repaying' | 'repaid'
  createdAt: string
  updatedAt: string
  repaymentAmount: string
  repaymentDate?: string
}

export interface DashboardStats {
  totalFunded: string
  activeEscrows: number
  totalRepaid: string
  averageROI: number
}

// Mock farmers data
export const mockFarmers: Farmer[] = [
  {
    id: 'farmer_1',
    name: 'James Kimani',
    location: 'Nakuru, Kenya',
    crops: ['Maize', 'Beans'],
    rating: 4.8,
    verified: true,
  },
  {
    id: 'farmer_2',
    name: 'Sarah Mwangi',
    location: 'Kisii, Kenya',
    crops: ['Tea', 'Coffee'],
    rating: 4.9,
    verified: true,
  },
  {
    id: 'farmer_3',
    name: 'Peter Ochieng',
    location: 'Uasin Gishu, Kenya',
    crops: ['Wheat', 'Barley'],
    rating: 4.7,
    verified: true,
  },
]

// Mock vendors data
export const mockVendors: Vendor[] = [
  {
    id: 'vendor_1',
    name: 'AgriSupply Co',
    location: 'Nairobi, Kenya',
    products: ['Fertilizer', 'Seeds', 'Pesticides'],
    rating: 4.6,
    verified: true,
  },
  {
    id: 'vendor_2',
    name: 'Farm Inputs Ltd',
    location: 'Eldoret, Kenya',
    products: ['Seeds', 'Tools', 'Equipment'],
    rating: 4.5,
    verified: true,
  },
]

// Mock escrows data
export const mockEscrows: Escrow[] = [
  {
    id: 'escrow_1',
    farmerId: 'farmer_1',
    vendorId: 'vendor_1',
    amount: '500',
    crop: 'Maize',
    status: 'funded',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    repaymentAmount: '600',
  },
  {
    id: 'escrow_2',
    farmerId: 'farmer_2',
    vendorId: 'vendor_2',
    amount: '750',
    crop: 'Tea',
    status: 'voucher_minted',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    repaymentAmount: '900',
  },
  {
    id: 'escrow_3',
    farmerId: 'farmer_3',
    vendorId: 'vendor_1',
    amount: '400',
    crop: 'Wheat',
    status: 'redeemed',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    repaymentAmount: '480',
  },
  {
    id: 'escrow_4',
    farmerId: 'farmer_1',
    vendorId: 'vendor_2',
    amount: '300',
    crop: 'Beans',
    status: 'repaid',
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    repaymentAmount: '360',
    repaymentDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

// API functions
export async function fetchFarmers(): Promise<Farmer[]> {
  // Simulate API call
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockFarmers), 500)
  })
}

export async function fetchVendors(): Promise<Vendor[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockVendors), 500)
  })
}

export async function fetchEscrows(publicKey?: string): Promise<Escrow[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockEscrows), 500)
  })
}

export async function fetchDashboardStats(publicKey?: string): Promise<DashboardStats> {
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          totalFunded: '1950', // Sum of amounts
          activeEscrows: 3, // Count of non-repaid
          totalRepaid: '360', // Sum of repaid
          averageROI: 20, // Average percentage increase
        }),
      500
    )
  })
}

export async function createEscrow(data: {
  farmerId: string
  vendorId: string
  amount: string
  crop: string
}): Promise<Escrow> {
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          id: `escrow_${Date.now()}`,
          ...data,
          status: 'funded',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          repaymentAmount: (parseFloat(data.amount) * 1.2).toString(),
        }),
      1000
    )
  })
}
