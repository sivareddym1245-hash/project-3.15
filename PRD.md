# Dorm Marketplace — MVP Product Requirements

## 1. Scope Cut

1. **Payments:** Buyers and sellers arrange any payment in person; processing money is outside a Day 1 prototype.
2. **Live chat:** Pickup details can be coordinated in person, avoiding the cost and moderation work of messaging.
3. **Accounts and email verification:** A shared demo name is enough to test the marketplace flow without building identity infrastructure.

## 2. MVP Features

1. Students can create a listing with a title, description, category, seller name, and a free or displayed price.
2. Students can browse and filter listings, then claim an available item for an in-person campus handoff.
3. A claim temporarily reserves one item, expires automatically if pickup is not confirmed, and can be overridden by the seller marking it sold or removing it.

## 3. Acceptance Criteria

1. **Given** an item is available, **When** two students claim it at nearly the same time, **Then** exactly one claim succeeds and the other student is told the item is no longer available.
2. **Given** a student has claimed an item, **When** they confirm pickup before the reservation expires, **Then** the item becomes sold and cannot be claimed again.
3. **Given** an item is reserved, **When** the reservation expires or the seller marks it sold/removes it, **Then** the item is respectively made available again or immediately becomes unavailable, and any active claim is invalidated.
