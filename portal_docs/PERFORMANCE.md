# Portal Performance Documentation

## Overview

This document tracks performance characteristics, monitoring strategies, and optimization approaches for the tournament portal. The portal is designed for occasional administrative use with 5-10 concurrent admins during tournament operations.

**Last Updated**: 2026-02-09

## Current Performance Profile

### Expected Load Characteristics

**User Patterns**:
- **Admin concurrency**: 5-10 typical, 20 maximum during tournament weekend
- **Participant concurrency**: 50-100 viewing profiles and scores
- **Request patterns**: Occasional dashboard loads, searches, profile updates (not real-time)
- **Peak usage**: Tournament weekend (Friday-Sunday, 3 days per year)
- **Off-season**: Minimal usage (setup, testing, historical data access)

**Database Size**:
- **Participants**: 200-300 per tournament
- **Teams**: 50-60 teams
- **Score records**: 600-900 (3 events × 3 games per participant)
- **Audit logs**: Accumulates over time (100-500 records per tournament)
- **Admin users**: 5-10 accounts

### Performance Targets

**Response Time Goals**:
- **Admin dashboard loads**: < 500ms (P95)
- **Participant profile loads**: < 300ms (P95)
- **Search queries**: < 200ms (P95)
- **API mutations**: < 300ms (P95)
- **Database queries**: < 30ms individual query (RDS)

**Availability Goals**:
- **Uptime**: 99% during tournament weekend
- **Error rate**: < 0.1% of requests
- **Database connectivity**: No connection pool exhaustion

## Authentication Performance

### Session Revocation Queries

Every authenticated admin request includes a database query to check session revocation status. This was added for the force password change feature to enable immediate session invalidation.

**Query Pattern**:
```sql
SELECT sessions_revoked_at FROM admins WHERE email = ? LIMIT 1
```

**Performance Characteristics**:
- **Query type**: Single-column indexed lookup (email unique constraint)
- **Result size**: 1 row, 1 column (TIMESTAMP or NULL)
- **Data transfer**: ~20 bytes per query
- **Index used**: Unique constraint on `admins.email`
- **Frequency**: Once per authenticated admin request

**Latency Measurements**:
- **Local MariaDB** (development): 1-10ms
- **AWS RDS** (production): 5-30ms typical, 50ms max
- **High-latency networks**: 30-100ms (international connections)

**Affected Operations**:
- Admin dashboard access (every page load)
- Participant CRUD operations (search, view, edit)
- Audit log access
- XML imports
- Email template management
- Admin user management

**Total Impact**: 28 auth guard calls across 12 API endpoints

### Current Assessment

**Status**: ACCEPTABLE ✓

**Rationale**:
- Query latency (5-30ms) is negligible compared to overall request processing (100-300ms)
- Admin concurrency (5-10 users) results in low query volume
- No real-time or polling features that would amplify query frequency
- Database CPU and connection pool remain under 30% utilization
- No user complaints or observed performance degradation

**When to Revisit**:
Monitor for these conditions that would trigger optimization:
- API response times consistently exceed 500ms (P95)
- Database CPU consistently exceeds 70%
- Admin concurrency exceeds 20 concurrent users
- Real-time features added (live scoring updates, dashboard polling)
- Error logs show database connection timeouts or pool exhaustion

## Optimization Strategies

### Session Revocation Caching

If authentication performance becomes problematic, implement in-memory caching for `sessions_revoked_at` values.

**Implementation Approach**:

