export type Role = 'customer' | 'technician' | 'admin';
export type AccountStatus = 'active' | 'banned';

export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type TechnicianStatus = 'available' | 'busy' | 'offline';

export type OrderStatus =
  | 'new'
  | 'accepted'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'work_done'
  | 'invoice_issued'
  | 'awaiting_payment'
  | 'completed'
  | 'disputed'
  | 'cancelled';

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'frozen' | 'cancelled';
export type LedgerType = 'earnings' | 'commission' | 'signup_bonus' | 'admin_credit' | 'admin_debit' | 'payout' | 'recharge';

export type RechargeCompany = 'libyana' | 'al_madar';
export type RechargeStatus = 'pending' | 'approved' | 'rejected';
export type DisputeStatus = 'open' | 'resolved_customer' | 'resolved_technician' | 'cancelled';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: Role;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string;
  id_photo_url: string;
  work_photos: string[];
  verification_status: VerificationStatus;
  technician_status: TechnicianStatus;
  specialty: string;
  commission_rate: number;
  commission_exempt: boolean;
  commission_exempt_until: string | null;
  promo_discount_used: boolean;
  promo_signup_bonus_used: boolean;
  account_status: AccountStatus;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  name_en: string;
  description: string;
  price_min: number;
  price_max: number;
  icon: string;
  category: string;
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  technician_id: string | null;
  service_id: string;
  status: OrderStatus;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string;
  description: string;
  distance_km: number | null;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  service?: Service;
  customer?: Profile;
  technician?: Profile;
  invoice?: Invoice;
}

export interface Invoice {
  id: string;
  order_id: string;
  technician_id: string;
  customer_id: string;
  labor_cost: number;
  parts_cost: number;
  total: number;
  commission_amount: number;
  status: InvoiceStatus;
  locked: boolean;
  created_at: string;
  paid_at: string | null;
}

export interface Wallet {
  id: string;
  technician_id: string;
  balance: number;
  total_earnings: number;
  total_commission: number;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  transaction_id: string;
  wallet_id: string | null;
  technician_id: string;
  order_id: string | null;
  invoice_id: string | null;
  type: LedgerType;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export interface Dispute {
  id: string;
  order_id: string;
  invoice_id: string;
  customer_id: string;
  technician_id: string;
  reason: string;
  photos: string[];
  status: DisputeStatus;
  admin_notes: string;
  created_at: string;
  resolved_at: string | null;
  order?: Order;
  invoice?: Invoice;
  customer?: Profile;
  technician?: Profile;
}

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  reviewed_id: string;
  reviewer_role: Role;
  rating: number;
  comment: string;
  created_at: string;
  reviewer?: Profile;
}

export interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  image_url: string;
  read_at: string | null;
  created_at: string;
  sender?: Profile;
}

export interface AppSettings {
  id: string;
  support_phone: string;
  support_whatsapp: string;
  support_visible: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface RechargeRequest {
  id: string;
  technician_id: string;
  company: RechargeCompany;
  voucher_value: number;
  voucher_code: string;
  status: RechargeStatus;
  admin_notes: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  technician?: Profile;
}
