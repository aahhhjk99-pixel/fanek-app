import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_PROMPT = `أنت مساعد ذكي لتصنيف أعطال المنازل في ليبيا. مهمتك هي تحليل وصف العطل أو صورته وتصنيفه إلى أحد التخصصات التالية فقط:
- سباكة
- كهرباء
- تكييف
- مؤهلات
- بناء
- حدادة
- أجهزة
- نجارة
- ألومنيوم
- ألمنيوم

أرجع النتيجة بصيغة JSON فقط بدون أي نص إضافي:
{"specialty": "التخصص", "confidence": رقم من 0 إلى 1, "summary": "وصف مختصر للعمل بالعربية"}`;

Deno.serve(async (req: Request) => {
  // الرد الصحيح على طلب الإذن المبدئي من المتصفح (CORS Preflight)
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { description, imageBase64 } = await req.json();

    if (!description && !imageBase64) {
      return new Response(
        JSON.stringify({ error: "الوصف أو الصورة مطلوب" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "غير مفعل Gemini مفتاح" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parts: any[] = [{ text: SYSTEM_PROMPT }];
    if (description) {
      parts.push({ text: `وصف العطل: ${description}` });
    }
    if (imageBase64) {
      parts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: imageBase64,
        },
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 300,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: "خطأ في الاتصال مع Gemini", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({ error: "استجابة غير صالحة من Gemini", raw: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validSpecialties = [
      "سباكة",
      "كهرباء",
      "تكييف",
      "مؤهلات",
      "بناء",
      "حدادة",
      "أجهزة",
      "نجارة",
      "ألومنيوم",
      "ألمنيوم",
    ];
    if (!validSpecialties.includes(parsed.specialty)) {
      parsed.specialty = "أخرى";
    }

    return new Response(
      JSON.stringify({
        specialty: parsed.specialty,
        confidence: parsed.confidence || 0.5,
        summary: parsed.summary || description || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "خطأ داخلي" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
