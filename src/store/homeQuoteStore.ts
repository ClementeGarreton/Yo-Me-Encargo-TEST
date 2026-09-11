import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface HomeQuotePersonalInfo {
  name: string
  email: string
  phone: string
}

export interface HomeQuoteAddress {
  street: string
  number: string
  commune: string
  region: string
  additionalInfo?: string
}

export interface HomeQuoteState {
  personalInfo: HomeQuotePersonalInfo | null
  visitAddress: HomeQuoteAddress | null
  isConfirmed: boolean

  // Actions
  setPersonalInfo: (info: HomeQuotePersonalInfo) => void
  setVisitAddress: (address: HomeQuoteAddress) => void
  setConfirmed: (confirmed: boolean) => void
  resetQuote: () => void
}

const initialState = {
  personalInfo: null,
  visitAddress: null,
  isConfirmed: false,
}

export const useHomeQuoteStore = create<HomeQuoteState>()(
  persist(
    (set) => ({
      ...initialState,

      setPersonalInfo: (info) => set({ personalInfo: info }),

      setVisitAddress: (address) => set({ visitAddress: address }),

      setConfirmed: (confirmed) => set({ isConfirmed: confirmed }),

      resetQuote: () => set(initialState),
    }),
    {
      name: 'home-quote-storage',
    }
  )
)
