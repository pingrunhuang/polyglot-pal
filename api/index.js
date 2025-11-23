import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

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
const chatSessions = new Map();

const LANGUAGE_CONFIGS = {
    French: { name: 'French', tutorName: 'Pierre' },
    English: { name: 'English', tutorName: 'James' },
    Spanish: { name: 'Spanish', tutorName: 'Sofia' },
    German: { name: 'German', tutorName: 'Hans' },
    Russian: { name: 'Russian', tutorName: 'Dimitri' },
    Japanese: { name: 'Japanese', tutorName: 'Yuki' },
    Cantonese: { name: 'Cantonese', tutorName: 'Ka-ming' },
};

const getSystemInstruction = (langConfig) => `
You are ${langConfig.tutorName}, a friendly, charming, and patient ${langConfig.name} tutor. 
Your goal is to help the user learn ${langConfig.name} through natural conversation.

Interaction Protocol:
1. **Normal Conversation**: If the user speaks ${langConfig.name}, respond naturally. Check for grammar mistakes.
2. **Language Bridge**: If the user speaks English/Chinese asking how to say something, provide the translation in ${langConfig.name} and ask them to repeat it.
3. **Correction**: Always provide a JSON response with corrections.

Specific Language Instructions:
${langConfig.name === 'Cantonese' ? '- You MUST use Traditional Chinese characters and colloquial Cantonese grammar/particles (e.g., 唔, 係, 嘅) instead of standard written Chinese.' : ''}

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

app.get('/', (req, res) => {
    res.send("Server is Healthy");
});

// Aliases for compatibility
app.post('/api/chat/start', (req, res) => {
    // Forward to main chat logic
    req.url = '/api/chat';
    app.handle(req, res);
});


// Main Chat Endpoint
app.post('/api/chat', async (req, res) => {
    // Request Logger
    console.log(`Incoming Request: ${req.method} ${req.originalUrl}`);

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
        if (req.body.sessionId) {
            chatSessions.delete(req.body.sessionId);
        }
        res.status(500).json({ error: error.message });
    }
});

// Edge TTS Endpoint
app.post('/api/tts', async (req, res) => {
    try {
        const { text, voiceName } = req.body;
        console.log(`TTS Request: ${voiceName} - "${text.substring(0, 20)}..."`);

        const tts = new MsEdgeTTS();
        await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const readable = tts.toStream(text);

        const chunks = [];
        readable.on("data", (chunk) => {
            chunks.push(chunk);
        });

        readable.on("end", () => {
            const buffer = Buffer.concat(chunks);
            const base64Audio = buffer.toString("base64");
            // Return format to help frontend decide how to play
            res.json({ audioData: base64Audio, format: 'mp3' });
        });

        readable.on("error", (err) => {
            console.error("Edge TTS Stream Error:", err);
            res.status(500).json({ error: "TTS Stream failed" });
        });

    } catch (error) {
        console.error("TTS Error:", error);
        res.status(500).json({ error: error.message || "Text-to-Speech failed" });
    }
});

export default app;