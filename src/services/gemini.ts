
import { AnalysisResponse } from "../types";
import { PoseData, poseDetectionService } from './poseDetectionService';

// Define the schema types for local use/reference if needed, 
// but for the client we just pass the schema to the server.
import { Type, Schema, GoogleGenAI } from "@google/genai";

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    feedback: {
      type: Type.OBJECT,
      properties: {
        movementName: { type: Type.STRING, description: "Name of the identified exercise or movement." },
        confidence: { type: Type.NUMBER, description: "Confidence score 0-100." },
        phaseDetected: { type: Type.STRING, description: "Current phase (e.g., 'Wind-up', 'Force Generation', 'Follow-through')." },
        steps: {
          type: Type.ARRAY,
          description: "Step-by-step breakdown of the movement for user verification.",
          items: {
            type: Type.OBJECT,
            properties: {
              stepName: { type: Type.STRING, description: "Name of the step (e.g. 'Stance', 'Backswing')." },
              status: { type: Type.STRING, enum: ["Correct", "Incorrect", "Needs Improvement"] },
              observation: { type: Type.STRING, description: "What was observed (e.g. 'Feet were shoulder-width apart')." },
              correction: { type: Type.STRING, description: "How to fix it if incorrect." }
            },
            required: ["stepName", "status", "observation"]
          }
        },
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
          description: "General biomechanical observations summary."
        },
        corrections: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "High-level actionable advice."
        },
        safetyRating: { type: Type.NUMBER, description: "Safety rating from 1 (dangerous) to 10 (safe)." }
      },
      required: ["movementName", "confidence", "phaseDetected", "steps", "jointAngles", "observations", "corrections", "safetyRating"]
    }
  },
  required: ["feedback"]
};

// System Instruction
const SYSTEM_INSTRUCTION = `
You are an expert biomechanics analyst for KinetixLab.

**YOUR ROLE:**
Provide objective, scientific analysis of human movement based on biomechanical principles.

**ANALYSIS APPROACH:**
1. Identify the movement being performed based on visual observation
2. Measure joint angles and body positions accurately
3. Assess movement quality based on:
   - Joint alignment and stability
   - Range of motion efficiency
   - Force generation and transfer
   - Balance and coordination
   - Safety and injury risk factors

4. Provide specific, actionable feedback for improvement
5. Break down the movement into logical phases (preparation, execution, follow-through)

**OUTPUT FORMAT:**
You must return a JSON object matching the provided schema.
- **steps**: Break the movement down into 3-5 logical phases
- **jointAngles**: Estimate key angles (Knees, Elbows, Shoulders, Hips)
- **safetyRating**: Be strict on potentially injurious form (1=dangerous, 10=safe)
- **observations**: Note what you see objectively
- **corrections**: Provide specific biomechanical improvements

**PRINCIPLES:**
- Be objective and evidence-based
- Focus on biomechanical efficiency and safety
- Provide clear, actionable corrections
- Use precise anatomical terminology
- Consider individual variation in movement patterns
`;

export interface MultiFrameAnalysisInput {
  frames: string[];
  timestamps: number[];
  centerFrameIndex: number;
  poseData?: PoseData;
  detectedMovement?: string;
  userDeclaredSkill?: string;
}

// Internal helper to call the API
async function callGeminiApi(
  parts: any[],
  systemInstruction: string,
  schema: any,
  thinkingBudget?: number
): Promise<AnalysisResponse> {

  // Check if we are in dev mode (localhost) or production
  if (import.meta.env.DEV) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Missing VITE_GEMINI_API_KEY in .env");
      throw new Error("Missing API Key for local development");
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: parts
        },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: schema,
          thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined
        }
      });

      const textResponse = response.text;
      if (!textResponse) {
        throw new Error("No response text from Gemini API");
      }
      return JSON.parse(textResponse) as AnalysisResponse;

    } catch (error: any) {
      console.error("Gemini Client SDK Error:", error);
      throw new Error(error.message || "Gemini Client Error");
    }
  }

  // Production: Use the serverless function
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      parts,
      systemInstruction,
      responseSchema: schema,
      generationConfig: {
        thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server Error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.text) {
    throw new Error("No response text from API");
  }

  // Parse the inner JSON string returned by Gemini
  return JSON.parse(data.text) as AnalysisResponse;
}

