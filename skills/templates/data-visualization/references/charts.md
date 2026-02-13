# Chart Implementation Patterns

## Sparkline (inline mini chart)

Small trend indicator next to a KPI number. No axes, no labels — just the shape.

```css
.sparkline {
  width: 60px;
  height: 20px;
  display: inline-block;
}
```

Best for: KPI cards, table cells, compact dashboards

## KPI Card with Trend

```
┌─────────────────────┐
│ MONTHLY REVENUE     │
│ $125,400    +12.3%  │
│ ▁▂▃▃▅▆▇█ (sparkline)│
│ vs $111,700 prev    │
└─────────────────────┘
```

Key elements:
- Label (uppercase, muted)
- Value (large, bold)
- Change indicator (colored: green up, red down)
- Sparkline for context
- Comparison to previous period

## Table with Data Bars

Embed horizontal bars directly in table cells to show relative magnitude:

```
| Region     | Revenue  | Bar          |
|------------|----------|-------------|
| North      | $45,000  | ████████░░ |
| South      | $32,000  | █████░░░░░ |
| East       | $28,000  | ████░░░░░░ |
| West       | $51,000  | ██████████ |
```

## Heatmap Calendar

Show activity density across days (like GitHub contributions):

```
Mon  ░░█░██░░░░█░░██░
Tue  ░██░░█░░██░░░░█░
Wed  ███░░░░░░█████░░
Thu  ░░░█░░██░░░░█░░░
Fri  ░██░░████░░░░███
```

Colors: 5 levels from `transparent` → `accent at 100%`
