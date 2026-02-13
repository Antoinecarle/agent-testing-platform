# Component Catalog

## Buttons

### Primary Button
```css
.btn-primary {
  background: var(--color-primary);
  color: #fff;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s ease;
}
.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139,92,246,0.4);
}
```

### Secondary Button
```css
.btn-secondary {
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  transition: border-color 0.2s;
}
```

## Cards

### Content Card
```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.card:hover {
  border-color: var(--color-border-strong);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}
```

## Inputs

### Text Input
```css
.input {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 10px 12px;
  color: var(--color-text-primary);
  font-size: 14px;
  transition: border-color 0.2s;
}
.input:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 3px rgba(139,92,246,0.15);
}
```

## Navigation

### Sidebar
- Width: 240px (collapsed: 64px)
- Background: var(--color-surface)
- Border-right: 1px solid var(--color-border)
- Nav items: 40px height, 8px padding, 6px border-radius
- Active state: var(--color-primary-muted) background

### Top Bar
- Height: 56px
- Background: var(--color-surface)
- Border-bottom: 1px solid var(--color-border)
- Padding: 0 24px
