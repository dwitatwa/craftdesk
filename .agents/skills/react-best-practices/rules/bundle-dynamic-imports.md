---
title: Dynamic Imports for Heavy Components
impact: CRITICAL
impactDescription: directly affects TTI and LCP
tags: bundle, dynamic-import, code-splitting, lazy-loading
---

## Dynamic Imports for Heavy Components

Use `React.lazy()` and dynamic `import()` to lazy-load large components not needed on initial render.

**Incorrect (Monaco bundles with main chunk ~300KB):**

```tsx
import { MonacoEditor } from './monaco-editor'

function CodePanel({ code }: { code: string }) {
  return <MonacoEditor value={code} />
}
```

**Correct (Monaco loads on demand):**

```tsx
import { Suspense, lazy } from 'react'

const MonacoEditor = lazy(() =>
  import('./monaco-editor').then(module => ({ default: module.MonacoEditor }))
)

function CodePanel({ code }: { code: string }) {
  return (
    <Suspense fallback={<div>Loading editor…</div>}>
      <MonacoEditor value={code} />
    </Suspense>
  )
}
```

For non-component utilities, use `await import('./heavy-module')` inside the event handler or code path that needs it.
