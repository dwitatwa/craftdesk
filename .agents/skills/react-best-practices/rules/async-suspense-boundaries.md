---
title: Strategic Suspense Boundaries
impact: HIGH
impactDescription: faster initial paint
tags: async, suspense, progressive-reveal, layout-shift
---

## Strategic Suspense Boundaries

Instead of blocking an entire screen on one slow region, use Suspense boundaries to reveal fast parts of the UI immediately while slower parts load.

**Incorrect (whole screen waits on one slow region):**

```tsx
function Dashboard() {
  const [reportsPanel, setReportsPanel] = useState<ReactNode | null>(null)

  useEffect(() => {
    void import('./ReportsPanel').then(module => {
      setReportsPanel(<module.ReportsPanel />)
    })
  }, [])

  return (
    <div>
      <div>Sidebar</div>
      <div>Header</div>
      <div>
        {reportsPanel ?? <Skeleton />}
      </div>
      <div>Footer</div>
    </div>
  )
}
```

This ties loading state to the parent and makes the whole screen coordinate a slow child manually.

**Correct (wrapper shows immediately, slow region suspends):**

```tsx
import { Suspense, lazy } from 'react'

const ReportsPanel = lazy(() => import('./ReportsPanel'))

function Page() {
  return (
    <div>
      <div>Sidebar</div>
      <div>Header</div>
      <div>
        <Suspense fallback={<Skeleton />}>
          <ReportsPanel />
        </Suspense>
      </div>
      <div>Footer</div>
    </div>
  )
}
```

Sidebar, Header, and Footer render immediately. Only the slow region waits.

**When NOT to use this pattern:**

- Critical data needed for layout decisions (affects positioning)
- Small, fast queries where suspense overhead isn't worth it
- When you cannot provide a stable fallback without layout shift

**Trade-off:** Faster initial paint vs potential layout shift. Choose based on your UX priorities.
