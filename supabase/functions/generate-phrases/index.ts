import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const { language, userLevel, phrasesCompleted } = await req.json();

    const langName = language === "english" ? "English" : language === "spanish" ? "Spanish" : language.charAt(0).toUpperCase() + language.slice(1);

    const tier = phrasesCompleted < 10 ? "beginner" : phrasesCompleted < 30 ? "intermediate" : phrasesCompleted < 60 ? "advanced" : "native-like";

    const systemPrompt = `You are a pronunciation coach for ${langName} learners.
Generate exactly 12 phrases for a ${userLevel} level student to practice speaking.
The student has practiced ${phrasesCompleted} phrases so far, so target "${tier}" difficulty.

DIFFICULTY GUIDELINES:
- beginner: Common greetings, simple present tense, 3-6 word sentences
- intermediate: Past tense, questions, compound sentences, 6-12 words, some idioms
- advanced: Subjunctive, conditionals, tongue twisters, 10-18 words, idiomatic expressions
- native-like: Proverbs, complex grammar, rapid speech patterns, slang, 12-25 words

Return a JSON array of exactly 12 objects with:
- "text": the ${langName} phrase to practice speaking
- "english": English translation
- "difficulty": "easy", "medium", or "hard"
- "tips": array of 2-3 pronunciation tips specific to sounds in the phrase

Rules:
- First 4 should be "easy", next 4 "medium", last 4 "hard" within the tier
- Focus on sounds that are challenging for English speakers learning ${langName}
- Include phrases with tricky consonant clusters, vowel sounds, and intonation patterns
- For Spanish: include phrases with rr, ñ, ll, j, and vowel combinations
- For English: include phrases with th, r/l distinction, vowel reductions
- Make phrases practical and culturally relevant
- Ensure proper accents, punctuation, and spelling
- Do NOT repeat common textbook phrases—be creative and conversational

Return ONLY the JSON array.`;

    const callGemini = (model: string) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: `Generate 12 ${tier}-level pronunciation phrases in ${langName}.` }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 2048 },
        }),
      });

    const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite"];
    let response: Response | null = null;

    for (const model of models) {
      response = await callGemini(model);
      if (response.ok) break;
      const errText = await response.text();
      console.error(`Gemini ${model} error:`, response.status, errText);
      if (response.status !== 503 && response.status !== 429) {
        throw new Error(`Gemini API error: ${response.status}`);
      }
    }

    if (!response || !response.ok) {
      throw new Error("All Gemini models unavailable");
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let phrases;
    try {
      phrases = JSON.parse(text);
    } catch {
      console.error("Failed to parse phrases JSON:", text);
      throw new Error("Failed to parse AI-generated phrases");
    }

    return new Response(
      JSON.stringify({ phrases }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Phrase generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
