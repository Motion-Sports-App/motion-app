# Motion — court booking prototype

A sporty multi-sport court discovery and demo-booking web app built with Next.js, React, TypeScript and Tailwind CSS.

## Requirements
- Node.js 20.9+ (recommended)
- npm

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## What's in this prototype
- Responsive landing and court discovery page
- Sport, location, search and hourly-price filters
- Sample venue cards and detail modal
- Demo date/time selection and confirmation
- Session-only booking state and demo owner dashboard

## Important limitations
- Venue details, ratings, prices, and availability are illustrative sample data.
- Bookings are stored in React state only; refreshing the page clears them.
- No accounts, payment processing, venue integrations, or real reservations are implemented.
- Do not treat this prototype as a production booking system.

## Next development milestones
1. Connect Supabase and create `venues`, `courts`, `availability` and `bookings` tables.
2. Add Supabase Auth and player/venue-owner roles with Row Level Security.
3. Implement a database-safe booking transaction to prevent double booking.
4. Add owner forms to create/edit venues, courts, hours and prices.
5. Add map/search integrations, real venue verification, and payment handling if needed.
6. Evaluate LINE Login/LIFF after the web flow is validated.

## Project structure

```text
app/
  globals.css
  layout.tsx
  page.tsx
components/   # reusable UI components can be extracted here
lib/
  data.ts     # sample venue data and types
```
