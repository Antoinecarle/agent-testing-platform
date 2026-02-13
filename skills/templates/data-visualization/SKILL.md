# Data Visualization & Dashboard Design

## Overview

Patterns and best practices for building data-rich dashboards, charts, and analytics interfaces. Focused on clarity, density, and actionable insights.

## Design Principles

1. **Data-ink ratio** — Minimize non-data visual elements
2. **Overview first, details on demand** — Summary → drill-down
3. **Consistent encoding** — Same color = same meaning everywhere
4. **Accessible** — Don't rely solely on color; use labels and patterns
5. **Real-time feel** — Show freshness indicators and auto-refresh

## Chart Selection Guide

| Data Type | Best Chart | Avoid |
|-----------|-----------|-------|
| Trend over time | Line chart | Pie chart |
| Part of whole | Stacked bar, donut | 3D charts |
| Comparison | Horizontal bar | Radar chart |
| Distribution | Histogram, box plot | Line chart |
| Correlation | Scatter plot | Bar chart |
| Geographic | Choropleth map | Table |
| Single KPI | Big number + sparkline | Full chart |

## Dashboard Layout

### KPI Row (top)
```
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ MRR  │ │Users │ │ Conv │ │Churn │
│$125K │ │12.4K │ │ 3.2% │ │ 1.1% │
│ +12% │ │ +340 │ │ +0.3 │ │ -0.2 │
└──────┘ └──────┘ └──────┘ └──────┘
```

### Chart Grid (middle)
```
┌─────────────────┐ ┌──────────┐
│ Revenue trend    │ │ Top      │
│ (line chart)     │ │ channels │
│                  │ │ (bar)    │
└─────────────────┘ └──────────┘
┌──────────┐ ┌─────────────────┐
│ Funnel   │ │ Activity heatmap│
│          │ │                 │
└──────────┘ └─────────────────┘
```

## Color Palettes for Data

### Sequential (low to high)
```
#E8E8FD → #C4B5FD → #8B5CF6 → #6D28D9 → #4C1D95
```

### Diverging (negative ← neutral → positive)
```
#EF4444 → #FCA5A5 → #E5E5E5 → #86EFAC → #22C55E
```

### Categorical (distinct items)
```
#8B5CF6, #3B82F6, #22C55E, #F59E0B, #EF4444, #EC4899
```

## Number Formatting

| Value | Display | Rule |
|-------|---------|------|
| 1234567 | 1.23M | Abbreviate millions |
| 12345 | 12.3K | Abbreviate thousands |
| 0.0342 | 3.4% | Percentage with 1 decimal |
| 1234.56 | $1,234.56 | Currency with separator |
| -0.12 | -12% ↓ | Negative with arrow indicator |

## Interaction Patterns

- **Hover**: Show tooltip with exact value + context
- **Click**: Drill down to detail view
- **Time range**: Selector for 7d/30d/90d/1y/custom
- **Compare**: Toggle to overlay previous period
- **Export**: CSV download for any chart/table
