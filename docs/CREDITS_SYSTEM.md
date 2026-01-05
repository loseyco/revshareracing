# Credits System Implementation

## Overview

The credits system allows users to purchase and use credits to access timed test sessions on the queue system.

## Credit System Details

- **1 credit = $0.01 USD**
- **1-minute timed test session costs 100 credits ($1.00)**
- Credits are stored as integers in the `irc_user_profiles` table
- Credits cannot go negative (enforced by database constraint)

## Database Schema

### Migration File
`migrations/add_credits_column.sql`

Adds:
- `credits` column to `irc_user_profiles` table (INTEGER, NOT NULL, DEFAULT 0)
- Constraint to ensure credits >= 0
- Optional RPC function `deduct_credits()` for atomic credit deduction

### Running the Migration

Run the SQL in `migrations/add_credits_column.sql` in your Supabase SQL Editor.

## Implementation Details

### 1. Queue Join Credit Check
**File:** `web-app/src/app/api/device/[deviceId]/queue/route.ts`

When a user joins the queue:
- System checks if user has at least 100 credits
- Returns 402 (Payment Required) if insufficient credits
- Error message includes required credits and available balance

### 2. Credit Deduction
**File:** `web-app/src/app/api/device/[deviceId]/timed-session/route.ts`

When a timed session starts (when `active` becomes `true`):
- System deducts 100 credits from the user's account
- Uses RPC function `deduct_credits()` if available, falls back to direct update
- Only deducts once when session transitions from inactive to active

### 3. Profile API
**File:** `web-app/src/app/api/profile/route.ts`

- Returns credits balance in user profile
- Defaults to 0 if credits field is missing

### 4. Profile UI
**File:** `web-app/src/app/profile/page.tsx`

- Displays credits balance in profile form
- Shows credits count and USD equivalent
- Includes credits in statistics section
- Shows conversion rate: 1 credit = $0.01

## Usage Flow

1. **User joins queue:**
   - System checks if user has ≥100 credits
   - If yes, user joins queue
   - If no, user receives error with credit requirements

2. **Session starts:**
   - When car movement is detected and session becomes active
   - System deducts 100 credits from user's account
   - Deduction happens atomically to prevent race conditions

3. **Viewing balance:**
   - Users can view their credit balance on the profile page
   - Balance shows both credits and USD equivalent

## Future Enhancements

The system is designed to support future payment integrations:

- **Stripe integration** - Purchase credits via credit card
- **Apple Pay** - Purchase credits via Apple Pay
- **Other payment methods** - Easy to add additional payment processors

### Adding Payment Integration

When ready to add payment processing:

1. Create payment API endpoints (e.g., `/api/payments/stripe/create-checkout`)
2. Add credit purchase UI to profile page
3. Create webhook handlers to add credits after successful payment
4. Update user profile to show purchase history

## Testing

To test the credits system:

1. **Run the migration** to add the credits column
2. **Manually add credits** to a test user:
   ```sql
   UPDATE irc_user_profiles 
   SET credits = 500 
   WHERE id = 'user-id-here';
   ```
3. **Test queue join** with insufficient credits (should fail)
4. **Test queue join** with sufficient credits (should succeed)
5. **Test credit deduction** by starting a timed session
6. **Verify balance** on profile page

## Constants

- `SESSION_COST_CREDITS = 100` (defined in queue and timed-session routes)
- Credit conversion: 1 credit = $0.01 USD

## Security Considerations

- Credits are deducted atomically using database transactions
- RPC function uses `SECURITY DEFINER` for safe credit updates
- Credit balance is checked before allowing queue join
- Credits cannot go negative (database constraint)


