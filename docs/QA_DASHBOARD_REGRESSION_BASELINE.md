# Dashboard regression baseline (v2.0.70 → recovery)

## Web desktop (≥1024px, `/dashboard`)

| Step | Expected (fixed) | Was broken |
|------|------------------|------------|
| Login → land on dashboard | Sidebar visible; header nav links work | No sidebar; nav disabled |
| Click עסקאות in header | `/transactions` loads | Disabled button |
| Click הגדרות via sidebar | `/settings` loads | No sidebar |
| Period ‹ › | Changes month; KPIs refetch | No-op |
| + עסקה | Modal saves via API | Toast "בקרוב" only |
| סנכרון | Triggers sync or navigates to accounts | No-op |
| KPI amounts | Match `/api/dashboard/summary` | Static mocks |

## Mobile (<1024px, `/dashboard`)

| Step | Expected (fixed) | Was broken |
|------|------------------|------------|
| Bottom app nav visible | 5 items incl. categories | Custom nav only on dashboard |
| Hamburger menu | Full sidebar routes | Hidden on dashboard |
| Quick actions | Navigate / sync | Empty handlers |
| אחרונות → הכל | Link to `/transactions` | Plain text |

## Automated regression (Playwright)

From `frontend/`:

```bash
npm run test:e2e
```

Covers: navigation (desktop header + mobile bottom nav), API data parity (mocked summary), axe accessibility (no critical/serious violations).

## Tablet (768–1023px, non-dashboard)

| Step | Expected (fixed) | Was broken |
|------|------------------|------------|
| Bottom nav | Visible on all routes | Hidden (`md:hidden`) while layout uses 1023px mobile |
