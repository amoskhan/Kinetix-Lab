import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get API key from environment (server-side only)
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { frames, timestamps, centerFrameIndex, poseData, detectedMovement, userDeclaredSkill } = req.body;

    // Forward request to Gemini API
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: req.body.contents,
        generationConfig: req.body.generationConfig,
        systemInstruction: req.body.systemInstruction
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API error');
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to analyze movement' 
    });
  }
}
