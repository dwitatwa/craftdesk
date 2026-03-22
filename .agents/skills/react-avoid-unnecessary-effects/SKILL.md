---
name: react-avoid-unnecessary-effects
description: Refactor React components to remove unnecessary useEffect usage by deriving values during render, memoizing expensive computations with useMemo, resetting state with key, and moving event-driven side effects into event handlers. Use when you see useEffect syncing derived state, resetting state on prop change, or triggering toasts/POST/navigation on state changes.
compatibility: Designed for React (react.dev patterns). Intended for use in OpenAI Codex and other coding agents working in React codebases.
metadata:
  source: https://react.dev/learn/you-might-not-need-an-effect
  version: "1.0"
---

# React: You Might Not Need an Effect (Refactor Skill)

This skill teaches you to **prefer derivation, memoization, keys, and event handlers** instead of reaching for `useEffect` to keep state in sync.

Use `useEffect` primarily for **synchronizing with external systems** (network, browser APIs, non-React widgets, subscriptions, timers). For everything else, it’s often clearer, faster, and less bug-prone to avoid effects.

## Goal

Given a React component (or set of components) that uses `useEffect`, refactor it to:

- Remove `useEffect` that only computes values for rendering
- Remove `useEffect` that performs event-specific work (toast, POST, navigation) in response to state changes
- Avoid “reset state on prop change” effects by using `key` or better data modeling
- Preserve behavior and improve correctness (fewer extra renders, fewer accidental side effects)

---

## Step-by-step instructions

### 1) Classify each `useEffect`

For every effect, answer:

1. **Does it talk to an external system?**
   - Examples: `fetch`, `WebSocket`, `addEventListener`, `setInterval`, imperative DOM API, third-party widgets.
   - ✅ Usually keep `useEffect` (or replace with a more specific abstraction if your codebase has one).

2. **Is it computing or syncing data for rendering?**
   - Examples: setting state to `props.a + props.b`, filtering/sorting for display, mapping to derived view models.
   - ❌ Remove the effect; compute during render (or memoize).

3. **Is it running because of a user action?**
   - Examples: show toast after “Buy”, submit analytics after “Save”, POST request after clicking.
   - ❌ Move into the event handler that represents the action.

4. **Is it trying to reset state when a prop changes?**
   - ❌ Prefer component `key` reset, or remodel state to avoid storing derived objects.

---

### 2) Remove derived state synced by an Effect

**Smell**
- You see `useEffect(() => setX(f(deps)), [deps])` where `f` is pure and `x` is only used for rendering.

**Refactor**
- Delete `x` state and the effect.
- Compute it inline during render.

**Before**
```js
const [fullName, setFullName] = useState("");
useEffect(() => {
  setFullName(firstName + " " + lastName);
}, [firstName, lastName]);
```

**After**
```js
const fullName = firstName + " " + lastName;
```

**Why this is better**
- Avoids an extra render pass caused by “render → effect → setState → render”
- Avoids stale or out-of-sync derived state

---

### 3) Memoize expensive pure computations (only if needed)

If the derived calculation is expensive and **pure**, memoize it:

```js
const visibleTodos = useMemo(
  () => getFilteredTodos(todos, filter),
  [todos, filter]
);
```

**Guideline**
- Prefer plain derivation first.
- Add `useMemo` only when you can justify the performance need (profiling, large lists, expensive transforms).

---

### 4) Replace “reset state on prop change” with a keyed subtree

**Smell**
```js
useEffect(() => {
  setComment("");
}, [userId]);
```

**Refactor**
- Split the component (outer chooses `userId`, inner owns the state).
- Put `key={userId}` on the inner component to reset its state when `userId` changes.

```jsx
function ProfilePage({ userId }) {
  return <Profile key={userId} userId={userId} />;
}

function Profile({ userId }) {
  const [comment, setComment] = useState("");
  // ...
}
```

---

### 5) Avoid “adjust some state when props change” by modeling state differently

If you’re storing an entire object in state and trying to “fix it up” when inputs change, prefer storing stable identifiers.

**Smell**
```js
const [selectedItem, setSelectedItem] = useState(items[0]);

useEffect(() => {
  setSelectedItem(items[0]);
}, [items]);
```

**Refactor idea**
- Store `selectedId` (or an index) and derive the selected object during render.

```js
const [selectedId, setSelectedId] = useState(items[0]?.id);
const selectedItem = items.find(i => i.id === selectedId) ?? null;
```

This prevents “stale object reference” issues when `items` is replaced.

---

### 6) Move event-specific side effects into event handlers

If an effect is essentially “when state becomes X, do Y”, and `Y` represents a **user action**, it likely belongs in the handler.

**Smell**
```js
useEffect(() => {
  if (isInCart) showToast("Added to cart!");
}, [isInCart]);
```

**Refactor**
```js
function handleAddToCart() {
  setIsInCart(true);
  showToast("Added to cart!");
}
```

This prevents unintended behavior such as:
- running on mount
- running after a restore/rehydration
- running due to unrelated state changes that also toggle `isInCart`

---

### 7) Notify parents in the same event (or make the component controlled)

**Smell**
```js
useEffect(() => onChange(value), [value, onChange]);
```

**Refactor**
Call `onChange` in the same function that updates local state:

```js
function setNextValue(next) {
  setValue(next);
  onChange(next);
}
```

Or remove local state entirely and use controlled props (`value`, `onChange`).

---

## Examples of inputs and outputs

### Input (common anti-pattern)
- Component uses `useEffect` to compute a `filteredList` state from `items` and `query`
- Another `useEffect` resets `draft` when `itemId` changes
- Another `useEffect` shows a toast when `saved=true`

### Output (expected refactor)
- `filteredList` computed during render (optionally `useMemo`)
- `draft` owned by keyed inner component (`key={itemId}`)
- toast triggered directly in the “Save” event handler, not a `useEffect`

---

## Common edge cases

1. **Effect does external synchronization**
   - Keep it. If it’s a subscription, include cleanup.
   - Example:
     - `addEventListener` → return cleanup to remove
     - `setInterval` → return cleanup to clear

2. **Derived state is used for something other than rendering**
   - Re-check design: if it’s still derived, consider computing it at the moment it’s needed (e.g., in a submit handler).
   - If you truly need it persisted across renders independently, it might be legitimate state.

3. **Resetting state isn’t desirable for the whole subtree**
   - Prefer identifier-based state (e.g., store IDs) or move state to the correct owner component.

4. **You removed an effect and behavior changed**
   - Confirm whether the previous behavior was relying on accidental timing (extra render).
   - If behavior must match exactly, use event handlers or restructure components; avoid reintroducing effect-based syncing unless it’s external synchronization.

---

## Acceptance criteria

- Fewer `useEffect` hooks and fewer “sync” `setState` calls
- Same UI behavior in normal use
- No new infinite render loops
- If `useMemo` is added, dependencies are correct and function is pure
