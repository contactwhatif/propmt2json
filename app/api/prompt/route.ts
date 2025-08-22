import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: Request) {
  // Validate the authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "No authorization header provided" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: "User not found or invalid token" }, { status: 401 });
  }

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
- Always return ALL sections: Cerebro, INTENT, REQUIREMENTS, EXPECTATIONS.
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
    // Dynamically set HTTP-Referer from request headers if possible
    let referer = "http://localhost:3000";
    const reqHeaders = req.headers;
    const origin = reqHeaders.get ? reqHeaders.get("origin") : null;
    if (origin) {
      referer = origin;
    } else if (process.env.VERCEL_URL) {
      referer = `https://${process.env.VERCEL_URL}`;
    } else if (process.env.NEXT_PUBLIC_SITE_URL) {
      referer = process.env.NEXT_PUBLIC_SITE_URL;
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
