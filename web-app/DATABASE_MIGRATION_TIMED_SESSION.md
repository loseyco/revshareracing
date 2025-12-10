# Database Migration: Timed Session Support

To enable real-time timed session synchronization across multiple devices, you need to add a column to the `irc_devices` table.

## Migration SQL

Run this SQL in your Supabase SQL editor:

```sql
ALTER TABLE irc_devices 
ADD COLUMN IF NOT EXISTS timed_session_state JSONB;

-- Optional: Add a comment to document the column
COMMENT ON COLUMN irc_devices.timed_session_state IS 'Stores active timed session state: {active: boolean, startTime: number, duration: number}';
```

## What This Enables

- **Real-time sync**: Timer state syncs across all devices viewing the same device
- **Persistence**: Timer survives page reloads and browser restarts
- **Multi-device support**: Multiple users can see the same timer countdown

## Column Structure

The `timed_session_state` column stores JSON in this format:

```json
{
  "active": true,
  "startTime": 1234567890123,
  "duration": 180
}
```

When no session is active, the value is `null`.

