/*
# Fix Critical Bugs: Technician Order Visibility & Recharge Ledger Type

## Problem 1: Technicians could never see or accept new orders
The original `orders_select_participants` and `orders_update_participants`
policies only granted access when `auth.uid()` matched `customer_id` or
`technician_id`. For a brand-new, unassigned order, `technician_id` is
NULL, so no technician could ever SELECT it (browse it) or UPDATE it
(accept it). This silently broke the core "technician accepts a job"
flow for every technician, every time.

Fix: allow any authenticated technician to SELECT and UPDATE orders that
are still `status = 'new'`, in addition to the existing owner/admin rules.

## Problem 2: Wallet recharge approval always failed
`approve_recharge()` (added in a later migration) inserts a
`financial_ledger` row with `type = 'recharge'`, but the original CHECK
constraint on `financial_ledger.type` never included `'recharge'` as a
valid value. Every call to `approve_recharge()` therefore fails with a
constraint violation, meaning admins could never approve a technician's
wallet top-up request.

Fix: widen the CHECK constraint to include 'recharge'.
*/

-- ============================================
-- FIX 1: allow technicians to see & accept new orders
-- ============================================
DROP POLICY IF EXISTS "orders_select_participants" ON orders;
CREATE POLICY "orders_select_participants" ON orders FOR SELECT
  TO authenticated USING (
    auth.uid() = customer_id OR
    auth.uid() = technician_id OR
    (
      status = 'new' AND
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'technician')
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "orders_update_participants" ON orders;
CREATE POLICY "orders_update_participants" ON orders FOR UPDATE
  TO authenticated USING (
    auth.uid() = customer_id OR
    auth.uid() = technician_id OR
    (
      status = 'new' AND
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'technician')
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    auth.uid() = customer_id OR
    auth.uid() = technician_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================
-- FIX 2: allow 'recharge' as a valid financial_ledger type
-- ============================================
ALTER TABLE financial_ledger DROP CONSTRAINT IF EXISTS financial_ledger_type_check;
ALTER TABLE financial_ledger ADD CONSTRAINT financial_ledger_type_check
  CHECK (type IN ('earnings', 'commission', 'signup_bonus', 'admin_credit', 'admin_debit', 'payout', 'recharge'));
