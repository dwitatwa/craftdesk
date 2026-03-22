---
title: Defer Non-Critical Third-Party Libraries
impact: MEDIUM
impactDescription: loads after first paint or interaction
tags: bundle, third-party, analytics, defer
---

## Defer Non-Critical Third-Party Libraries

Analytics, logging, and error tracking don't block user interaction. Load them after first paint, idle time, or explicit user interaction.

**Incorrect (blocks initial bundle):**

```tsx
import { initAnalytics } from './analytics'

initAnalytics()

export function App() {
  return <Dashboard />
}
```

**Correct (loads after first paint):**

```tsx
function App() {
  useEffect(() => {
    const start = () => {
      void import('./analytics').then(module => {
        module.initAnalytics()
      })
    }

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(start)
      return () => window.cancelIdleCallback(id)
    }

    const timeoutId = window.setTimeout(start, 1500)
    return () => window.clearTimeout(timeoutId)
  }, [])

  return <Dashboard />
}
```

For features like chat widgets or session replay, defer loading until the user opens the panel or reaches the relevant route.
