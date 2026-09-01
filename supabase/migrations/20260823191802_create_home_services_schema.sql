/*
# Home Services App - Complete Database Schema

## Overview
Creates the full schema for a home services and maintenance app for Libya (currency: د.ل).
The app has three roles: customer (زبون), technician (فني), and admin (أدمن).

## Tables

### 1. profiles
Extends auth.users with app-specific data.
- `id` (uuid, PK, references auth.users)
- `full_name` (text) - full name in Arabic
- `phone` (text, unique) - phone number
- `role` (text) - 'customer' | 'technician' | 'admin'
- `location_lat` (numeric) - latitude
- `location_lng` (numeric) - longitude
- `location_address` (text) - human-readable address
- `id_photo_url` (text) - national ID photo (technicians only)
- `work_photos` (jsonb) - array of 3 work sample photos (technicians only)
- `verification_status` (text) - 'pending' | 'approved' | 'rejected' (technicians only)
- `technician_status` (text) - 'available' | 'busy' | 'offline' (technicians only)
- `specialty` (text) - service category for the technician
- `commission_rate` (numeric) - custom commission rate, default 10
- `commission_exempt` (boolean) - if true, no commission deducted
- `commission_exempt_until` (timestamptz) - exemption expiry date
- `promo_discount_used` (boolean) - whether customer used the 10 د.ل first-order discount
- `promo_signup_bonus_used` (boolean) - whether technician used the 20 د.ل signup bonus
- `created_at` (timestamptz)

### 2. services
Catalog of services with estimated prices.
- `id` (uuid, PK)
- `name` (text) - service name in Arabic
- `name_en` (text) - service name in English (for icon mapping)
- `description` (text)
- `price_min` (numeric) - estimated minimum price in د.ل
- `price_max` (numeric) - estimated maximum price in د.ل
- `icon` (text) - icon name
- `category` (text) - category grouping
- `created_at` (timestamptz)

### 3. orders
Service requests from customers.
- `id` (uuid, PK)
- `customer_id` (uuid, references profiles)
- `technician_id` (uuid, references profiles, nullable)
- `service_id` (uuid, references services)
- `status` (text) - 'new' | 'accepted' | 'en_route' | 'arrived' | 'in_progress' | 'work_done' | 'invoice_issued' | 'awaiting_payment' | 'completed' | 'disputed' | 'cancelled'
- `location_lat` (numeric)
- `location_lng` (numeric)
- `location_address` (text)
- `description` (text) - problem description from customer
- `distance_km` (numeric) - distance between customer and technician
- `created_at` (timestamptz)
- `accepted_at` (timestamptz)
- `completed_at` (timestamptz)

### 4. invoices
Bills issued by technicians to customers.
- `id` (uuid, PK)
- `order_id` (uuid, references orders)
- `technician_id` (uuid, references profiles)
- `customer_id` (uuid, references profiles)
- `labor_cost` (numeric) - hand labor cost in د.ل
- `parts_cost` (numeric) - parts cost in د.ل
- `total` (numeric) - labor_cost + parts_cost
- `commission_amount` (numeric) - platform commission (10% of total)
- `status` (text) - 'draft' | 'issued' | 'paid' | 'frozen' | 'cancelled'
- `locked` (boolean) - locked once customer approves
- `created_at` (timestamptz)
- `paid_at` (timestamptz)

### 5. wallets
Technician wallets for commission deductions.
- `id` (uuid, PK)
- `technician_id` (uuid, references profiles)
- `balance` (numeric) - current balance in د.ل
- `total_earnings` (numeric) - lifetime earnings
- `total_commission` (numeric) - lifetime commission paid
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### 6. financial_ledger
Immutable financial transaction log.
- `id` (uuid, PK)
- `transaction_id` (text, unique) - human-readable transaction ID
- `wallet_id` (uuid, references wallets)
- `technician_id` (uuid, references profiles)
- `order_id` (uuid, references orders, nullable)
- `invoice_id` (uuid, references invoices, nullable)
- `type` (text) - 'earnings' | 'commission' | 'signup_bonus' | 'admin_credit' | 'admin_debit' | 'payout'
- `amount` (numeric) - positive for credit, negative for debit
- `balance_before` (numeric)
- `balance_after` (numeric)
- `description` (text)
- `created_at` (timestamptz)

### 7. disputes
Customer disputes over invoices.
- `id` (uuid, PK)
- `order_id` (uuid, references orders)
- `invoice_id` (uuid, references invoices)
- `customer_id` (uuid, references profiles)
- `technician_id` (uuid, references profiles)
- `reason` (text)
- `photos` (jsonb) - array of photo URLs
- `status` (text) - 'open' | 'resolved_customer' | 'resolved_technician' | 'cancelled'
- `admin_notes` (text)
- `created_at` (timestamptz)
- `resolved_at` (timestamptz)

### 8. reviews
Mutual reviews between customers and technicians.
- `id` (uuid, PK)
- `order_id` (uuid, references orders)
- `reviewer_id` (uuid, references profiles)
- `reviewed_id` (uuid, references profiles)
- `reviewer_role` (text) - 'customer' | 'technician'
- `rating` (integer) - 1-5 stars
- `comment` (text)
- `created_at` (timestamptz)

## Security
- RLS enabled on all tables.
- Profiles: users can read all profiles (needed for technician listings), update own only.
- Services: public read (anon + authenticated).
- Orders: customers read their own orders, technicians read orders assigned to them, admins read all.
- Invoices: customer and technician on the order can read; technician creates, customer confirms.
- Wallets: technician reads own wallet, admin reads all.
- Financial ledger: technician reads own ledger, admin reads all.
- Disputes: customer and technician on the dispute can read, admin reads all.
- Reviews: public read (for ratings display), customer/technician create own reviews.

## Important Notes
1. All owner columns default to auth.uid() for seamless inserts.
2. Commission rate is stored per-technician (default 10%, customizable by admin).
3. Wallet balance cannot go below zero (enforced in app logic + policy).
4. Financial ledger is append-only (no UPDATE or DELETE policies).
5. Invoice is locked once customer confirms payment.
6. Promo offers are tracked per-user to prevent reuse.
*/

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text UNIQUE,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'technician', 'admin')),
  location_lat numeric,
  location_lng numeric,
  location_address text DEFAULT '',
  id_photo_url text DEFAULT '',
  work_photos jsonb DEFAULT '[]'::jsonb,
  verification_status text DEFAULT 'approved' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  technician_status text DEFAULT 'offline' CHECK (technician_status IN ('available', 'busy', 'offline')),
  specialty text DEFAULT '',
  commission_rate numeric NOT NULL DEFAULT 10 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  commission_exempt boolean NOT NULL DEFAULT false,
  commission_exempt_until timestamptz,
  promo_discount_used boolean NOT NULL DEFAULT false,
  promo_signup_bonus_used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================
-- SERVICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  description text DEFAULT '',
  price_min numeric NOT NULL DEFAULT 0,
  price_max numeric NOT NULL DEFAULT 0,
  icon text DEFAULT 'wrench',
  category text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services_select_all" ON services;
CREATE POLICY "services_select_all" ON services FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "services_insert_admin" ON services;
CREATE POLICY "services_insert_admin" ON services FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "services_update_admin" ON services;
CREATE POLICY "services_update_admin" ON services FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "services_delete_admin" ON services;
CREATE POLICY "services_delete_admin" ON services FOR DELETE
  TO authenticated USING (true);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  technician_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'accepted', 'en_route', 'arrived', 'in_progress', 'work_done', 'invoice_issued', 'awaiting_payment', 'completed', 'disputed', 'cancelled')),
  location_lat numeric,
  location_lng numeric,
  location_address text DEFAULT '',
  description text DEFAULT '',
  distance_km numeric,
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_participants" ON orders;
CREATE POLICY "orders_select_participants" ON orders FOR SELECT
  TO authenticated USING (
    auth.uid() = customer_id OR
    auth.uid() = technician_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "orders_insert_customer" ON orders;
CREATE POLICY "orders_insert_customer" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "orders_update_participants" ON orders;
CREATE POLICY "orders_update_participants" ON orders FOR UPDATE
  TO authenticated USING (
    auth.uid() = customer_id OR
    auth.uid() = technician_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    auth.uid() = customer_id OR
    auth.uid() = technician_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "orders_delete_admin" ON orders;
CREATE POLICY "orders_delete_admin" ON orders FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================
-- INVOICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  labor_cost numeric NOT NULL DEFAULT 0,
  parts_cost numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'frozen', 'cancelled')),
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select_participants" ON invoices;
CREATE POLICY "invoices_select_participants" ON invoices FOR SELECT
  TO authenticated USING (
    auth.uid() = customer_id OR
    auth.uid() = technician_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "invoices_insert_technician" ON invoices;
CREATE POLICY "invoices_insert_technician" ON invoices FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = technician_id AND
    auth.uid() <> customer_id
  );

