# express-dedupe

> Zero-config Express middleware for request deduplication — merges identical concurrent HTTP requests into a single database call, preventing cache stampedes, thundering herd problems, and race conditions in Node.js applications.

[![npm version](https://img.shields.io/npm/v/express-dedupe.svg)](https://www.npmjs.com/package/express-dedupe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org)

---

## Table of Contents

- [The Problem](#the-problem)
- [Overview](#overview)
- [Before and After](#before-and-after)
- [Install](#install)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Options](#options)
- [Use In Any Backend](#use-in-any-backend)
- [With Redis](#with-redis-recommended)
- [Advanced Usage](#advanced-usage)
- [What It Does NOT Do](#what-it-does-not-do)
- [Performance](#performance)
- [FAQ](#faq)

---

## The Problem

Suppose your Redis cache expires at midnight. At exactly 12:00:00, 500 users hit the same API endpoint simultaneously. Every user gets a cache miss, and 500 identical database queries fire at once.

This is a **Cache Stampede** — and it is what crashes databases.

```
Cache expires at 12:00:00

12:00:00.001  User A   →  Redis MISS  →  DB query fired
12:00:00.002  User B   →  Redis MISS  →  DB query fired
12:00:00.003  User C   →  Redis MISS  →  DB query fired
...
12:00:00.100  User 500 →  Redis MISS  →  DB query fired

Total DB queries: 500  ←  database overloaded, possible crash
```

Standard Redis caching cannot prevent this. Between cache expiry and cache refill, every concurrent request bypasses the cache and hits the database directly.

The same thundering herd problem occurs without Redis — any sudden traffic spike on a cold endpoint sends every request straight to the database at once.

`express-dedupe` solves this at the millisecond level, before the database is ever reached.

---

## Overview

`express-dedupe` sits between your Express route and your database. It tracks in-flight requests using a HashMap. When a second identical request arrives while the first is still running, it attaches to the existing Promise instead of firing a new database query. When the query completes, all waiting requests receive the result simultaneously.

```
Request arrives
      ↓
Is this URL already being fetched?
      ↓
  YES → attach to existing Promise → wait → get result  (no DB call)
  NO  → run the query → store Promise → complete → serve all waiters
```

One DB query. Hundreds of users served.

---

## Before and After

### Before — Without express-dedupe

```javascript
// Normal Express route — correct code, but vulnerable to traffic spikes
import express from 'express'
import { pool } from './db'

const app = express()

app.get('/product/:id', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM products WHERE id = $1',
    [req.params.id]
  )
  res.json(result.rows[0])
})

// What happens when 500 users hit GET /product/1 at the same time:
//
//  User 1   →  pool.query("SELECT ... WHERE id = 1")  ← DB query starts
//  User 2   →  pool.query("SELECT ... WHERE id = 1")  ← same query again
//  User 3   →  pool.query("SELECT ... WHERE id = 1")  ← same query again
//  ...
//  User 500 →  pool.query("SELECT ... WHERE id = 1")  ← same query again
//
//  Result: 500 identical queries hit your database simultaneously.
//  Connections run out. Requests time out. Database crashes.
```

### After — With express-dedupe

```javascript
import express       from 'express'
import { dedupe }    from 'express-dedupe'   // ← step 1: named import
import { pool }      from './db'

const app = express()

app.use(dedupe())                             // ← step 2: one line

// Your route is unchanged — zero modifications required
app.get('/product/:id', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM products WHERE id = $1',
    [req.params.id]
  )
  res.json(result.rows[0])
})

// What happens now when 500 users hit GET /product/1 at the same time:
//
//  User 1   →  no query running yet → DB query starts, Promise stored
//  User 2   →  query in-flight → attaches to existing Promise
//  User 3   →  query in-flight → attaches to existing Promise
//  ...
//  User 500 →  query in-flight → attaches to existing Promise
//
//  DB query completes → all 500 users receive the result simultaneously
//
//  Result: 1 database query, 500 users served ✅
```

The only change is two lines. Your route, your database code, your Redis logic — all untouched.

### Summary

| | Before | After |
|---|---|---|
| DB queries on spike | 500 | 1 |
| Race conditions | possible | eliminated |
| Cache stampede | guaranteed | impossible |
| Route code changes | — | none |

---

## Install

```bash
npm install express-dedupe
```

**Requirements:**
- Node.js >= 14.0.0
- Express >= 4.0.0

---

## Quick Start

```typescript
import express     from 'express'
import { dedupe }  from 'express-dedupe'

const app = express()

app.use(dedupe())

app.get('/posts', async (req, res) => {
  const posts = await db.query('SELECT * FROM posts')
  res.json(posts)
})

app.listen(3000)
```

---

## How It Works

### Step 1 — Request arrives

```
User A  →  GET /product/1
```

### Step 2 — Deduplication key is built

```
method : "GET"
url    : "/product/1"
key    : "GET::/product/1"
```

### Step 3 — HashMap is checked

```
inFlight.has("GET::/product/1")  →  false  (first request)
```

### Step 4 — Query runs, Promise stored

```
DB query starts...
inFlight.set("GET::/product/1", Promise)
```

### Step 5 — Second user arrives while query is running

```
User B  →  GET /product/1

inFlight.has("GET::/product/1")  →  true  (query in-flight)
await inFlight.get("GET::/product/1")  →  waiting...
```

### Step 6 — Query completes, all users served

```
DB returns result
Promise resolves
User A receives result  ✅
User B receives result  ✅  (zero extra DB call)
inFlight.delete("GET::/product/1")  →  entry cleared
```

### Internal Algorithms

| Algorithm  | File             | Purpose                                  |
|------------|------------------|------------------------------------------|
| HashMap    | DedupeMap.ts     | O(1) lookup for in-flight requests       |
| LRU Cache  | LRUCache.ts      | Bounded memory — evicts oldest entries   |
| Trie       | Trie.ts          | O(m) URL pattern matching                |

---

## Options

```typescript
import { dedupe } from 'express-dedupe'

app.use(dedupe({
  ttl:          5000,        // ms to keep dedup window open      (default: 5000)
  maxSize:      1000,        // max in-flight entries in HashMap  (default: 1000)
  methods:      ['GET'],     // HTTP methods to deduplicate       (default: ['GET', 'HEAD'])
  debug:        false,       // print dedup events to console     (default: false)

  keyGenerator: (req) => {   // custom key function               (default: method + url)
    return `${req.method}::${req.url}`
  },

  skip: (req) => {           // return true to skip deduplication (default: undefined)
    return req.url.startsWith('/admin')
  }
}))
```

### Options Reference

| Option         | Type                        | Default              | Description                                        |
|----------------|-----------------------------|----------------------|----------------------------------------------------|
| `ttl`          | `number`                    | `5000`               | Max milliseconds to hold a deduplication window    |
| `maxSize`      | `number`                    | `1000`               | Max in-flight entries before LRU eviction kicks in |
| `methods`      | `string[]`                  | `['GET', 'HEAD']`    | HTTP methods to apply deduplication on             |
| `debug`        | `boolean`                   | `false`              | Log HIT / MISS / TTL EXPIRE events to console      |
| `keyGenerator` | `(req) => string`           | `method + url`       | Custom function to derive a deduplication key      |
| `skip`         | `(req) => boolean`          | `undefined`          | Return `true` to bypass deduplication for a request|
| `trie`         | `UrlPatternTrie`            | `undefined`          | Pre-populated trie for URL pattern normalisation   |

---

## Use In Any Backend

`express-dedupe` works at the HTTP layer and is completely database-agnostic. The `keyGenerator` option lets you define what makes two requests "identical" based on your own application logic.

### Simple REST API — zero config

Public endpoints, no auth. Default settings are sufficient.

```javascript
import { dedupe } from 'express-dedupe'

app.use(dedupe())

app.get('/posts', async (req, res) => {
  const posts = await db.query('SELECT * FROM posts')
  res.json(posts)
})
```

---

### E-Commerce Platform — role-based keys

Admin and guest users hit the same URL but receive different data. Include the user role in the key so results are never mixed.

```javascript
app.use(dedupe({
  keyGenerator: (req) => {
    const method = req.method.toUpperCase()
    const path   = new URL(req.url, 'http://x.com').pathname.toLowerCase()
    const role   = req.user?.role || 'guest'
    return `${method}::${path}::${role}`
    // "GET::/product/1::admin"
    // "GET::/product/1::guest"  ← separate keys, separate results
  }
}))
```

---

### SaaS Application — tenant isolation

Each tenant has isolated data. Include the tenant ID so Company A never receives Company B's response.

```javascript
app.use(dedupe({
  keyGenerator: (req) => {
    const method   = req.method.toUpperCase()
    const path     = new URL(req.url, 'http://x.com').pathname.toLowerCase()
    const tenantId = req.headers['x-tenant-id'] || 'default'
    return `${method}::${path}::${tenantId}`
    // "GET::/dashboard::company-a"
    // "GET::/dashboard::company-b"
  }
}))
```

---

### Mobile App Backend — platform-aware keys

iOS and Android share an endpoint but may receive platform-specific responses.

```javascript
app.use(dedupe({
  keyGenerator: (req) => {
    const method   = req.method.toUpperCase()
    const path     = new URL(req.url, 'http://x.com').pathname.toLowerCase()
    const platform = req.headers['x-platform'] || 'web'
    return `${method}::${path}::${platform}`
    // "GET::/feed::ios"
    // "GET::/feed::android"
    // "GET::/feed::web"
  }
}))
```

---

### Enterprise SaaS — region and plan segmentation

Serve users across regions and subscription tiers with fully isolated deduplication keys.

```javascript
app.use(dedupe({
  keyGenerator: (req) => {
    const method = req.method.toUpperCase()
    const path   = new URL(req.url, 'http://x.com').pathname.toLowerCase()
    const region = req.headers['x-region'] || 'us'
    const plan   = req.user?.plan || 'free'
    return `${method}::${path}::${region}::${plan}`
    // "GET::/report::eu::enterprise"
    // "GET::/report::us::free"
  }
}))
```

---

### Skip Specific Routes

Webhooks, auth endpoints, and any write operation should always bypass deduplication.

```javascript
app.use(dedupe({
  skip: (req) => {
    return (
      req.url.startsWith('/webhook') ||
      req.url.startsWith('/auth')    ||
      req.url.startsWith('/admin')
    )
  }
}))
```

---

### URL Pattern Normalisation with Trie

By default, `/users/1` and `/users/2` are treated as different keys. Register patterns with `UrlPatternTrie` to normalise them to the same canonical key.

```typescript
import { dedupe, UrlPatternTrie } from 'express-dedupe'

const trie = new UrlPatternTrie()
trie.insert('/users/:id')
trie.insert('/users/:id/posts/:postId')

app.use(dedupe({ trie }))

// GET /users/1   →  key "GET::/users/:id"
// GET /users/99  →  key "GET::/users/:id"  ← same key, deduplicated ✅
```

---

## With Redis (Recommended)

`express-dedupe` and Redis solve different problems and are designed to be used together.

| Tool             | Time Scale        | Problem Solved                           |
|------------------|-------------------|------------------------------------------|
| Redis            | Minutes to hours  | Serve repeated requests across time      |
| express-dedupe   | 0 – 5000ms        | Merge requests arriving simultaneously   |

```
Without express-dedupe:
  Redis expires → 500 users arrive → 500 DB queries → crash

With express-dedupe + Redis:
  Redis expires → 500 users arrive → 1 DB query → cache refilled → all 500 served ✅
```

```javascript
import express         from 'express'
import { createClient } from 'redis'
import { dedupe }      from 'express-dedupe'

const app         = express()
const redisClient = createClient()

await redisClient.connect()

// Layer 1 — millisecond guard (concurrent request deduplication)
app.use(dedupe())

app.get('/product/:id', async (req, res) => {
  const cacheKey = `product:${req.params.id}`

  // Layer 2 — minute/hour guard (persistent cache)
  const cached = await redisClient.get(cacheKey)
  if (cached) return res.json(JSON.parse(cached))

  // Layer 3 — database, reached only on a true cache miss
  const product = await db.query(
    'SELECT * FROM products WHERE id = ?',
    [req.params.id]
  )

  await redisClient.setEx(cacheKey, 180, JSON.stringify(product))
  res.json(product)
})
```

---

## Advanced Usage

### Debug Mode

```javascript
import { dedupe } from 'express-dedupe'

app.use(dedupe({ debug: true }))

// Console output:
// [dedupe] MISS → GET::/product/1
// [dedupe] HIT  → GET::/product/1
// [dedupe] HIT  → GET::/product/1
// [dedupe] TTL EXPIRE → GET::/product/1
```

### Apply Only to Specific Routes

```javascript
import { dedupe } from 'express-dedupe'

const dedupeMiddleware = dedupe()

app.get('/heavy-endpoint', dedupeMiddleware, async (req, res) => {
  const data = await db.query('SELECT * FROM large_table')
  res.json(data)
})
```

### TypeScript — Typed Key Generator

```typescript
import express          from 'express'
import type { Request } from 'express'
import { dedupe }       from 'express-dedupe'
import type { DedupeOptions } from 'express-dedupe'

const keyGenerator: DedupeOptions['keyGenerator'] = (req: Request): string => {
  const method = req.method.toUpperCase()
  const path   = new URL(req.url, 'http://x.com').pathname.toLowerCase()
  return `${method}::${path}`
}

app.use(dedupe({ keyGenerator }))
```

### Disable TTL — Clear Entry Immediately on Response

```typescript
import { dedupe, NO_TTL } from 'express-dedupe'

app.use(dedupe({ ttl: NO_TTL }))
// Entry is removed from the HashMap the moment the response finishes.
// No timer overhead. Recommended for low-latency endpoints.
```

---

## What It Does NOT Do

- Does not replace Redis or any persistent cache layer
- Does not deduplicate `POST`, `PUT`, or `DELETE` by default — write operations must always reach the database
- Does not work across multiple server instances — the HashMap lives in memory on a single Node.js process. For multi-instance deduplication, pair with a Redis distributed lock
- Does not store response data — only Promise references, cleared immediately on completion

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