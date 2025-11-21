import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, Modality } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("ERROR: API_KEY is missing in .env file");
}

const ai = new GoogleGenAI({ apiKey: apiKey });

// In-memory storage for chat sessions (For demo purposes. Use Redis/DB for production)
const chatSessions = new Map();

// --- Shared Configuration Logic (Moved from Frontend) ---
const LANGUAGE_CONFIGS = {
  French: { name: 'French', tutorName: 'Pierre', voiceName: 'Fenrir' },
  English: { name: 'English', tutorName: 'James', voiceName: 'Fenrir' },
  Spanish: { name: 'Spanish', tutorName: 'Sofia', voiceName: 'Kore' },
  German: { name: 'German', tutorName: 'Hans', voiceName: 'Fenrir' },
  Russian: { name: 'Russian', tutorName: 'Dimitri', voiceName: 'Fenrir' },
  Japanese: { name: 'Japanese', tutorName: 'Yuki', voiceName: 'Puck' },
};

const getSystemInstruction = (langConfig) => `
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

// Helper function to parse JSON from LLM response cleanly
const parseGeminiJson = (text) => {
  try {
    // 1. Try direct parse
    return JSON.parse(text);
  } catch (e) {
    // 2. Remove markdown code blocks if present
    const cleaned = text.replace(/```json\n?|```/g, '');
    
    // 3. Find the first '{' and last '}'
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        const jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonStr);
      } catch (e2) {
        throw new Error("JSON extraction failed: " + e2.message);
      }
    }
    throw new Error("No JSON found in response");
  }
};

// --- Endpoints ---

app.post('/api/chat/start', async (req, res) => {
  try {
    const { scenario, language } = req.body;
    const config = LANGUAGE_CONFIGS[language];
    
    if (!config) {
      return res.status(400).json({ error: "Invalid language" });
    }

    const sessionId = Date.now().toString();
    
    const chatSession = ai.chats.create({
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

    chatSessions.set(sessionId, { session: chatSession, language });

    const scenarioPrompt = `The current topic is: ${scenario}. Start the conversation by introducing yourself as ${config.tutorName} and asking a relevant question in ${config.name}.`;
    
    const result = await chatSession.sendMessage({ message: scenarioPrompt });
    const parsed = parseGeminiJson(result.text);

    res.json({ sessionId, ...parsed });
  } catch (error) {
    console.error("Init Chat Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/message', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const sessionData = chatSessions.get(sessionId);

    if (!sessionData) {
      return res.status(404).json({ error: "Session not found or expired" });
    }

    const result = await sessionData.session.sendMessage({ message });
    const parsed = parseGeminiJson(result.text);

    res.json(parsed);
  } catch (error) {
    console.error("Send Message Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceName } = req.body;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || 'Fenrir' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned");
    }

    res.json({ audioData: base64Audio });
  } catch (error) {
    console.error("TTS Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
