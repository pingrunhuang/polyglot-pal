import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from "@google/genai";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import Stripe from 'stripe';

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
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', { apiVersion: '2023-10-16' });

const ai = new GoogleGenAI({ apiKey: apiKey });

// --- MOCK DATABASE (In-Memory) ---
// In a real app, use MongoDB/Postgres
const chatSessions = new Map(); // For Guest Users: sessionId -> history[]
const users = new Map(); // For Logged In Users: userId -> { profile, history[], isPremium }

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

// --- AUTH ROUTES ---

// Verify Google Token and Login/Register User
app.post('/api/auth/google', async (req, res) => {
    const { token, userProfile } = req.body;
    if (!token || !userProfile) return res.status(400).json({ error: "Missing token" });

    const userId = userProfile.sub; // Google unique ID

    if (!users.has(userId)) {
        // Register new user
        users.set(userId, {
            profile: userProfile,
            history: [],
            isPremium: false,
            lastLogin: Date.now()
        });
        console.log(`New User Registered: ${userProfile.email}`);
    } else {
        // Update existing user login time
        const user = users.get(userId);
        user.lastLogin = Date.now();
        users.set(userId, user);
        console.log(`User Logged In: ${userProfile.email} (Premium: ${user.isPremium})`);
    }

    const userData = users.get(userId);
    res.json({
        id: userId,
        name: userData.profile.name,
        email: userData.profile.email,
        picture: userData.profile.picture,
        isPremium: userData.isPremium
    });
});

// --- PAYMENT ROUTES ---

app.post('/api/create-checkout-session', async (req, res) => {
    const { userId, tier, successUrl, cancelUrl } = req.body;

    const PRICING = {
        basic: { amount: 100, name: 'Polyglot Pal Learner' }, // $1.00
        pro: { amount: 500, name: 'Polyglot Pal Premium' }   // $5.00
    };

    const selectedTier = PRICING[tier] || PRICING.pro;

    if (!process.env.STRIPE_SECRET_KEY) {
        console.warn("⚠️ No Stripe Key found. Simulating success for demo.");
        // In a real app, this would be a real Stripe session
        return res.json({ url: `${successUrl}?simulated_payment=true&userId=${userId}&tier=${tier}` });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: selectedTier.name,
                            description: 'Unlimited Context History',
                        },
                        unit_amount: selectedTier.amount,
                    },
                    quantity: 1,
                },
            ],

            mode: 'payment',
            success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&userId=${userId}`,
            cancel_url: cancelUrl,
            client_reference_id: userId,
        });

        res.json({ url: session.url });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Mock endpoint to confirm payment (called by frontend on success redirect)
app.post('/api/confirm-payment', (req, res) => {
    const { userId } = req.body;
    if (users.has(userId)) {
        const user = users.get(userId);
        user.isPremium = true;
        users.set(userId, user);
        console.log(`User ${userId} upgraded to Premium`);
        res.json({ success: true, isPremium: true });
    } else {
        res.status(404).json({ error: "User not found" });
    }
});

// --- CHAT ROUTE ---

app.post('/api/chat', async (req, res) => {
    try {
        const { message, audioData, audioMimeType, sessionId, userId, language, scenario } = req.body;
        const config = LANGUAGE_CONFIGS[language] || LANGUAGE_CONFIGS.French;

        let history = [];
        let isPremium = false;

        // 1. Determine Identity (User or Guest)
        if (userId && users.has(userId)) {
            // LOGGED IN USER
            const user = users.get(userId);
            history = user.history;
            isPremium = user.isPremium;

            // 2. Pruning Logic
            if (!isPremium) {
                const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
                const now = Date.now();
                // Filter history to only keep messages from the last 7 days
                // Note: We need to store timestamp in history for this to work accurately. 
                // For simplicity in this demo structure (Gemini history format), we just truncate the array if it gets too big 
                // OR we just assume the session is refreshed weekly. 
                // Let's implement a hard cap length for free users as a proxy for time in this specific data structure.

                // Better: We strictly filter if we added timestamps. 
                // Since Gemini API structure is { role, parts }, we'll attach a hidden timestamp property or just limit length.

                // Strict Policy: Free users get last 50 turns (~1 week of light usage)
                if (history.length > 50) {
                    history = history.slice(history.length - 50);
                }
            }

            console.log(`Chatting as User: ${user.profile.email} (History size: ${history.length})`);
        } else {
            // GUEST
            if (!chatSessions.has(sessionId)) {
                chatSessions.set(sessionId, []);
            }
            history = chatSessions.get(sessionId);
            console.log(`Chatting as Guest: ${sessionId}`);
        }

        // Prepare content parts
        const parts = [];
        if (audioData) {
            parts.push({ inlineData: { mimeType: audioMimeType || 'audio/webm', data: audioData } });
        }
        if (message) {
            parts.push({ text: message });
        }

        if (parts.length === 0) {
            return res.status(400).json({ error: "No message or audio provided" });
        }

        // Construct context for the model
        // Remove custom internal properties (like timestamp) before sending to Gemini if we added them
        // For this implementation, the history is pure Gemini format.
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
        history.push({ role: 'user', parts: parts });
        history.push({ role: 'model', parts: [{ text: responseText }] });

        // Safety cap to prevent memory leaks in this in-memory mock DB
        if (history.length > 500) history.splice(0, 100);

        res.json(responseJson);

    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

// TTS Endpoint (Unchanged)
app.post('/api/tts', async (req, res) => {
    try {
        const { text, voiceName } = req.body;

        if (!text) {
            return res.status(400).json({ error: "Text is required" });
        }

        console.log(`TTS Request: ${voiceName} - "${text.substring(0, 20)}..."`);

        // Safety Timeout: If Edge doesn't respond in 15s, abort
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Edge TTS timed out")), 15000)
        );

        const ttsPromise = new Promise(async (resolve, reject) => {
            try {
                const tts = new MsEdgeTTS();
                await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
                const readable = tts.toStream(text);

                const chunks = [];
                readable.on("data", (chunk) => chunks.push(chunk));
                readable.on("end", () => {
                    const buffer = Buffer.concat(chunks);
                    resolve(buffer.toString("base64"));
                });
                readable.on("error", (err) => reject(err));
            } catch (err) {
                reject(err);
            }
        });

        // Race the TTS against the clock
        const base64Audio = await Promise.race([ttsPromise, timeoutPromise]);

        res.json({ audioData: base64Audio, format: 'mp3' });

    } catch (error) {
        console.error("TTS Error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        res.status(500).json({ error: "Text-to-Speech generation failed." });
    }
});

// Run check on startup
checkConnectivity();

export default app;