import { CorrectionData, TutorResponseData, Scenarios, SupportedLanguage, LanguageConfig } from "../types";

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  French: { id: 'French', name: 'French', flag: '🇫🇷', tutorName: 'Pierre', voiceName: 'Fenrir', speechCode: 'fr-FR', greeting: 'Bonjour! Ça va?' },
  English: { id: 'English', name: 'English', flag: '🇬🇧', tutorName: 'James', voiceName: 'Fenrir', speechCode: 'en-US', greeting: 'Hello! How are you?' },
  Spanish: { id: 'Spanish', name: 'Spanish', flag: '🇪🇸', tutorName: 'Sofia', voiceName: 'Kore', speechCode: 'es-ES', greeting: '¡Hola! ¿Cómo estás?' },
  German: { id: 'German', name: 'German', flag: '🇩🇪', tutorName: 'Hans', voiceName: 'Fenrir', speechCode: 'de-DE', greeting: 'Hallo! Wie geht es dir?' },
  Russian: { id: 'Russian', name: 'Russian', flag: '🇷🇺', tutorName: 'Dimitri', voiceName: 'Fenrir', speechCode: 'ru-RU', greeting: 'Привет! Как дела?' },
  Japanese: { id: 'Japanese', name: 'Japanese', flag: '🇯🇵', tutorName: 'Yuki', voiceName: 'Puck', speechCode: 'ja-JP', greeting: 'こんにちは！元気ですか？' },
};

let currentVoiceName = 'Fenrir';
let currentSessionId = Math.random().toString(36).substring(7) + Date.now().toString();

export const resetSession = () => {
  currentSessionId = Math.random().toString(36).substring(7) + Date.now().toString();
};

// Helper to get the correct API URL
const getApiUrl = (endpoint: string) => {
  const baseUrl = import.meta.env?.VITE_API_URL || ''; // Default to proxy if empty
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBaseUrl}${endpoint}`;
};

// Helper for Fetch with Timeout
const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
  const timeoutMs = parseInt(import.meta.env.VITE_API_TIMEOUT || '25000', 10);

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
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

// Note: We no longer need to pass 'history' because the backend is stateful
export const chatWithGemini = async (
  message: string,
  language: SupportedLanguage,
  scenario?: Scenarios
): Promise<{ correction: CorrectionData, response: TutorResponseData }> => {

  const config = LANGUAGE_CONFIGS[language];
  currentVoiceName = config.voiceName;

  const response = await fetchWithTimeout(getApiUrl('/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      sessionId: currentSessionId, // Send ID instead of history
      language,
      scenario
    })
  });

  if (!response.ok) {
    // Try to parse the JSON error message from the backend
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

export const generateSpeech = async (text: string): Promise<Uint8Array> => {
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
      } catch (e) { }
      throw new Error(`TTS Backend Error: ${errorMessage}`);
    }

    const data = await response.json();
    const base64Audio = data.audioData;

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