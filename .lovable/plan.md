

# Fix Generic Chat Tutor Responses

## Problem
The system prompt is broad and lacks specificity. The AI gives textbook-style responses instead of engaging, contextual, personalized replies. Key issues:

1. **Topic context is too vague** — just a label like "general conversation practice" with no scenario or situational framing
2. **No conversation memory guidance** — the prompt doesn't tell the AI to build on what the user said, reference earlier messages, or maintain a thread
3. **No personality depth** — "friendly and encouraging" is generic; no quirks, teaching style, or conversational hooks
4. **No examples** — the AI has no few-shot examples showing what good responses look like
5. **Temperature 0.7** — reasonable but combined with vague prompts produces safe, bland output

## Plan

### 1. Enrich topic prompts with scenarios (edge function)
Replace one-line topic descriptions with rich situational contexts. Example:
- **Travel**: "You and the user are at a train station in Madrid. Help them buy a ticket, ask about destinations, and practice directions. Use realistic dialogue."
- **Food**: "You're a waiter at a restaurant. Take the user's order, suggest dishes, and chat about food preferences."

### 2. Add personality and teaching identity
Give the tutor a consistent personality: a name ("Buddy"), a backstory (grew up in Mexico City / learned English as a second language), and conversational habits (uses humor, references pop culture, asks personal questions).

### 3. Add conversation continuity instructions
Tell the AI explicitly: "Reference what the user said in previous messages. Build on the conversation thread. Don't restart the topic each turn. Remember details they shared."

### 4. Improve coach mode with richer feedback
Instead of just a correction template, add instructions like: "Give a cultural tip related to the correction" and "Use real-world examples of where natives would use this phrase."

### 5. Add few-shot examples to prompts
Include 1-2 example exchanges in both modes so the AI understands the tone and depth expected.

### 6. Adjust model parameters
Bump temperature slightly to 0.8 for free chat mode to encourage more natural, varied responses.

## Files Changed
- `supabase/functions/spanish-tutor/index.ts` — rewrite `buildSystemPrompt` with richer scenarios, personality, continuity instructions, and few-shot examples; adjust temperature per mode

## Technical Detail
- All changes are in the edge function's prompt engineering — no database or frontend changes needed
- The conversation history (last 10 messages) is already sent; we just need to instruct the AI to use it better
- French/Italian references in the language map will be cleaned up as part of this edit

