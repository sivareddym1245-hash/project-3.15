# Dorm Marketplace

A small, database-free marketplace prototype for campus items. It uses a single Node.js process with in-memory state, so all browser sessions connected to that process share listings and claims.

## Run locally

Requires Node.js 18 or newer.

```sh
node server.js
```

Open [http://localhost:3000](http://localhost:3000). Set `PORT` to change the port. Claims last 60 seconds by default; set `CLAIM_TTL_SECONDS` to a shorter value (for example `15`) to demonstrate expiry.

## Try the important flows

- Claim the same item from two browser tabs. The first request reserves it; the other is rejected.
- Leave a claim unconfirmed until its countdown ends. The item returns to Available.
- Confirm pickup to mark an item Sold.
- Use the seller controls on an available or reserved item to mark it sold elsewhere or remove it.

Seller tools and names are intentionally unauthenticated in this prototype. State resets to the sample listings when the server restarts; this is not production identity, persistence, or authorization.

## Tests

```sh
node --test
```
