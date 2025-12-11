import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from "@google/genai";

dotenv.config();

const app = express();

// Allow all origins
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json({ limit: '10mb' })); // Increase limit for audio blobs

// --- Configuration ---
const apiKey = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey });

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
    Chinese: { name: 'Chinese', tutorName: 'Li Wei' },
};

const getSystemInstruction = (langConfig) => `
You are ${langConfig.tutorName}, a friendly, charming, and patient ${langConfig.name} tutor. 
Your goal is to help the user learn ${langConfig.name} through natural conversation.

Interaction Protocol:
1. **Normal Conversation**: If the user speaks ${langConfig.name}, respond naturally. Check for grammar mistakes.
2. **Language Bridge**: If the user speaks English/Chinese asking how to say something, provide the translation in ${langConfig.name} and ask them to repeat it.
3. **Audio Input**: If the user sends an audio message, listen carefully to what they say (even if it is imperfect) and respond accordingly.
4. **Correction**: Always provide a JSON response with corrections.

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
        return;
    }

    console.log("📡 Checking connectivity to Google Gemini...");
    try {
        // Correct usage for SDK 0.2.0+
        await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Hi",
        });
        console.log("✅ Connection Successful! Gemini is reachable.");
    } catch (error) {
        console.error("❌ Gemini Connection Failed:", error.message);
    }
};

// --- ROUTES ---

app.post('/api/chat', async (req, res) => {
    try {
        const { message, audioData, audioMimeType, sessionId, language, scenario } = req.body;
        const config = LANGUAGE_CONFIGS[language] || LANGUAGE_CONFIGS.French;

        // Manage History
        if (!chatSessions.has(sessionId)) {
            chatSessions.set(sessionId, []);
        }
        const history = chatSessions.get(sessionId);

        // Prepare content parts
        const parts = [];
        if (audioData) {
            // Ensure we pass the correct mime type, defaulting to audio/webm if unspecified
            parts.push({ inlineData: { mimeType: audioMimeType || 'audio/webm', data: audioData } });
        }
        if (message) {
            parts.push({ text: message });
        } else {
            parts.push({ text: `I want to discuss ${scenario}` });
        }

        if (parts.length === 0) {
            return res.status(400).json({ error: "No message or audio provided" });
        }

        // Construct context for the model
        // We send previous history to maintain conversation context
        const contents = [
            ...history,
            { role: 'user', parts: parts }
        ];

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contents,
            config: {
                systemInstruction: getSystemInstruction(config),
                responseMimeType: "application/json"
            }
        });

        const responseText = result.text;
        const responseJson = parseGeminiJson(responseText);

        // Update history
        history.push({ role: 'user', parts: parts }); // Save user turn
        history.push({ role: 'model', parts: [{ text: responseText }] }); // Save model turn

        // Limit history size to prevent context window issues
        if (history.length > 20) history.splice(0, 2);

        res.json(responseJson);

    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

app.post('/api/tts', async (req, res) => {
    try {
        const { text, voiceName } = req.body;

        if (!text) {
            return res.status(400).json({ error: "Text is required" });
        }

        // Use Gemini 2.5 Flash TTS (Standard Preview Model)
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: { parts: [{ text: text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' } }
                }
            }
        });

        // Extract base64 audio
        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (!audioData) {
            throw new Error("No audio data generated");
        }

        res.json({
            audioData: audioData,
            format: 'pcm' // Frontend handles PCM decoding
        });

    } catch (error) {
        console.error("TTS Error:", error);
        res.status(500).json({ error: error.message || "TTS Generation Failed" });
    }
});

// Run check on startup
checkConnectivity();

export default app;