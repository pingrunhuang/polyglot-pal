import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from '@google/genai';
import { initSupabase, createScopedSupabase } from './supabase.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// --- Configuration ---
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY; // Support both names

// Initialize Supabase
const supabase = initSupabase();

// Allow all origins
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
}));

app.use(express.json({ limit: '10mb' })); // Increase limit for audio blobs

// --- AI Client ---
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
        const { message, audioData, audioMimeType, sessionId, language, scenario, userId, history: clientHistory } = req.body;
        const config = LANGUAGE_CONFIGS[language] || LANGUAGE_CONFIGS.French;
        let history = [];

        // 1. Try to use Client History first (Optimization)
        if (clientHistory && Array.isArray(clientHistory)) {
            history = clientHistory;
        }
        // 2. Fallback: Fetch from Supabase (only if no client history provided)
        else if (userId && supabase) {
            // Fetch from Supabase with Scope
            const { data: dbHistory, error } = await supabase
                .from('chat_history')
                .select('*')
                .eq('user_id', userId)
                .eq('language', language)
                .eq('scenario', scenario)
                .order('created_at', { ascending: true })
                .limit(50);

            if (!error && dbHistory) {
                history = dbHistory.map(entry => ({
                    role: entry.role,
                    parts: entry.content
                }));
            } else if (error) {
                console.error("Supabase Fetch Error:", error);
            }
        }

        // Fallback or addition of in-memory for session continuity if DB fails or for anon users
        // Note: For simplicity, if we have a userId, we rely on DB. If not, we use memory.
        if (!userId) {
            if (!chatSessions.has(sessionId)) {
                chatSessions.set(sessionId, []);
            }
            history = chatSessions.get(sessionId);
        }

        // Prepare content parts
        const parts = [];
        if (audioData) {
            // Ensure we pass the correct mime type, defaulting to audio/webm if unspecified
            parts.push({ inlineData: { mimeType: audioMimeType || 'audio/webm', data: audioData } });
        }
        if (message) {
            parts.push({ text: message });
        }

        let isAutoTrigger = false;
        if (parts.length === 0) {
            // Check if this is a new session (landing page)
            if (history.length === 0) {
                isAutoTrigger = true;
                const prompt = `The user has entered the session. Scenario: "${scenario || 'General Chat'}". Please greet the user warmly as ${config.tutorName} and explicitly start the scenario.`;
                parts.push({ text: prompt });
            } else {
                return res.status(400).json({ error: "No message or audio provided" });
            }
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
        const userTurn = { role: 'user', parts: parts };
        const modelTurn = { role: 'model', parts: [{ text: responseText }] };

        if (userId) {
            // Token Forwarding for RLS
            const authHeader = req.headers.authorization;
            let scopedSupabase = supabase; // Fallback to server client (Anon) if no token

            if (authHeader) {
                const token = authHeader.split(' ')[1];
                const scoped = createScopedSupabase(token);
                if (scoped) {
                    scopedSupabase = scoped;
                    console.log("✅ Using Scoped Supabase Client for Insert");
                }
            } else {
                console.warn("⚠️ No Auth Token provided. RLS might block insert.");
            }

            // Save to Supabase (ONLY Model turn as per policy)
            console.log(`[DB Debug] Attempting to insert for User: ${userId}, Session: ${sessionId}`);

            const { data: insertData, error: insertError } = await scopedSupabase.from('chat_history').insert([
                { user_id: userId, session_id: sessionId, role: 'model', content: modelTurn.parts, language, scenario }
            ]).select();

            if (insertError) {
                console.error("[DB Error] Insert failed:", insertError);
            } else {
                console.log("[DB Success] Inserted:", insertData);
            }
        } else {
            // Memory Fallback
            history.push(userTurn);
            history.push(modelTurn);
            if (history.length > 20) history.splice(0, 2);
        }

        res.json(responseJson);

    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

app.post('/api/history', async (req, res) => {
    try {
        const { userId, language, scenario } = req.body;

        if (!userId) return res.status(400).json({ error: "User ID required" });

        // Token Forwarding
        const authHeader = req.headers.authorization;
        let scopedSupabase = supabase; // Default to anon

        if (authHeader) {
            const token = authHeader.split(' ')[1];
            const scoped = createScopedSupabase(token);
            if (scoped) scopedSupabase = scoped;
        }

        const { data, error } = await scopedSupabase
            .from('chat_history')
            .select('*')
            .eq('user_id', userId)
            .eq('language', language)
            .eq('scenario', scenario)
            .order('created_at', { ascending: true });

        if (error) throw error;

        res.json({ history: data });

    } catch (error) {
        console.error("History Fetch Error:", error);
        res.status(500).json({ error: error.message });
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