export const analyzeMovement = async (
  base64Image: string,
  poseData?: PoseData,
  userDeclaredSkill?: string,
  telemetry: string = ""
): Promise<AnalysisResponse> => {

  try {
    // Enhance prompt with Pose Data if available
    let poseContext = telemetry ? `\n\n**LIVE BIOMECHANICS TELEMETRY (MEDIA-PIPE):**\n${telemetry}\n(Use this exact data for your math.)` : "";

    if (!telemetry && poseData) {
      // Fallback to legacy pose context if new telemetry isn't passed (shouldn't happen with new VideoPlayer)
      const landmarks = poseData.landmarks;
      const analysis = poseDetectionService.analyzePoseGeometry(poseData);

      poseContext = `
      **GROUND TRUTH POSE DATA (MUST BE USED FOR ANGLE ANALYSIS):**
      - Shoulders Width: ${Math.abs(landmarks[11].x - landmarks[12].x).toFixed(2)}
      
      **MEASURED JOINT ANGLES (Degrees):**
      ${analysis.keyAngles.map(a => `- ${a.joint}: ${a.angle}°`).join('\n')}
      
      **POSE SUMMARY:**
      ${analysis.poseSummary}
      
      INSTRUCTION: You must ALIGN your specific joint analysis with the "MEASURED JOINT ANGLES" provided above. Do not estimate visual angles if they contradict these variables.
      `;
    }

    const promptText = `
    Analyze this frame.
    ${userDeclaredSkill ? `**USER DECLARED MOVEMENT:** "${userDeclaredSkill}"\nVerify this is correct and analyze accordingly. If the movement doesn't match, note the discrepancy.` : "Identify the movement from the visual cues."}
    ${poseContext}
    
    Provide a detailed biomechanical analysis in JSON format.
    `;

    // Ensure base64Image is raw data
    const cleanBase64 = base64Image.includes(',')
      ? base64Image.split(',')[1]
      : base64Image;

    const parts = [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64
        }
      },
      {
        text: promptText
      }
    ];

    return await callGeminiApi(parts, SYSTEM_INSTRUCTION, responseSchema, 1024);

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const analyzeMultiFrameMovement = async (
  input: MultiFrameAnalysisInput
): Promise<AnalysisResponse> => {

  try {
    // Build pose context
    let poseContext = "";
    if (input.poseData) {
      const landmarks = input.poseData.landmarks;
      const analysis = poseDetectionService.analyzePoseGeometry(input.poseData);

      poseContext = `
      **GROUND TRUTH POSE DATA (Center Frame):**
      - Shoulders Width: ${Math.abs(landmarks[11].x - landmarks[12].x).toFixed(2)}
      
      **MEASURED JOINT ANGLES (Degrees):**
      ${analysis.keyAngles.map(a => `- ${a.joint}: ${a.angle}°`).join('\n')}
      
      **POSE SUMMARY:**
      ${analysis.poseSummary}
      
      ${input.userDeclaredSkill
          ? `**USER DECLARED MOVEMENT:** "${input.userDeclaredSkill}"\nThis is what the user claims they are performing. Verify and analyze accordingly.`
          : input.detectedMovement && input.detectedMovement !== "Unknown Movement"
            ? `**LOCAL DETECTION SUGGESTS:** ${input.detectedMovement} (Confidence: Medium)\nPlease verify this classification.`
            : ''}
      `;
    }

    const promptText = `
    **MULTI-FRAME MOVEMENT ANALYSIS**
    
    You are analyzing ${input.frames.length} frames showing a movement sequence.
    These frames correspond to the "Visual Evidence" provided to the user.
    - Frame 1: Start of sequence
    - Frame ${Math.ceil(input.frames.length / 2)}: Middle/Key Moment
    - Frame ${input.frames.length}: End of sequence
    
    ${poseContext}
    
    **CRITICAL INSTRUCTIONS:**
    ${input.userDeclaredSkill
        ? `1. The user has declared this movement as "${input.userDeclaredSkill}". Analyze it as this movement type and verify correctness.
    2. If the visual evidence contradicts the declared movement, note this in your analysis but still provide feedback for the declared movement.`
        : `1. First, identify the movement type by observing the progression across all frames.`}
    2. Use the temporal context to understand the movement phase (preparation, execution, follow-through)
    3. **CITATION REQUIRED:** When describing errors or observations, you MUST reference the specific frame number where this is visible (e.g., "In Frame 1, knees align...", "In Frame 3, back rounds...").
    4. Focus your detailed analysis on the Key Moment (Frame ${Math.ceil(input.frames.length / 2)}) but validatetracking across all frames.
    5. Use the measured joint angles provided above for precise biomechanical assessment.
    
    Provide a comprehensive biomechanical analysis in JSON format.
    `;

    // Prepare image parts for all frames
    const frameParts = input.frames.map(frame => {
      const cleanBase64 = frame.includes(',') ? frame.split(',')[1] : frame;
      return {
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64
        }
      };
    });

    const parts = [
      ...frameParts,
      { text: promptText }
    ];

    return await callGeminiApi(parts, SYSTEM_INSTRUCTION, responseSchema, 2048);

  } catch (error) {
    console.error("Gemini Multi-Frame Analysis Error:", error);
    throw error;
  }
};

// Deprecated alias for backward compatibility
export const analyzeFrame = analyzeMovement;

export interface MultiViewAnalysisInput {
  views: {
    label: string; // e.g. "Front View", "Side View"
    frames: string[]; // Sequence of base64 frames
    telemetry?: string;
    poseData?: PoseData;
  }[];
  userDeclaredSkill?: string;
}

export const analyzeMultiViewMovement = async (
  input: MultiViewAnalysisInput
): Promise<AnalysisResponse> => {
  try {
    // Build context from all views
    let combinedContext = "";

    input.views.forEach((view, index) => {
      combinedContext += `\n\n--- VIEW ${index + 1}: ${view.label.toUpperCase()} ---\n`;
      combinedContext += `Contains ${view.frames.length} frames covering the movement sequence.\n`;

      if (view.telemetry) {
        combinedContext += `**LIVE TELEMETRY (Center Frame):**\n${view.telemetry}\n`;
      } else if (view.poseData) {
        // Fallback if raw pose provided
        const analysis = poseDetectionService.analyzePoseGeometry(view.poseData);
        combinedContext += `**CALCULATED ANGLES (Center Frame):**\n${analysis.keyAngles.map(a => `- ${a.joint}: ${a.angle}°`).join('\n')}\n`;
        combinedContext += `**POSE SUMMARY:**\n${analysis.poseSummary}\n`;
      }
    });

    // Calculate index mapping for the prompt
    let currentIndex = 1;
    const mappingTable = input.views.map((v, i) => {
      const start = currentIndex;
      const end = currentIndex + v.frames.length - 1;
      currentIndex += v.frames.length;
      return `   - Global Images ${start}-${end} correspond to **${v.label} Frames 1-${v.frames.length}**`;
    }).join('\n');

    const promptText = `
    **MULTI-ANGLE TEMPORAL BIOMECHANICS ANALYSIS**
    
    You are analyzing a **SEQUENCE** of a movement captured from ${input.views.length} different camera angles simultaneously.
    These frames are displayed to the user in the "Visual Evidence" section.
    
    **INPUT STRUCTURE:**
    - Total Images: ${input.views.reduce((acc, v) => acc + v.frames.length, 0)}
    - Order: The images are provided in blocks by View, then sequentially by Time.
    
    **INDEX MAPPING (CRITICAL - DO NOT IGNORE):**
    ${mappingTable}
    
    **CRITICAL INSTRUCTIONS:**
    1. **CITATION REQUIRED:** You MUST cite specific evidence for **EVERY** observation, correction, or technique point you make.
       - **Format:** "**(View Label, Frame X)**" -> e.g., "(Front View, Frame 2)", "(Side View, Frame 4)"
       - **Translation Rule:** You receive images as a flat list (1 to N). You MUST translate the Global Image Index to the Local View Frame using the table above.
         - *Example:* If Side View starts at Image 11, then Image 15 is "Side View, Frame 5".
         - NEVER cite "Frame 15" if the view only has 10 frames.
       - "Frame 1" is always the start of that view's sequence.

    2. **Synthesize Views:** 
       - Use "Front View" for symmetry (knees caving, shifts).
       - Use "Side View" for spinal alignment, depth, and forward lean.
       - If views contradict, prioritize the one showing the error (e.g., "Side View reveals rounding not seen in Front").

    3. **Phase Identification:** Identify the phase (Setup, Descent, Apex, Ascent) based on the temporal sequence.

    ${input.userDeclaredSkill ? `**USER DECLARED MOVEMENT:** "${input.userDeclaredSkill}"` : ""}
    
    Provide a unified biomechanical analysis in JSON format.
    `;

    // Prepare parts - Flatten all frames from all views
    const allImageParts: any[] = [];

    input.views.forEach(view => {
      view.frames.forEach(base64 => {
        const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
        allImageParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanBase64
          }
        });
      });
    });

    const parts = [
      ...allImageParts,
      { text: promptText }
    ];

    return await callGeminiApi(parts, SYSTEM_INSTRUCTION, responseSchema, 4096); // Increased token limit for complex analysis

  } catch (error) {
    console.error("Gemini Multi-View Analysis Error:", error);
    throw error;
  }
};
