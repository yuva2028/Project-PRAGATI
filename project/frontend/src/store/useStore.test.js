import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './useStore'

describe('useStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useStore.setState({ activeField: null, bbox: null, mapViewState: null })
  })

  it('should have initial state', () => {
    const state = useStore.getState()
    expect(state.activeField).toBeNull()
    expect(state.bbox).toBeNull()
    expect(state.mapViewState).toBeNull()
  })

  it('should set activeField', () => {
    const field = { id: 1, name: 'Field 1' }
    useStore.getState().setActiveField(field)
    expect(useStore.getState().activeField).toEqual(field)
  })

  it('should set bbox', () => {
    const bbox = [10, 20, 30, 40]
    useStore.getState().setBbox(bbox)
    expect(useStore.getState().bbox).toEqual(bbox)
  })

  it('should set mapViewState', () => {
    const viewState = { longitude: 75.7, latitude: 15.3, zoom: 8 }
    useStore.getState().setMapViewState(viewState)
    expect(useStore.getState().mapViewState).toEqual(viewState)
  })
})
