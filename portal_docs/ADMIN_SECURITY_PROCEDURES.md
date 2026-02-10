# Admin Security Procedures

## Overview

This document provides operational procedures for managing admin account security in the tournament portal. These procedures are intended for super administrators responding to security incidents.

**Last Updated**: 2026-02-09

## Force Password Change

### When to Use

Force password change should be used when:
- **Compromised credentials**: Admin reports their password was leaked or stolen
- **Suspicious activity**: Unusual login patterns or unauthorized actions detected
- **Account takeover**: Evidence that an unauthorized person accessed the account
- **Proactive security**: Admin leaving the organization (after revoking access)
- **Compliance requirement**: Security audit requires password rotation

**DO NOT USE** for:
- Admin forgot password (use normal password reset flow)
- Password expired (not implemented in portal)
- Routine password rotation (not required for tournament portal)

### Procedure

**Prerequisites**:
- You must be logged in as a super admin
- You must have the target admin's UUID (visible in admin list)
- You should notify the admin before forcing reset (unless security incident)

**Steps**:

1. **Identify compromised account**
   - Note the admin's email and UUID
   - Document the security incident (when discovered, evidence)

2. **Force password change**
   ```bash
   # API call (using curl)
   curl -X POST https://portal.example.com/api/portal/admins/[UUID]/force-password-change \
     -H "Cookie: admin_session=[YOUR_SESSION_COOKIE]" \
     -H "Content-Type: application/json"
   ```

   Or use the admin UI:
   - Navigate to Admin Management
   - Find the target admin in the list
   - Click "Force Password Reset" button
   - Confirm the action

3. **Immediate effects**
   - Target admin's password is changed to a random temporary password
   - ALL active sessions for that admin are invalidated immediately
   - Target admin receives email with temporary password
   - Your action is logged in `admin_actions` table

4. **Notify admin** (if not already done)
   - Explain why password was reset
   - Confirm they received the email with temporary password
   - Instruct them to log in and change password immediately
   - Remind them not to reuse old passwords

5. **Verify completion**
   - Confirm admin logged in with temporary password
   - Confirm admin changed to new permanent password
   - Check audit logs for successful password change

### What Happens Behind the Scenes

**Database Changes**:
```sql
-- Admin record updated
UPDATE admins
SET password_hash = '[bcrypt hash of temporary password]',
    must_change_password = true,
    sessions_revoked_at = NOW()
WHERE id = '[target admin UUID]';

-- Action logged
INSERT INTO admin_actions (admin_email, action, details)
VALUES ('[your email]', 'force_password_change', '[target details]');
```

**Session Invalidation**:
- `sessions_revoked_at` is set to current timestamp
- All subsequent requests with old session cookies are rejected (401 Unauthorized)
- Auth guards compare session's `iat` (issued at) with `sessions_revoked_at`
- Sessions created before revocation timestamp are invalid

**Email Sent**:
- Template: `admin-forced-password-reset`
- Subject: "Your admin password has been reset"
- Body: Includes temporary password and login instructions
- Link: Direct link to portal login page

### Admin User Experience

**From target admin's perspective**:

1. **Active sessions immediately stop working**
   - Any open portal tabs show "Unauthorized" errors
   - Must log in again to continue working

2. **Receives email with temporary password**
   - Email explains password was reset for security reasons
   - Includes temporary password (16 random characters)
   - Provides link to portal login

3. **Logs in with temporary password**
   - Enters email and temporary password at login page
   - Automatically redirected to password change form
   - Cannot access any other portal features until password changed

4. **Changes to permanent password**
   - Must enter new password (cannot reuse temporary password)
   - Password requirements enforced (8+ chars, mixed case, numbers, symbols)
   - After successful change, redirected to admin dashboard

### Troubleshooting

**Problem**: Admin reports they didn't receive the email

**Solutions**:
1. Check spam/junk folder
2. Verify email address in admin record is correct
3. Check email sending logs in CloudWatch (production) or console (development)
4. Generate a new temporary password:
   ```bash
   # Create manual reset token (super admin only)
   bash backend/scripts/admin/generate-reset-link.sh [admin-email]
   ```
5. Send reset link directly to admin via secure channel (Signal, in-person)

---

**Problem**: Admin reports temporary password doesn't work

**Solutions**:
1. Verify admin is using the correct email address
2. Check if another super admin forced another password change after yours
3. Check admin record in database:
   ```sql
   SELECT email, must_change_password, sessions_revoked_at, created_at
   FROM admins WHERE email = '[admin email]';
   ```
4. If issue persists, generate new password reset using backend script

---

**Problem**: Admin cannot change password (gets error "new password must be different")

**Explanation**:
Admin is trying to set their new password to the same value as the temporary password. This is intentionally blocked for security.

**Solution**:
Instruct admin to choose a completely different password (not the temporary password).

---

**Problem**: Other admins report their sessions stopped working after force password change

**Diagnosis**:
You may have forced password change on the wrong admin account.

