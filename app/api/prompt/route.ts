import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { promptType, outputFormat, userPrompt } = await req.json();

  const systemPrompt = `
You are an expert prompt engineer.

Your task is to:
1. Analyze the user's prompt and explicitly extract:
   - SENTIMENT: Determine emotional tone (Positive, Negative, Neutral)
   - INTENT: Clearly identify what the user is trying to achieve
   - REQUIREMENTS: Specific requirements, constraints, or instructions
   - EXPECTATIONS: How the user expects the output to look or function

2. Then, generate a structured version of the prompt in STRICT ${outputFormat.toUpperCase()} format for a ${promptType} generation model.

User's prompt type: ${promptType}
Requested output format: ${outputFormat}

⚠️ IMPORTANT RULES:
- Always return ALL sections: SENTIMENT, INTENT, REQUIREMENTS, EXPECTATIONS.
- STRUCTURED_${outputFormat.toUpperCase()} must be syntactically valid (${outputFormat}) and based ONLY on the user's input.
- Keep answers concise, accurate, and consistent.

Return in EXACT format:

SENTIMENT: [analysis]
INTENT: [analysis]
REQUIREMENTS: [analysis]
EXPECTATIONS: [analysis]

STRUCTURED_${outputFormat.toUpperCase()}:
[structured version of the prompt]
`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://propmt2json-fbe2.vercel.app", // Change in production
        "X-Title": "AI Prompt Structurer"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || "API request failed" }, { status: 500 });
    }

    return NextResponse.json({ aiResponse: data.choices[0].message.content });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: "Unknown error occurred" }, { status: 500 });
    }
  }
}
