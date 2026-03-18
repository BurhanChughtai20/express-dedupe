# express-dedupe

> Zero-config Express middleware that merges identical concurrent requests into a single DB call — preventing cache stampedes, thundering herds, and race conditions.

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
- [FAQ](#faq)

---

## The Problem
Suppose that your Redis cache is set to expire at midnight. Now, at exactly 12:00:00, 500 different users hit the same API endpoint. Every user has a cache miss, and every user has a database query fired off. The database is receiving 500 identical queries, all in the span of 1 second.

This is known as a **Cache Stampede**, and this is what causes the database crash.

```
Cache expires at 12:00:00

12:00:00.001  User A   →   Redis MISS  →  DB query fired
12:00:00.002  User B   →   Redis MISS  →  DB query fired
12:00:00.003  User C   →   Redis MISS  →  DB query fired
...
12:00:00.100  User 500 →   Redis MISS  →  DB query fired

Total DB queries: 500  ←  database overloaded, possible crash
```

Basic Redis Caching cannot stop this from happening. During the time between when the cache expires and when the cache is refilled with the new value, the cache is essentially empty. Every user that makes a query during this time makes a direct query to the database.

The same problem happens without Redis too. When your app gets a sudden
traffic spike on a cold endpoint, all requests hit the database at once.

---

## Overview

`express-dedupe` sits between your route and your database. It tracks which
requests are currently in-flight using a HashMap. When a second identical
request arrives while the first is still running, it attaches to the same
Promise instead of firing a new database query. When the query completes,
all waiting requests receive the result simultaneously.

```
Request arrives
      ↓
Is this URL already being fetched?
      ↓
  YES → attach to existing Promise → wait → get result (no DB call)
  NO  → run the query → store Promise → complete → serve all waiters
```

One DB query. Hundreds of users served.

---

## Before and After

What is actually happening — read this first
Many users ask for the same information at exactly the same instant.
Your server launches several identical database queries all at
once. Each of these queries is doing exactly the same work. This
is useless work, and it can be so much work that it slows down or
crashes your database.
express-dedupe catches these identical queries and waits for
the first one to complete. Instead of launching another database
query, it simply returns the results of that first query to all
the users who were waiting for it. The database does only one
query.

### Before — Without express-dedupe

// This is a normal Express route with SQL
// Nothing wrong here — until traffic spikes

import express from 'express'
import { pool } from './db'       // your SQL connection pool

const app = express()

app.get('/product/:id', async (req, res) => {

  // Step 1: query the database
  const result = await pool.query(
    'SELECT * FROM products WHERE id = $1',
    [req.params.id]
  )

  // Step 2: send response
  res.json(result.rows[0])
})

// What happens when 500 users hit GET /product/1 at the same time:
//
//  User 1  →  pool.query("SELECT ... WHERE id = 1")  ← DB query starts
//  User 2  →  pool.query("SELECT ... WHERE id = 1")  ← same query again
//  User 3  →  pool.query("SELECT ... WHERE id = 1")  ← same query again
//  ...
//  User 500 → pool.query("SELECT ... WHERE id = 1")  ← same query again
//
//  Result: 500 identical queries hit your database simultaneously
//  Your database slows down, connections run out, requests time out

### After — With express-dedupe
import express        from 'express'
import dedupe         from 'express-dedupe'   // ← step 1: import package
import { pool }       from './db'

const app = express()

app.use(dedupe())                              // ← step 2: add one line

// Your route code does not change at all
app.get('/product/:id', async (req, res) => {

  const result = await pool.query(
    'SELECT * FROM products WHERE id = $1',
    [req.params.id]
  )

  res.json(result.rows[0])
})

// What happens now when 500 users hit GET /product/1 at the same time:
//
//  User 1   →  no query running yet → DB query starts, stored in memory
//  User 2   →  query already running → wait for User 1's result
//  User 3   →  query already running → wait for User 1's result
//  ...
//  User 500 →  query already running → wait for User 1's result
//
//  DB query finishes → all 500 users receive the result simultaneously
//
//  Result: 1 database query, 500 users served ✅


The only change is two lines. Your route code stays exactly the same.

## Summary — what changes and what does not
What you add:
  import dedupe from 'express-dedupe'
  app.use(dedupe())

What stays exactly the same:
  Your database code       — pool.query, findOne, anything
  Your Redis code          — get, setEx, no changes
  Your route structure     — handlers unchanged
  Your response format     — res.json same as before

What changes behind the scenes:
  500 DB queries  →  1 DB query
  Race condition  →  resolved automatically
  Cache stampede  →  impossible

## Install

```bash
npm install express-dedupe
```

Requirements:
- Node.js >= 14.0.0
- Express >= 4.0.0

---

## How It Works

### Step 1 — Request arrives

```
User A  →  GET /product/1
```

### Step 2 — Key is built

```
method : "GET"
url    : "/product/1"
key    : "GET::/product/1"
```

### Step 3 — HashMap is checked

```
inFlight.has("GET::/product/1")  →  false  (first request)
```

### Step 4 — Query runs, Promise stored in HashMap

```
DB query starts...
inFlight.set("GET::/product/1", Promise)
```

### Step 5 — Second user arrives while query is running

```
User B  →  GET /product/1

inFlight.has("GET::/product/1")  →  true  (query in-flight)
await inFlight.get("GET::/product/1")  →  wait...
```

### Step 6 — Query completes, all users served

```
DB returns result
Promise resolves
User A receives result  ✅
User B receives result  ✅  (zero extra DB call)
inFlight.delete("GET::/product/1")  →  map cleaned
```

### Internal Algorithms

| Algorithm   | File              | Purpose                                   |
|-------------|-------------------|-------------------------------------------|
| HashMap     | DedupeMap.js      | O(1) lookup for in-flight requests        |
| LRU Cache   | LRUCache.js       | Bounded memory — evicts oldest entries    |
| Trie        | Trie.js           | O(m) URL pattern matching for skip rules  |
| Two Pointer | QueueDrainer.js   | Efficient backlog drain on traffic spikes |
| Min Heap    | PriorityQueue.js  | Priority-based request ordering           |

---

## Options

```
app.use(dedupe({
  ttl:        100,          // ms to keep dedup window open      (default: 100)
  maxSize:    1000,         // max in-flight entries in HashMap  (default: 1000)
  methods:    ['GET'],      // HTTP methods to deduplicate       (default: ['GET'])
  debug:      false,        // print dedup events to console     (default: false)

  keyBuilder: (req) => {    // custom key function               (default: method + url)
    return `${req.method}::${req.url}`
  },

  skip: (req) => {          // return true to skip dedup         (default: null)
    return req.url.startsWith('/admin')
  }
}))
```

### Options Table

| Option       | Type       | Default   | Description                                    |
|--------------|------------|-----------|------------------------------------------------|
| ttl          | number     | 100       | Max ms to hold a dedup window open             |
| maxSize      | number     | 1000      | Max in-flight entries before LRU eviction      |
| methods      | string[]   | ['GET']   | HTTP methods to apply deduplication on         |
| debug        | boolean    | false     | Log dedup events to console                    |
| keyBuilder   | function   | method+url| Custom function to build key from request      |
| skip         | function   | null      | Return true to bypass deduplication            |

---

## Use In Any Backend

express-dedupe is not built for one type of application. The `keyBuilder`
option lets each developer define what makes two requests "identical" based
on their own application logic.

### Simple REST API — zero config

No auth, no roles, public endpoints. Default settings work perfectly.

```javascript
app.use(dedupe())

app.get('/posts', async (req, res) => {
  const posts = await db.query('SELECT * FROM posts')
  res.json(posts)
})
```

---

### E-Commerce Platform — role based

Admin and guest users hit the same URL but receive different data.
Include the user role in the key so their results never get mixed up.

```
app.use(dedupe({
  keyBuilder: (req) => {
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

### SaaS Application — tenant based

Each company has their own data. Include the tenant ID so Company A
never receives Company B's data.

```
app.use(dedupe({
  keyBuilder: (req) => {
    const method   = req.method.toUpperCase()
    const path     = new URL(req.url, 'http://x.com').pathname.toLowerCase()
    const tenantId = req.headers['x-tenant-id'] || 'default'
    return `${method}::${path}::${tenantId}`
    // "GET::/dashboard::company-A"
    // "GET::/dashboard::company-B"
  }
}))
```

---

### Mobile App Backend — platform based

iOS and Android hit the same endpoint but may receive different responses.
Use the platform header as part of the key.

```
app.use(dedupe({
  keyBuilder: (req) => {
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

### Enterprise SaaS — region and plan based

Large enterprise apps serve users from different regions on different plans.

```
app.use(dedupe({
  keyBuilder: (req) => {
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

### Browser Extension Backend — no auth

Extensions call simple config or settings endpoints with no user context.
Zero config is enough.

```
app.use(dedupe({ ttl: 50 }))

app.get('/api/config', async (req, res) => {
  const config = await db.query('SELECT * FROM config')
  res.json(config)
})

```

---

### Skip Specific Routes

Webhooks, auth routes, and write operations should never be deduplicated.

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

## With Redis (Recommended)

express-dedupe and Redis solve different problems and work best together.

| Tool            | Time Scale       | Problem Solved                          |
|-----------------|------------------|-----------------------------------------|
| Redis           | Minutes to hours | Serve repeated requests over time       |
| express-dedupe  | 0 to 100ms       | Merge requests arriving simultaneously  |

```
Without express-dedupe:
  Redis expires → 500 users arrive → 500 DB queries → crash

With express-dedupe + Redis:
  Redis expires → 500 users arrive → 1 DB query → all 500 served ✅
```

```javascript
const express    = require('express')
const redis      = require('redis')
const dedupe     = require('express-dedupe')

const app         = express()
const redisClient = redis.createClient()

await redisClient.connect()

// Layer 1 — millisecond guard
app.use(dedupe())

app.get('/product/:id', async (req, res) => {
  const key = `product:${req.params.id}`

  // Layer 2 — minutes / hours guard
  const cached = await redisClient.get(key)
  if (cached) return res.json(JSON.parse(cached))

  // Layer 3 — database, only on true miss
  const product = await db.query(
    'SELECT * FROM products WHERE id = ?',
    [req.params.id]
  )

  await redisClient.setEx(key, 180, JSON.stringify(product))
  res.json(product)
})
```

---

## Advanced Usage

### Debug Mode

```javascript
app.use(dedupe({ debug: true }))

// Console output:
// [express-dedupe] NEW   GET::/product/1
// [express-dedupe] WAIT  GET::/product/1  (request 2 waiting)
// [express-dedupe] WAIT  GET::/product/1  (request 3 waiting)
// [express-dedupe] DONE  GET::/product/1  (3 served, 1 DB query)
```

### Apply Only To Specific Routes

```javascript
const dedupeMiddleware = dedupe()

app.get('/heavy-endpoint', dedupeMiddleware, async (req, res) => {
  const data = await db.query('SELECT * FROM large_table')
  res.json(data)
})
```

### TypeScript

```typescript
import express, { Request } from 'express'
import dedupe, { KeyBuilder } from 'express-dedupe'

const app = express()

const myKey: KeyBuilder = (req: Request): string => {
  const method = req.method.toUpperCase()
  const path   = new URL(req.url, 'http://x.com').pathname.toLowerCase()
  return `${method}::${path}`
}

app.use(dedupe({ keyBuilder: myKey }))
```

---

## What It Does NOT Do

- Does not replace Redis or any persistent cache layer
- Does not deduplicate POST, PUT, DELETE by default — write operations
  must reach the database every time
- Does not work across multiple server instances — the HashMap lives in
  memory on a single process. For multi-server dedup, pair with a Redis
  distributed lock
- Does not store data — only Promises, cleared immediately on completion

---

## Performance

| Scenario                    | Without Package  | With Package   |
|-----------------------------|------------------|----------------|
| 500 users, Redis HIT        | 500 Redis reads  | 500 Redis reads|
| 500 users, Redis MISS       | 500 DB queries   | 1 DB query     |
| 500 users, no cache         | 500 DB queries   | 1 DB query     |
| HashMap lookup overhead     | —                | O(1)           |
| Memory per in-flight entry  | —                | 1 Promise ref  |

---

## FAQ

**Does it work without Redis?**
Yes. Redis is optional. Works on any Express backend.

**Does it work with MongoDB, PostgreSQL, MySQL?**
Yes. The package operates at the HTTP layer and does not care which
database you use underneath.

**What if the DB query throws an error?**
The error is propagated to all waiting requests. Every waiting user
receives the same error. The HashMap entry is cleared immediately.

**Is it safe for POST requests?**
No. POST is a write operation — each one should hit the database.
The package only applies to GET by default.

**Does it work with Node.js clusters?**
Each process has its own in-flight HashMap. Deduplication works within
one process only. For cluster-wide deduplication use a Redis-based lock.

**How is it different from Redis caching?**
Redis stores results for minutes or hours. This package merges requests
that arrive within the same milliseconds window. They are designed to
be used together, not as alternatives.
