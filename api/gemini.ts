
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Schema, Type } from "@google/genai";

const MODEL_NAME = 'gemini-2.5-flash';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server API key not configured' });
  }

  try {
    const { parts, systemInstruction, responseSchema, generationConfig } = req.body;

    const ai = new GoogleGenAI({ apiKey });

    // The SDK expects 'contents' to have 'role' and 'parts', but for single generateContent,
    // we can often just pass the config. However, let's follow the standard format.
    // We'll receive 'parts' from the client to be flexible (text + images).

    // Note: The client logic was using 'ai.models.generateContent'.
    // We will replicate that here.

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: parts // array of { text: string } or { inlineData: ... }
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema, // We'll pass the schema from client or define it here? 
        // Better to pass from client to keep logic in one place or define shared types.
        // For now, let's accept it from body to keep the endpoint generic.
        thinkingConfig: generationConfig?.thinkingConfig
      }
    });

    const textResponse = response.text;
    res.status(200).json({ text: textResponse });

  } catch (error: any) {
    console.error('Gemini Server Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
