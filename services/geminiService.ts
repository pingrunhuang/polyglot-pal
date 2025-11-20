import { GoogleGenAI, Type, Chat, Modality } from "@google/genai";
import { CorrectionData, TutorResponseData, Scenarios, SupportedLanguage, LanguageConfig } from "../types";

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("API_KEY is missing from the environment.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key-for-build' });

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  French: { id: 'French', name: 'French', flag: '🇫🇷', tutorName: 'Pierre', voiceName: 'Fenrir', speechCode: 'fr-FR', greeting: 'Bonjour! Ça va?' },
  English: { id: 'English', name: 'English', flag: '🇬🇧', tutorName: 'James', voiceName: 'Fenrir', speechCode: 'en-US', greeting: 'Hello! How are you?' },
  Spanish: { id: 'Spanish', name: 'Spanish', flag: '🇪🇸', tutorName: 'Sofia', voiceName: 'Kore', speechCode: 'es-ES', greeting: '¡Hola! ¿Cómo estás?' },
  German: { id: 'German', name: 'German', flag: '🇩🇪', tutorName: 'Hans', voiceName: 'Fenrir', speechCode: 'de-DE', greeting: 'Hallo! Wie geht es dir?' },
  Russian: { id: 'Russian', name: 'Russian', flag: '🇷🇺', tutorName: 'Dimitri', voiceName: 'Fenrir', speechCode: 'ru-RU', greeting: 'Привет! Как дела?' },
  Japanese: { id: 'Japanese', name: 'Japanese', flag: '🇯🇵', tutorName: 'Yuki', voiceName: 'Puck', speechCode: 'ja-JP', greeting: 'こんにちは！元気ですか？' },
};

const getSystemInstruction = (langConfig: LanguageConfig) => `
You are ${langConfig.tutorName}, a friendly, charming, and patient ${langConfig.name} tutor. 
Your goal is to help the user learn ${langConfig.name} through natural conversation.

Interaction Protocol:

1. **Normal Conversation (${langConfig.name} Input)**:
   - If the user speaks ${langConfig.name}, respond naturally to the roleplay scenario.
   - Keep responses concise (1-2 sentences).
   - Check for grammar mistakes.

2. **Language Bridge (Other Language Input)**:
   - If the user speaks a different language (like English or Chinese) asking "How do I say this?", or simply speaks in their native tongue:
   - **DO NOT** answer the content of their question yet.
   - Instead, provide the **${langConfig.name} translation** of what they wanted to say.
   - Encouragingly ask them to repeat it in ${langConfig.name}.
   - Example Response: "Ah, you want to say [${langConfig.name} phrase]? Allez, try saying it!"

3. **Resume (After Correction)**:
   - If the user repeats a corrected phrase properly, praise them, then answer their original question or continue the story.

Output Format:
You MUST respond using a valid JSON object with the following schema:
{
  "correction": {
    "hasMistake": boolean,
    "correctedText": string | null, 
    "explanation": string | null
  },
  "response": {
    "targetText": string, // Your response in ${langConfig.name}
    "english": string, // English translation
    "chinese": string  // Chinese translation
  }
}
`;

let chatSession: Chat | null = null;
let currentVoiceName = 'Fenrir';

export const initChat = (scenario: Scenarios, language: SupportedLanguage) => {
  const config = LANGUAGE_CONFIGS[language];
  currentVoiceName = config.voiceName; // Store for TTS
  
  const scenarioPrompt = `The current topic is: ${scenario}. Start the conversation by introducing yourself as ${config.tutorName} and asking a relevant question in ${config.name}.`;
  
  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: getSystemInstruction(config),
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          correction: {
            type: Type.OBJECT,
            properties: {
              hasMistake: { type: Type.BOOLEAN },
              correctedText: { type: Type.STRING, nullable: true },
              explanation: { type: Type.STRING, nullable: true }
            },
            required: ["hasMistake"]
          },
          response: {
            type: Type.OBJECT,
            properties: {
              targetText: { type: Type.STRING, description: `The response in ${config.name}` },
              english: { type: Type.STRING },
              chinese: { type: Type.STRING }
            },
            required: ["targetText", "english", "chinese"]
          }
        }
      }
    }
  });

  return scenarioPrompt;
};

// Helper for exponential backoff
const retryOperation = async <T>(operation: () => Promise<T>, retries = 3, delay = 500): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    if (retries <= 0) throw error;
    console.warn(`Operation failed, retrying in ${delay}ms...`, error);
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryOperation(operation, retries - 1, delay * 1.5); 
  }
};

export const sendMessageToGemini = async (message: string): Promise<{ correction: CorrectionData, response: TutorResponseData }> => {
  if (!chatSession) {
    throw new Error("Chat session not initialized. Call initChat first.");
  }

  try {
    const result = await retryOperation(async () => {
      return await chatSession!.sendMessage({ message });
    });

    let text = result.text;
    if (!text) throw new Error("Empty response from Gemini");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;

    const parsed = JSON.parse(jsonStr);
    return {
      correction: parsed.correction,
      response: parsed.response
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateSpeech = async (text: string): Promise<Uint8Array> => {
  try {
    const response = await retryOperation(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: currentVoiceName },
            },
          },
        },
      });
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini");
    }
    
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};