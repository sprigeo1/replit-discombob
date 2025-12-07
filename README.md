# Retirement Projection Dashboard

A small Next.js app that wraps Joseph's financial projection engine in an API route and ships an interactive dashboard for exploring the plan.

## Getting started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Then visit http://localhost:3000 to interact with the dashboard.

## API

`POST /api/projection` accepts an optional JSON body with `assumptions`, `expenseBuckets`, and `accounts` matching the types in `src/lib/projection.ts`. If omitted, Joseph's default scenario is used. The endpoint returns the full projection result.
