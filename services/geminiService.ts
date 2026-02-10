
import { GoogleGenAI, Type } from "@google/genai";
import { PayrollInput, PayrollOutput } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const SYSTEM_PROMPT = `You are Phoenix AI Workforce Monitoring System.

IMPORTANT RULES:
- Employee identity is NOT detected from image.
- Employee ID is provided manually by user.
- Sector is selected manually by user.
- You ONLY analyze safety and activity from image.
- Never guess identity.

STEP 1 — Employee ID validation
Valid only: EM001–EM100
If outside → authorized = false → salary = 0, efficiency = 0, work_status = denied → STOP.

STEP 2 — Human detection
- Detect real person in the image.
- If none → human_detected = false, working_status = absent, efficiency = 0.

STEP 3 — Activity detection
Classify activity level from image:
- HIGH: Operating machines, drilling, digging, typing, lifting tools.
- MEDIUM: Walking, preparing, monitoring.
- LOW: Sitting idle, resting, using phone, not engaged.
- NOT PRESENT: No worker visible.

STEP 4 — Working status mapping
- HIGH or MEDIUM → working
- LOW → idle
- NOT PRESENT → absent

STEP 5 — Base efficiency
- HIGH → 95
- MEDIUM → 70
- LOW → 30
- ABSENT → 0

STEP 6 — Sector safety rules
- Mining: Helmet REQUIRED.
- Hardware: Helmet + Vest REQUIRED.
- Software: No PPE required.
- Missing required PPE: Subtract 30 from efficiency, mark as unsafe violation.
- Unsafe posture: Subtract 20 from efficiency.
- Final efficiency MUST be between 0–100.

STEP 7 — Risk level
- safe + working → low
- idle → medium
- missing PPE → high
- multiple violations → critical
- absent → none

DETERMINISTIC CALCULATIONS (Perform these mathematically):
STEP 8 — Working Hours: Decimal difference between current_time and check_in_time.
STEP 9 — Salary Calculation:
  - Base rates: Mining = 50/hr, Hardware = 45/hr, Software = 60/hr.
  - Rate Adjustment: Extract number N from ID (e.g., EM023 -> 23). group = (N-1) // 5.
  - If group is EVEN → hourly_rate = base_rate.
  - If group is ODD → hourly_rate = base_rate + 5.
  - base_salary = hours_worked × hourly_rate.
STEP 10 — Productivity Adjustment:
  - efficiency_percentage >= 90 → +10% bonus
  - 50–89 → normal (no change)
  - < 50 → -10% penalty
  - final_salary = base_salary adjusted by efficiency.
STEP 11 — Work Status:
  - hours_worked >= 6 → full_day
  - hours_worked < 6 → half_day

OUTPUT ONLY VALID JSON.`;

export async function calculatePayroll(input: PayrollInput): Promise<PayrollOutput> {
  try {
    const parts: any[] = [
      { text: `INPUT DATA: ${JSON.stringify({
        employee_id: input.employee_id,
        sector: input.sector,
        check_in_time: input.check_in_time,
        current_time: input.current_time
      })}` }
    ];

    if (input.worker_image) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: input.worker_image
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-09-2025',
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            employee_id: { type: Type.STRING },
            sector: { type: Type.STRING },
            authorized: { type: Type.BOOLEAN },
            human_detected: { type: Type.BOOLEAN },
            working_status: { type: Type.STRING },
            activity_level: { type: Type.STRING },
            helmet: { type: Type.BOOLEAN },
            vest: { type: Type.BOOLEAN },
            efficiency_percentage: { type: Type.NUMBER },
            risk_level: { type: Type.STRING },
            hours_worked: { type: Type.NUMBER },
            hourly_rate: { type: Type.NUMBER },
            base_salary: { type: Type.NUMBER },
            final_salary: { type: Type.NUMBER },
            work_status: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            explanation: { type: Type.STRING }
          },
          required: [
            "employee_id", "sector", "authorized", "human_detected", 
            "working_status", "activity_level", "helmet", "vest", 
            "efficiency_percentage", "risk_level", "hours_worked", 
            "hourly_rate", "base_salary", "final_salary", "work_status", 
            "confidence", "explanation"
          ]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      ...result,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("Phoenix AI Verification failed:", error);
    throw new Error("Supervisor System Error: " + (error as Error).message);
  }
}
