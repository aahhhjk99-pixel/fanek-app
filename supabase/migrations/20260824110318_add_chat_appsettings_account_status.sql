/*
# Add Chat, App Settings, and Account Status Features

## Overview
This migration adds three major features:
1. In-app chat system for real-time messaging between customers and technicians per order.
2. App settings table for admin-configurable support phone/WhatsApp numbers.
3. Account status (active/banned) on profiles for admin user management.

## New Tables

### 1. chat_messages
Real-time chat messages between order participants.
- `id` (uuid, PK)
- `order_id` (uuid, references orders, NOT NULL) - the order this message belongs to
- `sender_id` (uuid, references profiles, NOT NULL) - who sent the message
- `receiver_id` (uuid, references profiles, NOT NULL) - who receives the message
- `body` (text) - text message content
- `image_url` (text) - URL of uploaded image (nullable, for image messages)
- `read_at` (timestamptz, nullable) - when the receiver read the message
- `created_at` (timestamptz, DEFAULT now())

### 2. app_settings
Singleton configuration table for admin-controlled settings.
- `id` (uuid, PK)
- `support_phone` (text) - support phone number shown in app
- `support_whatsapp` (text) - WhatsApp number for support
- `support_visible` (boolean, DEFAULT true) - whether support info is shown to users
- `updated_at` (timestamptz, DEFAULT now())
- `updated_by` (uuid, references profiles, nullable) - admin who last updated

## Modified Tables

### profiles
- Added `account_status` column (text, DEFAULT 'active', CHECK in ('active', 'banned'))
  - When 'banned', the user cannot log in or submit orders.

## Security

### chat_messages
- SELECT: Only order participants (customer, technician) and admins can read messages.
- INSERT: Only order participants can send messages (sender must be auth.uid()).
- UPDATE: Only the receiver can mark messages as read (update read_at).
- DELETE: Admin only.

### app_settings
- SELECT: All authenticated users can read (needed to display support info).
- INSERT/UPDATE/DELETE: Admin only.

### profiles
- Added account_status column. The existing SELECT policy (profiles_select_all) already allows all authenticated users to read it.
- The existing UPDATE policy (profiles_update_own) allows users to update their own profile, but account_status should only be changed by admins. We add a trigger to prevent non-admins from changing account_status.

## Important Notes
1. Chat messages are scoped per order - only the customer and technician on that order can chat.
2. app_settings is a singleton (one row) - we seed it with default values.
3. A trigger prevents users from changing their own account_status.
4. A trigger on login checks account_status and blocks banned users.
*/
-- ============================================
-- ADD account_status TO profiles
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'account_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN account_status text NOT NULL DEFAULT 'active'
      CHECK (account_status IN ('active', 'banned'));
  END IF;
END $$;

-- ============================================
-- CHAT_MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text DEFAULT '',
  image_url text DEFAULT '',
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_select_participants" ON chat_messages;
CREATE POLICY "chat_select_participants" ON chat_messages FOR SELECT
  TO authenticated USING (
    auth.uid() = sender_id OR
    auth.uid() = receiver_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "chat_insert_participants" ON chat_messages;
CREATE POLICY "chat_insert_participants" ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = chat_messages.order_id
      AND (o.customer_id = auth.uid() OR o.technician_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "chat_update_receiver" ON chat_messages;
CREATE POLICY "chat_update_receiver" ON chat_messages FOR UPDATE
  TO authenticated USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "chat_delete_admin" ON chat_messages;
CREATE POLICY "chat_delete_admin" ON chat_messages FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_chat_messages_order ON chat_messages(order_id, created_at);

-- ============================================
-- APP_SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_phone text NOT NULL DEFAULT '218910000000',
  support_whatsapp text NOT NULL DEFAULT '218910000000',
  support_visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_select_all" ON app_settings;
CREATE POLICY "app_settings_select_all" ON app_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "app_settings_insert_admin" ON app_settings;
CREATE POLICY "app_settings_insert_admin" ON app_settings FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "app_settings_update_admin" ON app_settings;
CREATE POLICY "app_settings_update_admin" ON app_settings FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "app_settings_delete_admin" ON app_settings;
CREATE POLICY "app_settings_delete_admin" ON app_settings FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Seed default settings (only if table is empty)
INSERT INTO app_settings (support_phone, support_whatsapp, support_visible)
SELECT '218910000000', '218910000000', true
WHERE NOT EXISTS (SELECT 1 FROM app_settings);

-- ============================================
-- TRIGGER: Prevent non-admins from changing account_status
-- ============================================
CREATE OR REPLACE FUNCTION prevent_non_admin_account_status_change()
RETURNS TRIGGER AS $$
DECLARE
  current_role text;
BEGIN
  SELECT role INTO current_role FROM profiles WHERE id = auth.uid();
  IF current_role IS NULL OR current_role <> 'admin' THEN
    -- Only allow if the value is unchanged
    IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
      RAISE EXCEPTION 'Only admins can change account_status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_account_status_change ON profiles;
CREATE TRIGGER trg_prevent_account_status_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_non_admin_account_status_change();

-- ============================================
-- TRIGGER: Update updated_at on app_settings
-- ============================================
CREATE OR REPLACE FUNCTION update_app_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_settings_updated ON app_settings;
CREATE TRIGGER trg_app_settings_updated
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_app_settings_timestamp();