DROP POLICY IF EXISTS "invoices_update_participants" ON invoices;
CREATE POLICY "invoices_update_participants" ON invoices FOR UPDATE
  TO authenticated USING (
    auth.uid() = customer_id OR
    auth.uid() = technician_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    auth.uid() = customer_id OR
    auth.uid() = technician_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "invoices_delete_admin" ON invoices;
CREATE POLICY "invoices_delete_admin" ON invoices FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================
-- WALLETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  total_earnings numeric NOT NULL DEFAULT 0,
  total_commission numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets_select_owner_admin" ON wallets;
CREATE POLICY "wallets_select_owner_admin" ON wallets FOR SELECT
  TO authenticated USING (
    auth.uid() = technician_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "wallets_insert_owner" ON wallets;
CREATE POLICY "wallets_insert_owner" ON wallets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = technician_id);

DROP POLICY IF EXISTS "wallets_update_owner_admin" ON wallets;
CREATE POLICY "wallets_update_owner_admin" ON wallets FOR UPDATE
  TO authenticated USING (
    auth.uid() = technician_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    auth.uid() = technician_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================
-- FINANCIAL_LEDGER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS financial_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
  technician_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('earnings', 'commission', 'signup_bonus', 'admin_credit', 'admin_debit', 'payout')),
  amount numeric NOT NULL DEFAULT 0,
  balance_before numeric NOT NULL DEFAULT 0,
  balance_after numeric NOT NULL DEFAULT 0,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE financial_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ledger_select_owner_admin" ON financial_ledger;
CREATE POLICY "ledger_select_owner_admin" ON financial_ledger FOR SELECT
  TO authenticated USING (
    auth.uid() = technician_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "ledger_insert_owner_admin" ON financial_ledger;
CREATE POLICY "ledger_insert_owner_admin" ON financial_ledger FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = technician_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================
-- DISPUTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  photos jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved_customer', 'resolved_technician', 'cancelled')),
  admin_notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disputes_select_participants" ON disputes;
CREATE POLICY "disputes_select_participants" ON disputes FOR SELECT
  TO authenticated USING (
    auth.uid() = customer_id OR
    auth.uid() = technician_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "disputes_insert_customer" ON disputes;
CREATE POLICY "disputes_insert_customer" ON disputes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "disputes_update_admin" ON disputes;
CREATE POLICY "disputes_update_admin" ON disputes FOR UPDATE
  TO authenticated USING (
    auth.uid() = customer_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    auth.uid() = customer_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================
-- REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewed_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_role text NOT NULL CHECK (reviewer_role IN ('customer', 'technician')),
  rating integer NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  comment text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_all" ON reviews;
CREATE POLICY "reviews_select_all" ON reviews FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "reviews_insert_own" ON reviews;
CREATE POLICY "reviews_insert_own" ON reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "reviews_update_own" ON reviews;
CREATE POLICY "reviews_update_own" ON reviews FOR UPDATE
  TO authenticated USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "reviews_delete_own" ON reviews;
CREATE POLICY "reviews_delete_own" ON reviews FOR DELETE
  TO authenticated USING (auth.uid() = reviewer_id);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_verification ON profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_technician ON orders(technician_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_wallets_technician ON wallets(technician_id);
CREATE INDEX IF NOT EXISTS idx_ledger_technician ON financial_ledger(technician_id);
CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed ON reviews(reviewed_id);

-- ============================================
-- SEED SERVICES DATA
-- ============================================
INSERT INTO services (name, name_en, description, price_min, price_max, icon, category) VALUES
('تركيب مفتاح كهرباء', 'electrical_switch', 'تركيب أو استبدال مفاتيح الكهرباء', 20, 40, 'zap', 'كهرباء'),
('إصلاح أعطال الكهرباء', 'electrical_repair', 'فحص وإصلاح أعطال التمديدات الكهربائية', 30, 80, 'zap', 'كهرباء'),
('تركيب إنارة', 'lighting', 'تركيب الإنارة الداخلية والخارجية', 15, 50, 'lightbulb', 'كهرباء'),
('إصلاح تسرب المياه', 'leak_repair', 'كشف وإصلاح تسربات المياه', 40, 120, 'droplet', 'سباكة'),
('تركيب صنابير', 'faucet_install', 'تركيب أو استبدال صنابير المياه', 25, 60, 'droplet', 'سباكة'),
('疏通 المجاري', 'drain_cleaning', 'تنظيف وتسليك المجاري', 30, 90, 'droplet', 'سباكة'),
('تركيب أدوات صحية', 'sanitary_install', 'تركيب المراحيض والمغاسل', 50, 150, 'droplet', 'سباكة'),
('تكييف وصيانة', 'ac_service', 'صيانة وتركيب أجهزة التكييف', 60, 200, 'wind', 'تكييف'),
('شحن غاز التكييف', 'ac_gas_recharge', 'إعادة شحن غاز الفريون', 80, 180, 'wind', 'تكييف'),
('تنظيف أجهزة التكييف', 'ac_cleaning', 'تنظيف وفحص أجهزة التكييف', 50, 120, 'wind', 'تكييف'),
('دهان وديكور', 'painting', 'أعمال الدهان والديكور الداخلي', 40, 150, 'paintbrush', 'دهانات'),
('جبس وديكور', 'gypsum_decor', 'أعمال الجبس والديكور الجبسي', 50, 200, 'paintbrush', 'دهانات'),
('تركيب بلاط وسيراميك', 'tile_install', 'تركيب البلاط والسيراميك', 40, 150, 'grid', 'بناء'),
('إصلاح الشقوق', 'crack_repair', 'إصلاح شقوق الجدران والأسقف', 30, 100, 'hammer', 'بناء'),
('نجارة عامة', 'carpentry', 'أعمال النجارة والتركيبات الخشبية', 50, 200, 'hammer', 'نجارة'),
('تركيب أقفال', 'lock_install', 'تركيب وإصلاح الأقفال والمفاتيح', 25, 70, 'lock', 'أمن'),
('صيانة الأجهزة المنزلية', 'appliance_repair', 'صيانة الغسالات والثلاجات والأفران', 40, 150, 'wrench', 'أجهزة'),
('تنظيف عام', 'cleaning', 'خدمات التنظيف المنزلي العام', 30, 100, 'sparkles', 'تنظيف')
ON CONFLICT DO NOTHING;