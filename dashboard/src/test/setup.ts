import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

const createStorage = (): Storage => {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key) {
      return store.get(key) ?? null
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(key, value)
    },
  }
}

const storage = createStorage()

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: storage,
})

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: storage,
})

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
})

Object.defineProperty(Element.prototype, 'hasPointerCapture', {
  configurable: true,
  value: () => false,
})

Object.defineProperty(Element.prototype, 'setPointerCapture', {
  configurable: true,
  value: () => {},
})

Object.defineProperty(Element.prototype, 'releasePointerCapture', {
  configurable: true,
  value: () => {},
})

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  configurable: true,
  value: () => {},
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