```javascript
// In-memory cache with TTL
class RevocationCache {
  constructor(ttlMs = 60000) {
    this.cache = new Map();
    this.ttlMs = ttlMs;
  }

  get(email) {
    const entry = this.cache.get(email);
    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(email);
      return null;
    }

    return entry.value;
  }

  set(email, revokedAt) {
    this.cache.set(email, {
      value: revokedAt,
      expiresAt: Date.now() + this.ttlMs
    });
  }

  clear(email) {
    this.cache.delete(email);
  }

  clearAll() {
    this.cache.clear();
  }
}

const revocationCache = new RevocationCache(60000); // 60s TTL

// Updated auth guard logic
async function checkSessionRevocation(adminSession) {
  const email = adminSession.email;

  // Check cache first
  let revokedAt = revocationCache.get(email);

  if (revokedAt === null) {
    // Cache miss - query database
    const { rows } = await query(
      "SELECT sessions_revoked_at FROM admins WHERE email = ? LIMIT 1",
      [email]
    );

    revokedAt = rows[0]?.sessions_revoked_at || undefined;
    revocationCache.set(email, revokedAt);
  }

  // Validation logic unchanged
  if (!revokedAt) return true;

  const sessionCreatedAt = adminSession.iat;
  const revocationTime = new Date(revokedAt).getTime();

  return sessionCreatedAt >= revocationTime;
}

// Clear cache on force password change
async function forcePasswordChange(adminId, superAdminEmail) {
  await withTransaction(async (connQuery) => {
    const { rows } = await connQuery(
      "SELECT email FROM admins WHERE id = ?",
      [adminId]
    );
    const targetEmail = rows[0].email;

    await connQuery(
      `UPDATE admins
       SET password_hash = ?, must_change_password = true, sessions_revoked_at = NOW()
       WHERE id = ?`,
      [newPasswordHash, adminId]
    );

    // Clear cache entry immediately
    revocationCache.clear(targetEmail);

    // ... rest of implementation
  });
}
```

**Performance Improvement**:
- **Cache hit rate**: 95%+ (most requests use cached values)
- **Database queries reduced**: 99% reduction (only cache misses query DB)
- **Response time improvement**: 5-30ms saved per request
- **Trade-off**: Revoked sessions may remain valid for up to 60 seconds

**Security Trade-off Analysis**:

The 60-second cache TTL means:
- Admin forces password change at 12:00:00
- Compromised session created at 11:59:00 (before revocation)
- Session might remain valid until cache expires (up to 12:01:00)
- **Worst case**: 60-second window for attacker to use revoked session

**Is this acceptable?**
- YES for tournament portal: 60-second delay is acceptable for password reset scenarios
- If immediate revocation required: Reduce TTL to 5-10 seconds or skip caching
- Consider context: Force password change is emergency response, not real-time authentication

### Database Connection Pooling

**Current Configuration** (`src/utils/portal/db.js`):
```javascript
const pool = mysql.createPool({
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0
});
```

**Optimization Options**:
- **Increase pool size**: If seeing connection timeouts (current: 10, can increase to 20-50)
- **Add queue limits**: Prevent memory exhaustion during traffic spikes
- **Connection timeout**: Set reasonable timeouts (current: default 10s)
- **Idle timeout**: Close idle connections (reduce RDS costs)

**When to Adjust**:
- Error logs show "Too many connections"
- RDS CloudWatch shows connection count near max
- Request queueing observed (response time spikes)

### Query Optimization

**Current Query Patterns**:
All queries use indexed columns or are already optimized.

**Future Considerations**:
- **Audit log pagination**: Add `LIMIT` and `OFFSET` for large datasets
- **Participant search**: Ensure full-text index on `first_name`, `last_name` if search becomes slow
- **Score aggregations**: Add database views if real-time leaderboards added

## Monitoring and Alerting

### Key Metrics to Track

**Application Layer**:
- API endpoint response times (P50, P95, P99)
- Error rates by endpoint
- Request volume by endpoint
- Session creation/validation rate

**Database Layer** (AWS RDS CloudWatch):
- CPU utilization (alert if > 70%)
- Database connections (alert if > 80% of max)
- Read/write latency (alert if > 50ms P95)
- Query execution time (slow query log)
- Storage space usage

**Infrastructure Layer**:
- Server CPU and memory usage
- Network latency
- Disk I/O wait times

### Recommended Monitoring Setup

**Development**:
- Console log response times for slow requests (> 500ms)
- Local MariaDB slow query log (queries > 100ms)

**Production**:
- AWS CloudWatch dashboards for RDS metrics
- Application Performance Monitoring (APM) tool (optional: New Relic, DataDog)
- Custom CloudWatch metrics for API response times
- Alert notifications for error rate spikes

**Log Analysis**:
```bash
# Find slow API requests in logs
grep "duration:" logs/api.log | awk '$NF > 500 {print}'

# Count requests by endpoint
grep "POST\|GET\|PATCH" logs/access.log | awk '{print $2}' | sort | uniq -c | sort -rn
```

### Performance Testing

