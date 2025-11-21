import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, Modality } from "@google/genai";

dotenv.config();

const app = express();

// Allow all origins
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());

// --- Configuration ---
const apiKey = process.env.API_KEY;
const baseUrl = process.env.GEMINI_BASE_URL;

// Initialize SDK options conditionally
const clientOptions = baseUrl ? { baseUrl } : {};

// Initialize SDK
const ai = new GoogleGenAI({
    apiKey: apiKey || 'dummy_key_for_build_process',
}, clientOptions);

// --- STATEFUL STORAGE (In-Memory) ---
// Stores active chat sessions: sessionId -> Chat object
const chatSessions = new Map();

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
1. **Normal Conversation**: If the user speaks ${langConfig.name}, respond naturally. Check for grammar mistakes.
2. **Language Bridge**: If the user speaks English/Chinese asking how to say something, provide the translation in ${langConfig.name} and ask them to repeat it.
3. **Correction**: Always provide a JSON response with corrections.

Output Format:
You MUST respond using a valid JSON object with the following schema:
{
  "correction": {
    "hasMistake": boolean,
    "correctedText": string | null, 
    "explanation": string | null
  },
  "response": {
    "targetText": string, 
    "english": string, 
    "chinese": string 
  }
}
`;

// Helper to parse JSON cleanly
const parseGeminiJson = (text) => {
    try {
        return JSON.parse(text);
    } catch (e) {
        const cleaned = text.replace(/```json\n?|```/g, '').trim();
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
        }
        throw new Error("No JSON found in response");
    }
};

app.get('/api', (req, res) => {
    res.send("Polyglot Pal API is running (Stateful Mode)");
});

// Stateful Chat Endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, sessionId, language, scenario } = req.body;

        if (!process.env.API_KEY) {
            throw new Error("Server missing API_KEY");
        }
        if (!sessionId) {
            return res.status(400).json({ error: "Session ID required" });
        }

        const config = LANGUAGE_CONFIGS[language];
        if (!config) return res.status(400).json({ error: "Invalid language" });

        // Retrieve or Create Session
        let chat = chatSessions.get(sessionId);
        let isNewSession = false;

        // If no session exists OR a new scenario is requested, create a new chat
        if (!chat || scenario) {
            isNewSession = true;
            const systemInstruction = getSystemInstruction(config);

            chat = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: systemInstruction,
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
                                    targetText: { type: Type.STRING },
                                    english: { type: Type.STRING },
                                    chinese: { type: Type.STRING }
                                },
                                required: ["targetText", "english", "chinese"]
                            }
                        }
                    }
                }
            });
            chatSessions.set(sessionId, chat);
        }

        // Determine Prompt
        let prompt = message;
        if (isNewSession && scenario) {
            prompt = `The current topic is: ${scenario}. Start the conversation by introducing yourself as ${config.tutorName} and asking a relevant question in ${config.name}.`;
        }

        console.log(`[${language}] Session: ${sessionId.slice(0, 4)} | Msg: ${prompt.substring(0, 50)}...`);

        const result = await chat.sendMessage({ message: prompt });
        const parsed = parseGeminiJson(result.text);

        res.json(parsed);

    } catch (error) {
        console.error("Chat Error:", error);
        // If session is invalid/expired on Google's side, clear it locally
        if (req.body.sessionId) {
            chatSessions.delete(req.body.sessionId);
        }

        // Send the specific error message back to client
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

        let base64Audio = null;
        if (response.candidates &&
            response.candidates.length > 0 &&
            response.candidates[0].content &&
            response.candidates[0].content.parts &&
            response.candidates[0].content.parts.length > 0 &&
            response.candidates[0].content.parts[0].inlineData) {
            base64Audio = response.candidates[0].content.parts[0].inlineData.data;
        }

        if (!base64Audio) throw new Error("No audio data returned");
        res.json({ audioData: base64Audio });
    } catch (error) {
        console.error("TTS Error:", error);
        res.status(500).json({ error: "Text-to-Speech failed" });
    }
});

export default app;