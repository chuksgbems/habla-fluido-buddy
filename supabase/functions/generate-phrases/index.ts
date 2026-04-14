import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Phrase = {
  text: string;
  english: string;
  difficulty: "easy" | "medium" | "hard";
  tips: string[];
};

const refusalIndicators = [
  "i cannot",
  "i can't",
  "i am unable",
  "i'm unable",
  "as an ai",
  "as a language model",
  "i apologize",
  "sorry, but",
  "cannot comply",
];

function detectRefusal(content: string) {
  const normalized = content.toLowerCase();
  return refusalIndicators.some((indicator) => normalized.includes(indicator));
}

function sanitizeJsonText(content: string) {
  return content
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function extractBalancedJsonBlock(content: string) {
  const start = content.search(/[\[{]/);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  let expectedCloser = content[start] === "[" ? "]" : "}";

  for (let i = start; i < content.length; i += 1) {
    const char = content[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") depth += 1;
    if (char === "}" || char === "]") depth -= 1;

    if (depth === 0 && char === expectedCloser) {
      return content.slice(start, i + 1);
    }
  }

  return content.slice(start);
}

function repairJsonClosures(content: string) {
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escaped = false;

  for (const char of content) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") braces += 1;
    if (char === "}") braces = Math.max(0, braces - 1);
    if (char === "[") brackets += 1;
    if (char === "]") brackets = Math.max(0, brackets - 1);
  }

  return `${content}${"]".repeat(brackets)}${"}".repeat(braces)}`;
}

function extractObjectsFromArray(content: string) {
  const objects: string[] = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) objectStart = i;
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && objectStart !== -1) {
        objects.push(content.slice(objectStart, i + 1));
        objectStart = -1;
      }
    }
  }

  return objects;
}

function isPhrase(value: unknown): value is Phrase {
  if (!value || typeof value !== "object") return false;
  const phrase = value as Record<string, unknown>;

  return typeof phrase.text === "string"
    && typeof phrase.english === "string"
    && ["easy", "medium", "hard"].includes(String(phrase.difficulty))
    && Array.isArray(phrase.tips)
    && phrase.tips.every((tip) => typeof tip === "string");
}

function normalizePhrases(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isPhrase)
    .map((phrase) => ({
      text: phrase.text.trim(),
      english: phrase.english.trim(),
      difficulty: phrase.difficulty,
      tips: phrase.tips.map((tip) => tip.trim()).filter(Boolean).slice(0, 3),
    }))
    .filter((phrase) => phrase.text && phrase.english && phrase.tips.length > 0)
    .slice(0, 12);
}

