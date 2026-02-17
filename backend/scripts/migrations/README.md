# Database Migrations

This directory contains database migration scripts for schema changes.

## Current Issue: Missing nickname Column

### Problem
The production database is missing the `nickname` column in the `people` table, causing the participants dashboard to fail with 500 errors.

### Solution
Run the migration script to add the `nickname` column:

#### On Production Server (via SSH)

```bash
# SSH into the server
ssh goldengateclassic@54.70.1.215

# Navigate to the portal app directory
cd ~/htdocs/www.goldengateclassic.org/portal-app

# Run the migration
bash backend/scripts/migrations/add-nickname-column.sh
```

#### On Local Development

```bash
# From the project root
bash backend/scripts/migrations/add-nickname-column.sh
```

### What the Migration Does
- Checks if the `nickname` column already exists (idempotent - safe to run multiple times)
- Adds `nickname text` column to the `people` table after `last_name`
- Uses the existing `PORTAL_DATABASE_URL` from your `.env.local` file

### After Running Migration
1. The participants dashboard will load correctly
2. The nickname column will appear between Name and Email
3. XML imports will start populating the nickname field
4. Participant edit forms will show the nickname field

### Verification
After running the migration, you can verify it worked by:

```bash
# Check the column exists
mysql -h shared2.cdms8mviovca.us-west-2.rds.amazonaws.com \
  -u goldengate -p goldengate \
  -e "DESCRIBE people;" | grep nickname
```

Expected output:
```
nickname    text    YES     NULL
```
