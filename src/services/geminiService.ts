import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "AIzaSyDkOWhx47psb_nRQPoMNg6nz1S_Zkid5RM";
const ai = new GoogleGenAI({ apiKey });

export interface AISuggestion {
  content: string;
  methodology: string[];
}

export async function suggestPlanning(className: string, date: string): Promise<AISuggestion> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Sugira um planejamento de aula para a turma "${className}" na data ${date}. 
      O planejamento deve ser voltado para uma Escola Bíblica Dominical (EBD).
      Retorne um JSON com os campos "content" (texto descrevendo o tema e pontos da lição) e "methodology" (um array de strings com metodologias sugeridas).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            methodology: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["content", "methodology"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Resposta vazia da IA");
    
    return JSON.parse(text) as AISuggestion;
  } catch (error) {
    console.error("Erro ao sugerir planejamento com Gemini:", error);
    throw error;
  }
}
