/*
# Add Recharge Requests Table and Signup Bonus

1. New Tables
- `recharge_requests`
  - `id` (uuid, primary key)
  - `technician_id` (uuid, FK to profiles, not null)
  - `company` (text, not null) — 'libyana' or 'al_madar'
  - `voucher_value` (numeric, not null) — the card face value
  - `voucher_code` (text, not null) — the recharge code entered by the technician
  - `status` (text, not null, default 'pending') — 'pending', 'approved', 'rejected'
  - `admin_notes` (text, default '')
  - `reviewed_by` (uuid, FK to profiles, nullable)
  - `reviewed_at` (timestamptz, nullable)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- Enable RLS on `recharge_requests`.
- Technicians can create and read their own recharge requests.
- Admins can read and update all recharge requests.

3. Important Notes
- The signup bonus (20 د.ل) is now credited immediately at registration via the app code,
  not at verification time.
- A SECURITY DEFINER function `approve_recharge` handles the atomic wallet credit on approval.
*/

CREATE TABLE IF NOT EXISTS recharge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company text NOT NULL CHECK (company IN ('libyana', 'al_madar')),
  voucher_value numeric NOT NULL CHECK (voucher_value > 0),
  voucher_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recharge_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recharges" ON recharge_requests;
CREATE POLICY "select_own_recharges"
ON recharge_requests FOR SELECT
TO authenticated
USING (
  auth.uid() = technician_id
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "insert_own_recharges" ON recharge_requests;
CREATE POLICY "insert_own_recharges"
ON recharge_requests FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = technician_id
);

DROP POLICY IF EXISTS "update_recharges_admin" ON recharge_requests;
CREATE POLICY "update_recharges_admin"
ON recharge_requests FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "delete_recharges_admin" ON recharge_requests;
CREATE POLICY "delete_recharges_admin"
ON recharge_requests FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- SECURITY DEFINER function to atomically approve a recharge and credit wallet
CREATE OR REPLACE FUNCTION approve_recharge(
  p_request_id uuid,
  p_admin_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request recharge_requests%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_balance_before numeric;
  v_balance_after numeric;
  v_ledger_id uuid;
BEGIN
  SELECT * INTO v_request
  FROM recharge_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;

  SELECT * INTO v_wallet
  FROM wallets
  WHERE technician_id = v_request.technician_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO wallets (technician_id, balance, total_earnings, total_commission)
    VALUES (v_request.technician_id, 0, 0, 0)
    RETURNING * INTO v_wallet;
  END IF;

  v_balance_before := v_wallet.balance;
  v_balance_after := v_balance_before + v_request.voucher_value;

  UPDATE wallets
  SET balance = v_balance_after, updated_at = now()
  WHERE id = v_wallet.id;

  v_ledger_id := gen_random_uuid();
  INSERT INTO financial_ledger (
    transaction_id, wallet_id, technician_id,
    type, amount, balance_before, balance_after, description
  ) VALUES (
    v_ledger_id::text,
    v_wallet.id,
    v_request.technician_id,
    'recharge',
    v_request.voucher_value,
    v_balance_before,
    v_balance_after,
    'شحن محفظة عبر كارت ' || CASE WHEN v_request.company = 'libyana' THEN 'ليبيانا' ELSE 'المدار' END
  );

  UPDATE recharge_requests
  SET status = 'approved', reviewed_by = p_admin_id, reviewed_at = now(), updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance_after);
END;
$$;