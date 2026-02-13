# Component Reference

## Stat Card

```html
<div style="background: #141415; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 14px;">
  <div style="display: flex; align-items: center; gap: 6px; color: #52525B; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 6px;">
    <svg>...</svg> Label
  </div>
  <div style="font-size: 22px; font-weight: 700; color: #F4F4F5;">42</div>
</div>
```

## Badge / Tag

```html
<span style="background: rgba(139,92,246,0.12); color: #8B5CF6; padding: 2px 8px; border-radius: 100px; font-size: 10px; font-weight: 600; text-transform: uppercase;">
  Label
</span>
```

## Empty State

```html
<div style="border: 1px dashed rgba(255,255,255,0.15); border-radius: 12px; padding: 60px 20px; text-align: center;">
  <svg style="color: #52525B; margin-bottom: 12px;">...</svg>
  <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 6px;">No items found</h3>
  <p style="color: #52525B; font-size: 12px;">Description text here.</p>
</div>
```

## Modal Pattern

```
Overlay:  rgba(0,0,0,0.8) + backdrop-filter: blur(4px)
Content:  Layer 1 bg, subtle border, 8px radius
Header:   padding 14px 20px, border-bottom
Footer:   padding 12px 20px, border-top, Layer 2 bg
Width:    400-600px depending on content
```

## Sidebar Navigation

```
Width: 240px
Background: Layer 1
Active item: accent color text + accent/12 bg
Hover: rgba(255,255,255,0.03) bg
Font: 12px, 500 weight
Padding: 5px 10px per item
```
