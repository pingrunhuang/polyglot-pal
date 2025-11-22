import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, Modality } from "@google/genai";
// NOTE: If using Doubao/Volcengine, you might normally import their SDK here.
// For this implementation, we will use standard fetch to keep dependencies minimal
// until you provide specific SDK requirements.

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
    French: { name: 'French', tutorName: 'Pierre', voiceName: 'Fenrir' },
    English: { name: 'English', tutorName: 'James', voiceName: 'Fenrir' },
    Spanish: { name: 'Spanish', tutorName: 'Sofia', voiceName: 'Kore' },
    German: { name: 'German', tutorName: 'Hans', voiceName: 'Fenrir' },
    Russian: { name: 'Russian', tutorName: 'Dimitri', voiceName: 'Fenrir' },
    Japanese: { name: 'Japanese', tutorName: 'Yuki', voiceName: 'Puck' },
    Cantonese: { name: 'Cantonese', tutorName: 'Ka-ming', voiceName: 'Fenrir' },
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

// --- TTS PROVIDER LOGIC ---

// 1. Default Gemini TTS
const generateGeminiTTS = async (text, voiceName) => {
    console.log("Using Provider: Gemini TTS");
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
    return base64Audio;
};

// 2. Doubao (ByteDance) TTS Placeholder
// Ensure you set DOUBAO_API_KEY, DOUBAO_APP_ID, etc. in your .env
const generateDoubaoTTS = async (text, voiceName) => {
    console.log("Using Provider: Doubao TTS");

    const apiKey = process.env.DOUBAO_API_KEY;
    const appid = process.env.DOUBAO_APP_ID;
    const token = process.env.DOUBAO_TOKEN; // or however they authenticate

    if (!apiKey && !token) {
        throw new Error("Doubao configuration missing (DOUBAO_API_KEY/TOKEN)");
    }

    // Mock implementation structure for Volcengine/Doubao API
    // Replace this URL and Body with the actual Volcengine API specs
    const url = "https://openspeech.bytedance.com/api/v1/tts";

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token || apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            app: { appid: appid },
            user: { uid: "user_1" },
            audio: {
                voice_type: "BV001_streaming", // Example Doubao Voice ID
                encoding: "mp3",
                speed_ratio: 1.0,
            },
            request: {
                text: text,
                operation: "query",
            }
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Doubao TTS API Error: ${err}`);
    }

    const data = await response.json();
    return data.data; // Assuming API returns base64 in 'data' field
};


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

// Updated TTS Endpoint
app.post('/api/tts', async (req, res) => {
    try {
        const { text, voiceName } = req.body;

        // Determine Provider
        const provider = process.env.TTS_PROVIDER || 'gemini';
        let base64Audio = null;

        if (provider === 'doubao') {
            // Fallback to Gemini if Doubao config is missing but provider is set
            if (!process.env.DOUBAO_API_KEY && !process.env.DOUBAO_TOKEN) {
                console.warn("Doubao provider selected but no keys found. Falling back to Gemini.");
                base64Audio = await generateGeminiTTS(text, voiceName);
            } else {
                base64Audio = await generateDoubaoTTS(text, voiceName);
            }
        } else {
            // Default
            base64Audio = await generateGeminiTTS(text, voiceName);
        }

        if (!base64Audio) throw new Error("No audio data returned from provider");
        res.json({ audioData: base64Audio });

    } catch (error) {
        console.error("TTS Error:", error);
        res.status(500).json({ error: error.message || "Text-to-Speech failed" });
    }
});

export default app;