**Solutions**:
1. Verify which admin account you reset (check `admin_actions` table)
2. If wrong account, allow that admin to log in and change password
3. Force password change on the CORRECT admin account
4. Document incident for post-mortem review

---

**Problem**: Force password change returns 403 Forbidden

**Causes**:
- You are not logged in as super admin (tournament admins cannot force password change)
- You are trying to force password change on your own account (not allowed)

**Solutions**:
- Verify your role: `GET /api/portal/admin/session` should show `role: "super-admin"`
- If trying to reset your own password, use normal password reset flow
- If you need to reset the only super admin account, use backend CLI:
  ```bash
  bash backend/scripts/admin/reset-super-admin-password.sh [email]
  ```

## Security Incident Response

### Suspected Compromised Admin Account

**Immediate Actions** (within 5 minutes):
1. Force password change on compromised account
2. Review audit logs for unauthorized actions
3. Check admin action logs for suspicious activity
4. Notify other super admins

**Investigation** (within 1 hour):
1. Review all actions taken by compromised account (last 7 days)
2. Check participant data for unauthorized modifications
3. Review email logs for unauthorized email sends
4. Check database for unauthorized data exports

**Remediation** (within 24 hours):
1. Document all findings
2. Revert any unauthorized data changes
3. Notify affected participants if data was accessed
4. Update security procedures if vulnerability found

**Long-term** (within 1 week):
1. Conduct security review of authentication system
2. Consider implementing 2FA (future enhancement)
3. Review admin account provisioning procedures
4. Train admins on security best practices

### Multiple Failed Login Attempts

**Detection**:
- Multiple failed login attempts for an admin account (5+ in 10 minutes)
- May indicate brute force attack or compromised credentials

**Response**:
1. Check login logs for source IP addresses
2. If suspicious IPs detected, consider blocking at firewall level
3. Contact admin to verify they are attempting to log in
4. If admin reports no login attempts, force password change immediately
5. Consider implementing rate limiting on login endpoint (future enhancement)

### Unauthorized Data Access

**Detection**:
- Audit logs show unexpected participant data access
- Admin reports seeing data they shouldn't have access to

**Response**:
1. Force password change on all admin accounts
2. Review role-based access control (RBAC) implementation
3. Check for elevation of privilege vulnerabilities
4. Document incident and findings
5. Implement additional access controls if needed

## Database Queries for Security Investigations

### Check admin account status
```sql
SELECT email, role, must_change_password, sessions_revoked_at, created_at
FROM admins
WHERE email = '[admin email]';
```

### View recent force password change actions
```sql
SELECT admin_email, action, details, created_at
FROM admin_actions
WHERE action = 'force_password_change'
ORDER BY created_at DESC
LIMIT 20;
```

### View all actions by specific admin
```sql
SELECT admin_email, action, details, created_at
FROM admin_actions
WHERE admin_email = '[admin email]'
ORDER BY created_at DESC;
```

### Check recent password resets
```sql
SELECT ar.admin_id, a.email, ar.used_at, ar.created_at, ar.expires_at
FROM admin_password_resets ar
JOIN admins a ON ar.admin_id = a.id
ORDER BY ar.created_at DESC
LIMIT 20;
```

### View participant data modifications by admin
```sql
SELECT admin_email, pid, field, old_value, new_value, changed_at
FROM audit_logs
WHERE admin_email = '[admin email]'
ORDER BY changed_at DESC
LIMIT 100;
```

### Find admins with active must_change_password flags
```sql
SELECT email, must_change_password, sessions_revoked_at, created_at
FROM admins
WHERE must_change_password = true;
```

## CLI Tools for Emergency Access

### Reset Super Admin Password (Emergency)

If the only super admin account is locked out:

```bash
# Generate new password reset link
cd /path/to/portal-app
bash backend/scripts/admin/generate-reset-link.sh superadmin@example.com

# Output:
# Password reset link: https://portal.example.com/portal/admin/reset?token=...
# Send this link to the super admin via secure channel
```

### Create New Super Admin (Emergency)

If all super admin accounts are compromised:

```bash
# Create new super admin account
cd /path/to/portal-app
bash backend/scripts/admin/create-super-admin.sh

# Follow prompts to enter email, password, name
# New super admin can now log in and investigate incident
```

### Check Session Revocation Status

```bash
# Query database directly
mysql -u [user] -p [database] <<SQL
SELECT email, sessions_revoked_at,
       CASE
         WHEN sessions_revoked_at IS NULL THEN 'All sessions valid'
         ELSE CONCAT('Sessions before ', sessions_revoked_at, ' are invalid')
       END as status
FROM admins;
SQL
```

## Related Documentation

- [Portal Architecture - Force Password Change](portal_architecture.md#force-password-change)
- [Portal Architecture - Security](portal_architecture.md#security)
- [Database Architecture - Session Revocation](portal_database_architecture.md#admins-table-session-revocation)
- [Performance Considerations](PERFORMANCE.md)
- [Migrations - Session Revocation](../deploy_docs/MIGRATIONS.md#add-sessions-revoked-at-sh)