function buildFallbackPhrases(language: string): Phrase[] {
  if (language === "english") {
    return [
      { text: "Thanks for your help.", english: "Gracias por tu ayuda.", difficulty: "easy", tips: ["Keep the 'th' soft by placing your tongue lightly between your teeth.", "Reduce the vowel in 'for' so it sounds quick and natural."] },
      { text: "I need some water.", english: "Necesito un poco de agua.", difficulty: "easy", tips: ["Hold the long 'ee' in 'need' clearly.", "Link 'some water' smoothly instead of pausing between words."] },
      { text: "Where is the station?", english: "¿Dónde está la estación?", difficulty: "easy", tips: ["Round your lips for 'where'.", "Make the final 'tion' in 'station' sound like 'shən'."] },
      { text: "This coffee is hot.", english: "Este café está caliente.", difficulty: "easy", tips: ["Use a voiced 'th' in 'this'.", "Keep 'coffee' stress on the first syllable."] },
      { text: "Could you say that again?", english: "¿Podrías decir eso otra vez?", difficulty: "medium", tips: ["Blend 'could you' into 'couldja' naturally.", "Stress 'again' on the second syllable in standard American pronunciation."] },
      { text: "I usually walk after dinner.", english: "Normalmente camino después de cenar.", difficulty: "medium", tips: ["The 's' in 'usually' often sounds like 'zh'.", "Link 'walk after' without a hard stop."] },
      { text: "My brother works downtown.", english: "Mi hermano trabaja en el centro.", difficulty: "medium", tips: ["Keep the 'r' in 'brother' relaxed and not rolled.", "Stress 'down' clearly in 'downtown'."] },
      { text: "We were talking on the way home.", english: "Íbamos hablando de camino a casa.", difficulty: "medium", tips: ["The weak form of 'were' should be very short.", "Link 'way home' smoothly."] },
      { text: "Thirty-three thoughtful thieves think thoroughly.", english: "Treinta y tres ladrones atentos piensan a fondo.", difficulty: "hard", tips: ["Practice both voiced and unvoiced 'th' sounds carefully.", "Keep a steady rhythm so the tongue twister stays clear."] },
      { text: "I'd rather order the grilled vegetables.", english: "Preferiría pedir las verduras a la parrilla.", difficulty: "hard", tips: ["Contract 'I would' naturally to 'I'd'.", "Pronounce the 'r' in 'rather' without adding an extra vowel."] },
      { text: "The early bird heard every word.", english: "El madrugador oyó cada palabra.", difficulty: "hard", tips: ["Differentiate the vowels in 'bird', 'heard', and 'word'.", "Keep the final consonants crisp but not exaggerated."] },
      { text: "We're rearranging our travel itinerary.", english: "Estamos reorganizando nuestro itinerario de viaje.", difficulty: "hard", tips: ["Link 'we're rearranging' smoothly with a clear 'r'.", "Stress the correct syllables in 'itinerary'."] },
    ];
  }

  return [
    { text: "Hola, ¿cómo estás?", english: "Hello, how are you?", difficulty: "easy", tips: ["The 'h' in 'Hola' is silent.", "Keep both vowels in 'cómo' short and pure."] },
    { text: "Necesito agua fría.", english: "I need cold water.", difficulty: "easy", tips: ["The 'r' in 'fría' is a light tap.", "Pronounce each vowel clearly in 'fría'."] },
    { text: "Gracias por venir.", english: "Thanks for coming.", difficulty: "easy", tips: ["Start 'gracias' with a blended 'gr' sound.", "Keep the final 'r' in 'venir' soft and brief."] },
    { text: "Voy al trabajo ahora.", english: "I'm going to work now.", difficulty: "easy", tips: ["Blend 'voy al' smoothly.", "The 'j' in 'trabajo' is a breathy throat sound."] },
    { text: "Ella llega temprano los jueves.", english: "She arrives early on Thursdays.", difficulty: "medium", tips: ["The 'll' in 'Ella' sounds like 'y' in many accents.", "Practice the strong Spanish 'j' in 'jueves'."] },
    { text: "Quiero llamar a mi hermano.", english: "I want to call my brother.", difficulty: "medium", tips: ["The 'll' in 'llamar' should stay consistent with your chosen accent.", "Keep the 'r' in 'hermano' as a quick tap."] },
    { text: "La lluvia cayó toda la noche.", english: "The rain fell all night.", difficulty: "medium", tips: ["The 'll' in 'lluvia' is not an English 'l'.", "Keep 'noche' ending with a clear 'che' sound."] },
    { text: "Siempre desayuno antes de salir.", english: "I always eat breakfast before leaving.", difficulty: "medium", tips: ["The 'r' in 'siempre' is a quick tap.", "Pronounce 'desayuno' with clear vowels, not reduced ones."] },
    { text: "Mi perro corre alrededor del jardín.", english: "My dog runs around the garden.", difficulty: "hard", tips: ["Use a trilled 'rr' in 'perro' and 'corre'.", "The 'j' in 'jardín' should come from the back of the throat."] },
    { text: "La niña guiña un ojo y sonríe.", english: "The girl winks and smiles.", difficulty: "hard", tips: ["The 'ñ' in 'niña' and 'guiña' sounds like 'ny' in 'canyon'.", "Keep the stress clear on the accented 'í' in 'sonríe'."] },
    { text: "Ferrocarril y barril riman regular.", english: "Railroad and barrel rhyme regularly.", difficulty: "hard", tips: ["Differentiate the single 'r' and the trilled 'rr'.", "Keep the final consonants light but audible."] },
    { text: "Ojalá llegue Jorge con jamón y joyas.", english: "Hopefully Jorge arrives with ham and jewels.", difficulty: "hard", tips: ["Repeat the guttural 'j' sound consistently in every word.", "Avoid turning the vowels into diphthongs; keep them pure."] },
  ];
}

function parsePhrasesResponse(content: string) {
  const cleaned = sanitizeJsonText(content);

  if (!cleaned) {
    throw new Error("Empty AI response");
  }

  if (detectRefusal(cleaned)) {
    throw new Error("AI model refused phrase generation");
  }

  const attempts = [cleaned];
  const balancedBlock = extractBalancedJsonBlock(cleaned);

  if (balancedBlock && balancedBlock !== cleaned) {
    attempts.push(balancedBlock);
    attempts.push(repairJsonClosures(balancedBlock));
  }

  attempts.push(repairJsonClosures(cleaned));

  for (const attempt of attempts) {
    try {
      const phrases = normalizePhrases(JSON.parse(attempt));
      if (phrases.length > 0) return phrases;
    } catch {
      // Continue with fallback parsing strategies below.
    }
  }

  const objects = extractObjectsFromArray(cleaned)
    .map((objectText) => {
      try {
        return JSON.parse(objectText);
      } catch {
        try {
          return JSON.parse(repairJsonClosures(objectText));
        } catch {
          return null;
        }
      }
    })
    .filter(Boolean);

  const recovered = normalizePhrases(objects);
  if (recovered.length > 0) return recovered;

  console.error("Failed to parse phrases JSON:", cleaned.substring(0, 1000));
  throw new Error("Failed to parse AI-generated phrases");
}

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
          generationConfig: { temperature: 0.9, maxOutputTokens: 8192, responseMimeType: "application/json" },
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
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    let phrases = parsePhrasesResponse(text);
    if (phrases.length < 12) {
      const fallback = buildFallbackPhrases(language);
      const seen = new Set(phrases.map((phrase) => phrase.text.toLowerCase()));

      for (const phrase of fallback) {
        if (phrases.length >= 12) break;
        if (seen.has(phrase.text.toLowerCase())) continue;
        phrases.push(phrase);
      }
    }

    if (phrases.length === 0) {
      phrases = buildFallbackPhrases(language);
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
