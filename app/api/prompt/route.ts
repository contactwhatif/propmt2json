import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch (err) {
    console.error("Failed to parse request body:", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { promptType, outputFormat, userPrompt } = body;

  if (!promptType || !outputFormat || !userPrompt) {
    console.error("Missing required fields:", { promptType, outputFormat, userPrompt });
    return NextResponse.json({ error: "Missing required fields: promptType, outputFormat, or userPrompt" }, { status: 400 });
  }

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
    let referer = "http://localhost:3000";
    const origin = req.headers.get("origin");
    if (origin) referer = origin;
    else if (process.env.VERCEL_URL) referer = `https://${process.env.VERCEL_URL}`;
    else if (process.env.NEXT_PUBLIC_SITE_URL) referer = process.env.NEXT_PUBLIC_SITE_URL;

    if (!process.env.OPENROUTER_API_KEY) {
      console.error("Missing OPENROUTER_API_KEY");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": referer,
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
      console.error("OpenRouter API request failed:", data.error?.message || response.statusText);
      return NextResponse.json({ error: data.error?.message || "API request failed" }, { status: response.status });
    }

    if (!data.choices || !data.choices[0]?.message?.content) {
      console.error("Invalid OpenRouter response format:", data);
      return NextResponse.json({ error: "Invalid response from AI service" }, { status: 500 });
    }

    return NextResponse.json({ aiResponse: data.choices[0].message.content });
  } catch (err) {
    console.error("Error in API route:", err);
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error occurred" }, { status: 500 });
  }
}
