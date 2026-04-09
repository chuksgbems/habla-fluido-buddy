import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExerciseRequest {
  lessonTitle: string;
  language: string;
  userLevel: string;
  lessonsCompleted: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const { lessonTitle, language, userLevel, lessonsCompleted }: ExerciseRequest = await req.json();

    const langName = language === "english" ? "English" : language === "spanish" ? "Spanish" : language.charAt(0).toUpperCase() + language.slice(1);

    const difficultyProgression = lessonsCompleted < 3 ? "easy" : lessonsCompleted < 8 ? "medium" : lessonsCompleted < 15 ? "hard" : "advanced";

    const systemPrompt = `You are a language exercise generator. Generate exactly 6 exercises for a ${userLevel} level student learning ${langName}.

Lesson topic: "${lessonTitle}"
Difficulty tier: ${difficultyProgression} (student has completed ${lessonsCompleted} lessons total)

DIFFICULTY GUIDELINES:
- easy: Simple vocabulary, present tense, common phrases, short sentences
- medium: Mix of tenses (past + present), compound sentences, idiomatic expressions
- hard: Complex grammar (subjunctive, conditionals), longer sentences, nuanced vocabulary
- advanced: Native-level expressions, abstract concepts, cultural nuances, slang

Return a JSON array of exactly 6 exercise objects. Each object must have:
- "type": one of "translate", "fill_blank", "multiple_choice", "listening"
- "prompt": the question/instruction shown to the user (in English, referencing ${langName})
- "answer": the correct answer string
- "choices": array of 4 strings (REQUIRED for multiple_choice and fill_blank, omit for others)
- "hint": a helpful hint string (optional)
- "audioText": the text to be spoken aloud (only for "listening" type)

Rules:
- Include at least 1 of each type: translate, fill_blank, multiple_choice, listening
- For "translate" exercises: prompt asks user to translate an English phrase to ${langName}
- For "fill_blank": show a sentence with ___ and provide 4 choices
- For "multiple_choice": ask what a ${langName} phrase means, give 4 English options
- For "listening": prompt says "Listen and type what you hear:", audioText is the ${langName} phrase, answer matches audioText
- Make exercises progressively harder within the set
- Use vocabulary and grammar relevant to the lesson topic "${lessonTitle}"
- Ensure all ${langName} text uses proper accents and punctuation
- Make distractors plausible but clearly wrong

Return ONLY the JSON array, no markdown, no explanation.`;

    const callGemini = (model: string) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: `Generate 6 ${difficultyProgression}-difficulty exercises for the "${lessonTitle}" lesson in ${langName}. Return only the JSON array.` }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
        }),
      });

    // Try models in order with fallbacks
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

    // Strip markdown code fences if present
    text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let exercises;
    try {
      exercises = JSON.parse(text);
    } catch {
      console.error("Failed to parse exercises JSON:", text);
      throw new Error("Failed to parse AI-generated exercises");
    }

    return new Response(
      JSON.stringify({ exercises }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Exercise generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
