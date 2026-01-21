import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResponse, AnalysisStatus } from "../types";
import { MODEL_NAME, SYSTEM_INSTRUCTION } from "../constants";

// Define the schema for structured JSON output
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    feedback: {
      type: Type.OBJECT,
      properties: {
        movementName: { type: Type.STRING, description: "Name of the identified exercise or movement." },
        confidence: { type: Type.NUMBER, description: "Confidence score 0-100." },
        phaseDetected: { type: Type.STRING, description: "Current phase of the movement (e.g., descent, hold)." },
        jointAngles: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              jointName: { type: Type.STRING },
              measuredAngle: { type: Type.NUMBER, description: "Estimated angle in degrees." },
              idealAngleRange: { type: Type.STRING, description: "Ideal range e.g. '90-100'" },
              status: { type: Type.STRING, enum: ["Good", "Needs Improvement", "Critical"] }
            }
          }
        },
        observations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of specific biomechanical observations."
        },
        corrections: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Actionable advice for the user."
        },
        safetyRating: { type: Type.NUMBER, description: "Safety rating from 1 (dangerous) to 10 (safe)." }
      },
      required: ["movementName", "confidence", "phaseDetected", "jointAngles", "observations", "corrections", "safetyRating"]
    }
  },
  required: ["feedback"]
};

export const analyzeFrame = async (base64Image: string): Promise<AnalysisResponse> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is missing from environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          },
          {
            text: "Analyze this movement frame based on biomechanical standards."
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 1024 } // Enable thinking for better biomechanical reasoning
      }
    });

    const textResponse = response.text;
    if (!textResponse) throw new Error("No response text from Gemini.");

    const parsedData = JSON.parse(textResponse) as AnalysisResponse;
    return parsedData;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
