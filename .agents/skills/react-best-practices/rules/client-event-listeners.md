---
title: Deduplicate Global Event Listeners
impact: LOW
impactDescription: single listener for N components
tags: client, event-listeners, subscription, browser
---

## Deduplicate Global Event Listeners

Use a module-level singleton listener to share global event listeners across component instances.

**Incorrect (N instances = N listeners):**

```tsx
function useKeyboardShortcut(key: string, callback: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === key) {
        callback()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [key, callback])
}
```

When using the `useKeyboardShortcut` hook multiple times, each instance will register a new listener.

**Correct (N instances = 1 listener):**

```tsx
const keyCallbacks = new Map<string, Set<() => void>>()
let isListening = false

const handleKeydown = (e: KeyboardEvent) => {
  if (e.metaKey) {
    keyCallbacks.get(e.key)?.forEach(callback => callback())
  }
}

function useKeyboardShortcut(key: string, callback: () => void) {
  useEffect(() => {
    if (!keyCallbacks.has(key)) {
      keyCallbacks.set(key, new Set())
    }
    keyCallbacks.get(key)!.add(callback)

    if (!isListening) {
      window.addEventListener('keydown', handleKeydown)
      isListening = true
    }

    return () => {
      const callbacks = keyCallbacks.get(key)
      callbacks?.delete(callback)

      if (callbacks?.size === 0) {
        keyCallbacks.delete(key)
      }

      if (isListening && keyCallbacks.size === 0) {
        window.removeEventListener('keydown', handleKeydown)
        isListening = false
      }
    }
  }, [key, callback])
}

function Profile() {
  useKeyboardShortcut('p', () => { /* ... */ }) 
  useKeyboardShortcut('k', () => { /* ... */ })
}
```

Libraries like SWR or TanStack Query can also coordinate shared subscriptions, but the core idea is one browser listener per event source.