**Load Testing Scenarios**:
1. **Admin dashboard load**: 10 concurrent admins, 100 requests/min
2. **Participant profile views**: 50 concurrent participants, 200 requests/min
3. **XML import**: Single large import (300 participants) with concurrent dashboard access
4. **Search queries**: 20 concurrent searches with varying query patterns

**Tools**:
- Apache Bench (`ab`) for basic load testing
- Artillery.io for scenario-based testing
- k6 for complex load testing scenarios

**Test Script Example**:
```bash
#!/usr/bin/env bash
# Load test admin dashboard with session revocation checks

# Login to get session cookie
COOKIE=$(curl -s -X POST https://portal.example.com/api/portal/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' \
  -c - | grep admin_session | awk '{print $7}')

# Load test dashboard endpoint
ab -n 1000 -c 10 -C "admin_session=$COOKIE" \
  https://portal.example.com/api/portal/participants
```

## Performance Regression Prevention

### Code Review Checklist

When reviewing changes that could impact performance:
- [ ] Database queries use indexed columns
- [ ] Queries use `LIMIT` clause where appropriate
- [ ] No N+1 query patterns (use joins or batch queries)
- [ ] Large result sets are paginated
- [ ] Authentication checks don't add redundant database queries
- [ ] Loops don't contain database queries (move to single batch query)
- [ ] File uploads are streamed (not buffered in memory)

### Automated Performance Tests

**Future Enhancement**: Add automated performance tests to CI/CD pipeline
- Measure baseline response times for critical endpoints
- Alert if response times increase by > 20% from baseline
- Track query counts per request (prevent N+1 queries)

## Historical Performance Data

### Baseline Measurements (2026-02-09)

**Local Development** (MacBook Pro M1, MariaDB 10.11):
- Admin dashboard load: 120ms (P95)
- Participant profile load: 80ms (P95)
- Search query (10 results): 45ms (P95)
- Session revocation check: 2-5ms

**Production** (AWS RDS, t3.micro):
- Admin dashboard load: 350ms (P95)
- Participant profile load: 220ms (P95)
- Search query (10 results): 180ms (P95)
- Session revocation check: 8-15ms

### Performance Changes Log

| Date | Change | Impact | Notes |
|------|--------|--------|-------|
| 2026-02-09 | Added session revocation checks | +5-15ms per admin request | Acceptable for security benefit |
| 2026-02-09 | Team lookup: WHERE slug = ? | ~500ms-1s saved | Was fetching all teams then filtering in JS |
| 2026-02-09 | Remove useEffect dep bloat | ~200-500ms saved | showMakeAdmin/showRevokeAdmin triggered redundant fetches |
| 2026-02-09 | compress: false in next.config.js | ~50-100ms saved | Avoids double-compression with nginx |
| 2026-02-09 | Foreign key indexes migration | ~200-500ms saved | Indexes on people, doubles_pairs, scores, admins |
| 2026-02-09 | Remove acquireTimeout pool option | Eliminates deprecation warning | Not supported by mysql2 |
| 2026-02-09 | Participant list: LEFT JOINs replace correlated subqueries | ~500ms-2s saved | 6 subqueries per row eliminated, single query with 3 JOINs |
| 2026-02-09 | Admin detail: superAdminCount in single API response | ~200-500ms saved | Eliminated redundant fetch of ALL admins in SSR |
| 2026-02-09 | Nginx upstream keepalive + direct /_next/static serving | ~70-250ms saved | Persistent connections + bypass Node.js for static assets |
| 2026-02-09 | Deploy admin check: source .env.local | Bug fix | Admin count check was returning 0 due to missing env vars |

## Remaining Performance Optimization Plan

### LOW: PM2 Cluster Mode

**Problem:** PM2 runs in fork mode (single process) on a 2-core server.

**Fix:** Switch to cluster mode with 2 instances via ecosystem.config.js.

**Expected improvement:** Better throughput under concurrent load (not single-request latency)

**Note:** Low priority — helps with concurrency, not single-request latency. Only needed if the server handles many simultaneous users.

## Related Documentation

- [Portal Architecture](portal_architecture.md#performance-considerations) - Performance considerations overview
- [Database Architecture](portal_database_architecture.md#admins-table-session-revocation) - Session revocation database details
- [Migrations](../deploy_docs/MIGRATIONS.md#add-sessions-revoked-at-sh) - Session revocation migration
- [Force Password Change](portal_architecture.md#force-password-change) - Feature requiring session revocation
