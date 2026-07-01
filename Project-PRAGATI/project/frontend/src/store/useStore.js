import { create } from 'zustand'

export const useStore = create((set) => ({
  activeField: null,
  setActiveField: (field) => set({ activeField: field }),
  
  bbox: null,
  setBbox: (bbox) => set({ bbox }),
  
  mapViewState: null,
  setMapViewState: (state) => set({ mapViewState: state }),
}))
