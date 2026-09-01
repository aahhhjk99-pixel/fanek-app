import { OrderStatus } from '@/types/database';

export const BRAND_NAME = 'فانيك';
export const BRAND_NAME_EN = 'FANEK';
export const BRAND_LOGO = '⭐️';
export const BRAND_FULL = 'فانيك ⭐️ FANEK';

export const CURRENCY = 'د.ل';
export const COMMISSION_RATE = 10;
export const PROMO_CUSTOMER_DISCOUNT = 10;
export const PROMO_TECHNICIAN_BONUS = 20;
export const PROMO_FIRST_TECHNICIANS_COUNT = 15;
export const PROMO_EXEMPTION_DAYS = 30;
export const WHATSAPP_NUMBER = '218910000000';
export const WARRANTY_DAYS = 3;
export const WARRANTY_TEXT = 'ضمان مجاني لمدة 3 أيام على الصيانة';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'طلب جديد',
  accepted: 'قبل الفني',
  en_route: 'في الطريق',
  arrived: 'وصل الفني',
  in_progress: 'جاري العمل',
  work_done: 'العمل مكتمل',
  invoice_issued: 'تم إصدار الفاتورة',
  awaiting_payment: 'بانتظار السداد',
  completed: 'مكتمل',
  disputed: 'نزاع مفتوح',
  cancelled: 'ملغي',
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'new',
  'accepted',
  'en_route',
  'arrived',
  'in_progress',
  'work_done',
  'invoice_issued',
  'awaiting_payment',
  'completed',
];

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  new: '#f59e0b',
  accepted: '#3b82f6',
  en_route: '#8b5cf6',
  arrived: '#06b6d4',
  in_progress: '#6366f1',
  work_done: '#10b981',
  invoice_issued: '#f97316',
  awaiting_payment: '#ec4899',
  completed: '#22c55e',
  disputed: '#ef4444',
  cancelled: '#9ca3af',
};

export const SERVICE_CATEGORIES = [
  { id: 'سباكة', name: 'سباكة', icon: 'Droplet', color: '#3b82f6' },
  { id: 'كهرباء', name: 'كهرباء', icon: 'Zap', color: '#f59e0b' },
  { id: 'مولدات', name: 'مولدات كهربائية', icon: 'Zap', color: '#eab308' },
  { id: 'دهانات', name: 'دهانات', icon: 'Paintbrush', color: '#8b5cf6' },
  { id: 'بناء', name: 'بناء', icon: 'Grid', color: '#f97316' },
  { id: 'تكييف', name: 'تكييف وتبريد', icon: 'Wind', color: '#06b6d4' },
  { id: 'أجهزة', name: 'صيانة أجهزة منزلية', icon: 'Wrench', color: '#dc2626' },
  { id: 'نجارة', name: 'نجارة وأثاث', icon: 'Hammer', color: '#a16207' },
  { id: 'أمن', name: 'أنظمة أمان وكاميرات', icon: 'Lock', color: '#64748b' },
];

export const FAQ_ITEMS = [
  {
    question: 'كيف أطلب خدمة؟',
    answer: 'اختر الخدمة من القائمة، حدد موقعك على الخريطة، أضف وصفاً للمشكلة، ثم أرسل الطلب. سيصلك الفني الأقرب والأعلى تقييماً.',
  },
  {
    question: 'ما هي عمولة المنصة؟',
    answer: 'عمولة المنصة 10% من قيمة الفاتورة تُخصم تلقائياً من محفظة الفني عند تأكيد الزبون للفاتورة.',
  },
  {
    question: 'كيف أحصل على خصم أول طلب؟',
    answer: 'يحصل كل زبون جديد على خصم 10 د.ل على أول صيانة تلقائياً عند إنشاء أول طلب.',
  },
  {
    question: 'ماذا أفعل عند حدوث نزاع؟',
    answer: 'اضغط زر "اعتراض" في صفحة الطلب، ارفع صوراً واكتب سبب الاعتراض. سيتم تجميد الفاتورة والعمولة حتى يفصل الأدمن.',
  },
  {
    question: 'كيف أصبح فنياً موثقاً؟',
    answer: 'سجل كفني، ارفع صورة هويتك الوطنية و3 صور لأعمال سابقة. سيقوم الأدمن بمراجعتك وقبولك أو رفضك.',
  },
  {
    question: 'ماذا يحدث عند وصول رصيد المحفظة إلى صفر؟',
    answer: 'يُحظر الفني تلقائياً من استقبال طلبات جديدة حتى يتم شحن المحفظة.',
  },
];

export const TERMS_TEXT = `الشروط والأحكام

1. قبول الخدمة: بتسجيلك في تطبيق فانيك ⭐️ FANEK فإنك توافق على جميع الشروط والأحكام.

2. عمولة المنصة: تبلغ عمولة المنصة 10% من قيمة كل فاتورة وتُخصم تلقائياً من محفظة الفني.

3. العروض الترويجية:
- خصم 10 د.ل للزبون على أول صيانة.
- 20 د.ل رصيد مجاني للفني عند التوثيق.
- إعفاء أول 15 فني من العمولة لمدة 30 يوماً.

4. النزاعات: للزبون حق الاعتراض على الفاتورة. يتم تجميد الفاتورة والعمولة حتى يفصل الأدمن.

5. التوثيق: يجب على الفني رفع صورة الهوية الوطنية و3 صور لأعمال سابقة قبل المراجعة.

6. المحفظة: إذا وصل رصيد محفظة الفني إلى صفر، يُحظر من استقبال طلبات جديدة.

7. التقييمات: التقييم متبادل بين الزبون والفني ومربوط برقم الطلب لمنع التقييمات الوهمية.

8. الإلغاء: يحق للطرفين إلغاء الطلب قبل بدء العمل.

9. ضمان الخدمة: يلتزم الفني بتقديم ضمان مجاني على الصيانة لمدة 3 أيام من تاريخ إكمال الطلب، ومعالجة أي خلل مصنع أو فني متعلق بالخدمة بدون أجور إضافية.`;
