import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate 6 ${difficultyProgression}-difficulty exercises for the "${lessonTitle}" lesson in ${langName}. Return only the JSON array.` },
        ],
        temperature: 0.8,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI is temporarily busy. Please retry in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content || "[]";

    // Strip markdown code fences if present
    text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    // Find JSON array boundaries
    const jsonStart = text.indexOf("[");
    const jsonEnd = text.lastIndexOf("]");
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      text = text.substring(jsonStart, jsonEnd + 1);
    }

    // Clean control chars and trailing commas
    text = text.replace(/,\s*([}\]])/g, "$1").replace(/[\x00-\x1F\x7F]/g, "");

    let exercises;
    try {
      exercises = JSON.parse(text);
    } catch {
      // Try to salvage truncated JSON
      const lastComplete = text.lastIndexOf("}");
      if (lastComplete !== -1) {
        const salvaged = text.substring(0, lastComplete + 1) + "]";
        try {
          exercises = JSON.parse(salvaged);
        } catch {
          console.error("Failed to parse exercises JSON:", text.substring(0, 500));
          throw new Error("Failed to parse AI-generated exercises");
        }
      } else {
        console.error("Failed to parse exercises JSON:", text.substring(0, 500));
        throw new Error("Failed to parse AI-generated exercises");
      }
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
