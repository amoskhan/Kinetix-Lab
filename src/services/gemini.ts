import { GoogleGenAI, Schema, Type } from "@google/genai";
import { AnalysisResponse } from "../types";
import { PoseData, poseDetectionService } from './poseDetectionService';

const MODEL_NAME = 'gemini-2.5-flash'; // Updated to latest experimental model

// Define the comprehensive schema for the "Step-by-Step" Dashboard
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    feedback: {
      type: Type.OBJECT,
      properties: {
        movementName: { type: Type.STRING, description: "Name of the identified exercise or movement." },
        confidence: { type: Type.NUMBER, description: "Confidence score 0-100." },
        phaseDetected: { type: Type.STRING, description: "Current phase (e.g., 'Wind-up', 'Force Generation', 'Follow-through')." },

        // Detailed Step-by-Step Walkthrough
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

// Construct the "Brain" System Instruction
// Objective biomechanics analysis without external standards
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

export const analyzeMovement = async (
  base64Image: string,
  poseData?: PoseData,
  userDeclaredSkill?: string
): Promise<AnalysisResponse> => {

  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    throw new Error("VITE_GEMINI_API_KEY is missing from environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  try {
    // Enhance prompt with Pose Data if available
    let poseContext = "";
    if (poseData) {
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

    // Ensure base64Image is raw data, strip prefix if exists (e.g. data:image/jpeg;base64,)
    const cleanBase64 = base64Image.includes(',')
      ? base64Image.split(',')[1]
      : base64Image;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: promptText
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 1024 }
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

export const analyzeMultiFrameMovement = async (
  input: MultiFrameAnalysisInput
): Promise<AnalysisResponse> => {

  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    throw new Error("VITE_GEMINI_API_KEY is missing from environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

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
    
    You are analyzing ${input.frames.length} frames showing a movement sequence:
    - Frame 1 (t=${input.timestamps[0].toFixed(2)}s): BEFORE position
    - Frame 2 (t=${input.timestamps[1].toFixed(2)}s): KEY FRAME (center)
    - Frame 3 (t=${input.timestamps[2].toFixed(2)}s): AFTER position
    
    ${poseContext}
    
    **CRITICAL INSTRUCTIONS:**
    ${input.userDeclaredSkill 
      ? `1. The user has declared this movement as "${input.userDeclaredSkill}". Analyze it as this movement type and verify correctness.
    2. If the visual evidence contradicts the declared movement, note this in your analysis but still provide feedback for the declared movement.`
      : `1. First, identify the movement type by observing the progression across all 3 frames.`}
    2. Use the temporal context to understand the movement phase (preparation, execution, follow-through)
    3. Focus your detailed analysis on Frame 2 (the key frame)
    4. Reference Frames 1 and 3 to validate movement direction and technique
    5. Use the measured joint angles provided above for precise biomechanical assessment
    
    Provide a comprehensive biomechanical analysis in JSON format.
    `;

    // Prepare image parts for all frames
    const imageParts = input.frames.map(frame => {
      const cleanBase64 = frame.includes(',') ? frame.split(',')[1] : frame;
      return {
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64
        }
      };
    });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          ...imageParts,
          { text: promptText }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 2048 } // Increased for multi-frame analysis
      }
    });

    const textResponse = response.text;
    if (!textResponse) throw new Error("No response text from Gemini.");

    const parsedData = JSON.parse(textResponse) as AnalysisResponse;
    return parsedData;

  } catch (error) {
    console.error("Gemini Multi-Frame Analysis Error:", error);
    throw error;
  }
};

// Deprecated alias for backward compatibility if needed, but we should use analyzeMovement
export const analyzeFrame = analyzeMovement;
