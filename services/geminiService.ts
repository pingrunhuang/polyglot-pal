import { CorrectionData, TutorResponseData, Scenarios, SupportedLanguage, LanguageConfig } from "../types";

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  French: { id: 'French', name: 'French', flag: '🇫🇷', tutorName: 'Pierre', voiceName: 'fr-FR-HenriNeural', speechCode: 'fr-FR', greeting: 'Bonjour! Ça va?' },
  English: { id: 'English', name: 'English', flag: '🇬🇧', tutorName: 'James', voiceName: 'en-US-ChristopherNeural', speechCode: 'en-US', greeting: 'Hello! How are you?' },
  Spanish: { id: 'Spanish', name: 'Spanish', flag: '🇪🇸', tutorName: 'Sofia', voiceName: 'es-ES-ElviraNeural', speechCode: 'es-ES', greeting: '¡Hola! ¿Cómo estás?' },
  German: { id: 'German', name: 'German', flag: '🇩🇪', tutorName: 'Hans', voiceName: 'de-DE-ConradNeural', speechCode: 'de-DE', greeting: 'Hallo! Wie geht es dir?' },
  Russian: { id: 'Russian', name: 'Russian', flag: '🇷🇺', tutorName: 'Dimitri', voiceName: 'ru-RU-DmitryNeural', speechCode: 'ru-RU', greeting: 'Привет! Как дела?' },
  Japanese: { id: 'Japanese', name: 'Japanese', flag: '🇯🇵', tutorName: 'Yuki', voiceName: 'ja-JP-KeitaNeural', speechCode: 'ja-JP', greeting: 'こんにちは！元気ですか？' },
  Cantonese: { id: 'Cantonese', name: 'Cantonese', flag: '🇭🇰', tutorName: 'Ka-ming', voiceName: 'zh-HK-WanLungNeural', speechCode: 'zh-HK', greeting: '你好！食咗飯未呀？' },
};

let currentVoiceName = 'en-US-ChristopherNeural';
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
  scenario?: Scenarios
): Promise<{ correction: CorrectionData, response: TutorResponseData }> => {

  const config = LANGUAGE_CONFIGS[language];
  currentVoiceName = config.voiceName;

  const response = await fetchWithTimeout(getApiUrl('/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
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

export interface AudioResponse {
  data: Uint8Array;
  format: 'mp3' | 'pcm';
}

export const generateSpeech = async (text: string): Promise<AudioResponse> => {
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