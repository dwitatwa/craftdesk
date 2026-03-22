---
title: Share Request Deduplication Across Components
impact: MEDIUM-HIGH
impactDescription: automatic deduplication
tags: client, deduplication, data-fetching, caching
---

## Share Request Deduplication Across Components

Multiple components often ask for the same data at the same time. Share an in-flight request and cache the result so the browser does the work once.

**Incorrect (no deduplication, each instance fetches):**

```tsx
function UserList() {
  const [users, setUsers] = useState([])
  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(setUsers)
  }, [])
}
```

**Correct (multiple instances share one request):**

```tsx
const resultCache = new Map<string, unknown>()
const inFlightCache = new Map<string, Promise<unknown>>()

async function fetchOnce<T>(key: string, loader: () => Promise<T>): Promise<T> {
  if (resultCache.has(key)) {
    return resultCache.get(key) as T
  }

  if (!inFlightCache.has(key)) {
    inFlightCache.set(
      key,
      loader().then(result => {
        resultCache.set(key, result)
        inFlightCache.delete(key)
        return result
      })
    )
  }

  return inFlightCache.get(key) as Promise<T>
}

function useSharedUsers() {
  const [users, setUsers] = useState<User[] | null>(null)

  useEffect(() => {
    void fetchOnce('/api/users', async () => {
      const response = await fetch('/api/users')
      return response.json() as Promise<User[]>
    }).then(setUsers)
  }, [])

  return users
}

function UserList() {
  const users = useSharedUsers()
  return <UsersTable users={users ?? []} />
}
```

For production apps, a shared client cache library such as SWR, TanStack Query, or your router’s data cache can provide this behavior with retries, revalidation, and invalidation built in.
