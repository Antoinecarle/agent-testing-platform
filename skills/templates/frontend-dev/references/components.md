# Component Architecture

## Pattern: Compound Components

```tsx
const Select = ({ children, value, onChange }) => {
  return (
    <SelectContext.Provider value={{ value, onChange }}>
      <div className="select">{children}</div>
    </SelectContext.Provider>
  );
};

Select.Option = ({ value, children }) => {
  const ctx = useContext(SelectContext);
  return (
    <button
      className={cn('option', { active: ctx.value === value })}
      onClick={() => ctx.onChange(value)}
    >
      {children}
    </button>
  );
};
```

## Pattern: Render Props

```tsx
interface DataLoaderProps<T> {
  fetcher: () => Promise<T>;
  children: (data: T) => ReactNode;
  fallback?: ReactNode;
}

function DataLoader<T>({ fetcher, children, fallback }: DataLoaderProps<T>) {
  const { data, isLoading, error } = useQuery({ queryFn: fetcher });
  if (isLoading) return fallback || <Skeleton />;
  if (error) return <ErrorBoundary error={error} />;
  return <>{children(data!)}</>;
}
```

## File Structure

```
components/
  Button/
    Button.tsx         # Component
    Button.test.tsx    # Tests
    Button.module.css  # Styles
    index.ts           # Re-export
```
