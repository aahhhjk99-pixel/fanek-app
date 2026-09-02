import { supabase } from '@/lib/supabase';

export async function runGeminiDiagnosis(description: string, imageBase64?: string) {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-diagnose', {
      body: {
        description,
        imageBase64,
      },
    });

    if (error) {
      console.error('خطأ أثناء تشغيل الدالة:', error);
      throw new Error(error.message || 'تعذر تشخيص العطل حالياً');
    }

    // النتيجة المرجعة تحتوي على: { specialty, confidence, summary }
    return data;
  } catch (err: any) {
    console.error('حدث خطأ أثناء الاتصال بالذكاء الاصطناعي:', err);
    throw err;
  }
}
