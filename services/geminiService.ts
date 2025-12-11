import { CorrectionData, TutorResponseData, Scenarios, SupportedLanguage, LanguageConfig, AudioResponse } from "../types";
import { getMockChatResponse, getMockAudioResponse, simulateNetworkDelay } from "./mockData";

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  French: { id: 'French', name: 'French', flag: '🇫🇷', tutorName: 'Pierre', voiceName: 'Puck', speechCode: 'fr-FR', greeting: 'Bonjour! Ça va?' },
  English: { id: 'English', name: 'English', flag: '🇬🇧', tutorName: 'James', voiceName: 'Fenrir', speechCode: 'en-US', greeting: 'Hello! How are you?' },
  Spanish: { id: 'Spanish', name: 'Spanish', flag: '🇪🇸', tutorName: 'Sofia', voiceName: 'Kore', speechCode: 'es-ES', greeting: '¡Hola! ¿Cómo estás?' },
  German: { id: 'German', name: 'German', flag: '🇩🇪', tutorName: 'Hans', voiceName: 'Charon', speechCode: 'de-DE', greeting: 'Hallo! Wie geht es dir?' },
  Russian: { id: 'Russian', name: 'Russian', flag: '🇷🇺', tutorName: 'Dimitri', voiceName: 'Zephyr', speechCode: 'ru-RU', greeting: 'Привет! Как дела?' },
  Japanese: { id: 'Japanese', name: 'Japanese', flag: '🇯🇵', tutorName: 'Yuki', voiceName: 'Puck', speechCode: 'ja-JP', greeting: 'こんにちは！元気ですか？' },
  Cantonese: { id: 'Cantonese', name: 'Cantonese', flag: '🇭🇰', tutorName: 'Ka-ming', voiceName: 'Fenrir', speechCode: 'zh-HK', greeting: '你好！食咗飯未呀？' },
  Chinese: { id: 'Chinese', name: 'Chinese', flag: '🇨🇳', tutorName: 'Li Wei', voiceName: 'Kore', speechCode: 'zh-CN', greeting: '你好！很高兴见到你。' },
};

let currentVoiceName = 'Puck';
let currentSessionId = Math.random().toString(36).substring(7) + Date.now().toString();

export const resetSession = () => {
  currentSessionId = Math.random().toString(36).substring(7) + Date.now().toString();
};

// Helper to get the correct API URL
export const getApiUrl = (endpoint: string) => {
  // Check Environment Variable
  // Safe access using optional chaining in case import.meta.env is undefined
  const baseUrl = import.meta.env?.VITE_API_URL || ''; 
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBaseUrl}${endpoint}`;
};

// Helper for Fetch with Timeout
const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
  // Safe access using optional chaining
  const envTimeout = import.meta.env?.VITE_API_TIMEOUT;
  const timeoutMs = parseInt(envTimeout || '25000', 10);
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`Fetching: ${url}`); // Debug log
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds. The server might be waking up.`);
    }
    throw error;
  }
};

export const chatWithGemini = async (
  message: string, 
  language: SupportedLanguage,
  scenario?: Scenarios,
  audioBase64?: string,
  audioMimeType?: string
): Promise<{ correction: CorrectionData, response: TutorResponseData }> => {
  
  const config = LANGUAGE_CONFIGS[language];
  currentVoiceName = config.voiceName;

  // --- MOCK MODE CHECK ---
  if (import.meta.env?.VITE_USE_MOCK === 'true') {
    console.warn("⚠️ USING MOCK DATA (No API Call) ⚠️");
    // If user sends audio, we treat it as "normal" unless they typed "mistake"
    return getMockChatResponse(message);
  }

  const response = await fetchWithTimeout(getApiUrl('/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      message, 
      audioData: audioBase64, // Pass audio data if available
      audioMimeType,          // Pass detected mime type
      sessionId: currentSessionId, 
      language, 
      scenario 
    })
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (e) {
      // If parsing fails, stick with statusText
    }
    throw new Error(`Backend Error: ${errorMessage}`);
  }

  const data = await response.json();
  return {
    correction: data.correction,
    response: data.response
  };
};

export const generateSpeech = async (text: string): Promise<AudioResponse> => {
  if (!text) {
    throw new Error("Cannot generate speech for empty text");
  }

  // --- MOCK MODE CHECK ---
  if (import.meta.env?.VITE_USE_MOCK === 'true') {
    console.warn("⚠️ USING MOCK TTS (Silent Buffer) ⚠️");
    await simulateNetworkDelay(500);
    return getMockAudioResponse();
  }
  
  try {
    const response = await fetchWithTimeout(getApiUrl('/api/tts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceName: currentVoiceName })
    });

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorData = await response.json();
        if (errorData.error) errorMessage = errorData.error;
      } catch (e) {}
      throw new Error(`TTS Backend Error: ${errorMessage}`);
    }

    const data = await response.json();
    const base64Audio = data.audioData;
    const format = data.format || 'mp3'; // Default to mp3 for Edge TTS
    
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return { data: bytes, format };
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
};