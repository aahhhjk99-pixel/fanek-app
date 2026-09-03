import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useOrderRealtime(orderId: string, initialOrder: any) {
  const [order, setOrder] = useState(initialOrder);

  useEffect(() => {
    if (!orderId) return;

    setOrder(initialOrder);

    // الاستماع الفوري للتغيرات في حالة الطلب
    const channel = supabase
      .channel(`order_realtime_${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          // تحديث بيانات الطلب فورياً وبشكل صامت
          setOrder((prev: any) => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, initialOrder]);

  return { order, setOrder };
}
