# express-dedupe

> Zero-config Express middleware for request deduplication — merges identical concurrent HTTP requests into a single database call, preventing cache stampedes, thundering herd problems, and race conditions in Node.js applications.

[![npm version](https://img.shields.io/npm/v/express-dedupe.svg)](https://www.npmjs.com/package/express-dedupe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org)

---
# express-dedupe

**Your database is getting hit 500 times for the same request. Here's why that's killing your app.**

When 500 users load the same page at the same time, your server fires 500 identical database queries — all at once. Your database chokes. Your app slows down. Users see errors.

This is called a **cache stampede**. It's common. It's silent. And it crashes real apps.

---

**express-dedupe fixes this with 2 lines of code.**

It intercepts duplicate requests and merges them into one. Instead of 500 DB queries, only **1 runs**. Every user still gets their response — instantly.

```bash
npm install express-dedupe
```

```js
import { dedupe } from 'express-dedupe'

app.use(dedupe()) // done. your routes need zero changes.
```

No config. No rewrites. Works with any database.
---

## Performance

| Scenario                      | Without Package   | With Package    |
|-------------------------------|-------------------|-----------------|
| 500 users, Redis HIT          | 500 Redis reads   | 500 Redis reads |
| 500 users, Redis MISS         | 500 DB queries    | 1 DB query      |
| 500 users, no cache           | 500 DB queries    | 1 DB query      |
| HashMap lookup                | —                 | O(1)            |
| Memory per in-flight entry    | —                 | 1 Promise ref   |
| Memory when idle              | —                 | 0               |

---

## FAQ

**Does it work without Redis?**
Yes. Redis is completely optional. `express-dedupe` works on any Express backend regardless of caching layer.

**Does it work with MongoDB, PostgreSQL, MySQL, or any ORM?**
Yes. The middleware operates at the HTTP request layer and has no knowledge of — or dependency on — which database or ORM sits underneath.

**What if the database query throws an error?**
The error is propagated to all waiting requests. Every user attached to that in-flight Promise receives the same error response. The HashMap entry is cleared immediately so the next request starts fresh.

**Is it safe for POST requests?**
No. POST is a write operation and each call must reach the database independently. `express-dedupe` applies to `GET` and `HEAD` by default. Never add `POST` to `methods`.

**Does it work with Node.js clusters or horizontal scaling?**
Each process maintains its own in-flight HashMap. Deduplication is scoped to a single process. For cluster-wide deduplication across multiple instances use a Redis-based distributed lock.

**How is this different from Redis caching?**
Redis stores query results for minutes or hours. `express-dedupe` merges requests that arrive within the same millisecond window before a result exists. They target different time scales and are designed to complement each other — not compete.

**Can I use it with TypeScript?**
Yes. The package ships with full TypeScript definitions. All options, types, and the `UrlPatternTrie` class are fully typed and exported.