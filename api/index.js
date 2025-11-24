import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";

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
const speechKey = process.env.SPEECH_KEY;
const speechRegion = process.env.SPEECH_REGION;

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

const checkConnectivity = async () => {
    if (!apiKey) {
        console.error("❌ ERROR: API_KEY is missing in .env file.");
        // Don't return, allow server to start so we can see the error in logs easier
    }

    if (!speechKey || !speechRegion) {
        console.error("❌ ERROR: SPEECH_KEY or SPEECH_REGION is missing in .env file (Required for Azure TTS).");
    }

    console.log("📡 Checking connectivity to Google Gemini...");
    try {
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        // Simple ping
        await model.generateContent("Hi");
        console.log("✅ Connection Successful! Gemini is reachable.");
    } catch (error) {
        console.error("❌ Connection failed.");
        console.error("   Reason:", error.message);
        if (error.cause) console.error("   Cause:", error.cause);

        if (error.message.includes("fetch failed")) {
            console.error("\n💡 TIP: It looks like a network block.");
            console.error("   1. If you are in China/Corporate Network, you need a VPN or Proxy.");
            console.error("   2. Try setting GEMINI_BASE_URL in .env to a reverse proxy.");
        }
    }
};

// Run check on startup
checkConnectivity();

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

// Azure TTS Endpoint (REST API Implementation)
app.post('/api/tts', async (req, res) => {
    try {
        const { text, voiceName } = req.body;

        if (!speechKey || !speechRegion) {
            return res.status(500).json({ error: "Server missing Azure Speech credentials (SPEECH_KEY/SPEECH_REGION)" });
        }

        // Validate Input
        if (!text) {
            console.warn("TTS Warning: Received empty or undefined text");
            return res.status(400).json({ error: "Text is required for TTS" });
        }
        if (!voiceName) {
            return res.status(400).json({ error: "Voice name is required for TTS" });
        }

        const safeText = String(text).substring(0, 50);
        console.log(`TTS Request (Azure REST): ${voiceName} - "${safeText}..."`);

        // Extract locale from voice name (e.g., 'fr-FR-HenriNeural' -> 'fr-FR')
        const locale = voiceName.split('-').slice(0, 2).join('-');

        const ssml = `
      <speak version='1.0' xml:lang='${locale}'>
        <voice xml:lang='${locale}' xml:gender='Male' name='${voiceName}'>
          ${text}
        </voice>
      </speak>
    `;

        const ttsUrl = `https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

        const response = await fetch(ttsUrl, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': speechKey,
                'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
                'User-Agent': 'PolyglotPal'
            },
            body: ssml.trim()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Azure TTS REST API Failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString('base64');

        res.json({ audioData: base64Audio, format: 'mp3' });

    } catch (error) {
        console.error("TTS Error:", error);
        res.status(500).json({
            error: "Text-to-Speech generation failed.",
            details: error.message
        });
    }
});

export default app;