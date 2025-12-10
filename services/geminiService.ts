import { CorrectionData, TutorResponseData, Scenarios, SupportedLanguage, LanguageConfig, AudioResponse, User } from "../types";
import { getMockChatResponse, getMockAudioResponse, simulateNetworkDelay } from "./mockData";

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  French: {
    id: 'French',
    name: 'French',
    flag: '🇫🇷',
    tutorName: 'Pierre',
    voiceName: 'fr-FR-HenriNeural',
    speechCode: 'fr-FR',
    greeting: "Bonjour ! Je suis Pierre. Comment vas-tu aujourd'hui ?"
  },
  English: {
    id: 'English',
    name: 'English',
    flag: '🇬🇧',
    tutorName: 'James',
    voiceName: 'en-GB-RyanNeural',
    speechCode: 'en-GB',
    greeting: "Hello! I'm James. How are you doing today?"
  },
  Spanish: {
    id: 'Spanish',
    name: 'Spanish',
    flag: '🇪🇸',
    tutorName: 'Sofia',
    voiceName: 'es-ES-AlvaroNeural',
    speechCode: 'es-ES',
    greeting: "¡Hola! Soy Sofía. ¿Cómo estás hoy?"
  },
  German: {
    id: 'German',
    name: 'German',
    flag: '🇩🇪',
    tutorName: 'Hans',
    voiceName: 'de-DE-KillianNeural',
    speechCode: 'de-DE',
    greeting: "Hallo! Ich bin Hans. Wie geht es dir heute?"
  },
  Russian: {
    id: 'Russian',
    name: 'Russian',
    flag: '🇷🇺',
    tutorName: 'Dimitri',
    voiceName: 'ru-RU-DmitryNeural',
    speechCode: 'ru-RU',
    greeting: "Привет! Я Дмитрий. Как твои дела?"
  },
  Japanese: {
    id: 'Japanese',
    name: 'Japanese',
    flag: '🇯🇵',
    tutorName: 'Yuki',
    voiceName: 'ja-JP-KeitaNeural',
    speechCode: 'ja-JP',
    greeting: "こんにちは、ゆきです。お元気ですか？"
  },
  Cantonese: {
    id: 'Cantonese',
    name: 'Cantonese',
    flag: '🇭🇰',
    tutorName: 'Ka-ming',
    voiceName: 'zh-HK-WanLungNeural',
    speechCode: 'zh-HK',
    greeting: "你好，我係嘉明。你今日點呀？"
  },
  Chinese: {
    id: 'Chinese',
    name: 'Chinese',
    flag: '🇨🇳',
    tutorName: 'Li Wei',
    voiceName: 'zh-CN-YunxiNeural',
    speechCode: 'zh-CN',
    greeting: "你好，我是李伟。你今天怎么样？"
  }
};

let currentSessionId = Date.now().toString();

export const resetSession = () => {
  currentSessionId = Date.now().toString();
};

export const getApiUrl = (endpoint: string): string => {
  // Use environment variable (Vite injects this at build time)
  // Default to empty string if not set, which implies relative path for proxy
  const baseUrl = import.meta.env?.VITE_API_URL || '';
  const cleanBase = baseUrl.replace(/\/$/, '');
  return `${cleanBase}${endpoint}`;
};

const getTimeout = () => {
  const envTimeout = import.meta.env?.VITE_API_TIMEOUT;
  return envTimeout ? parseInt(envTimeout) : 15000;
};

const fetchWithTimeout = async (resource: string, options: RequestInit = {}) => {
  const timeout = getTimeout();

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout / 1000} seconds. Backend might be sleeping.`);
    }
    throw error;
  }
};

export const chatWithGemini = async (
  message: string,
  language: SupportedLanguage,
  scenario?: Scenarios,
  audioBase64?: string,
  audioMimeType?: string,
  userId?: string
): Promise<{ correction: CorrectionData, response: TutorResponseData }> => {

  if (import.meta.env?.VITE_USE_MOCK === 'true') {
    return getMockChatResponse(message);
  }

  const response = await fetchWithTimeout(getApiUrl('/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      audioData: audioBase64,
      audioMimeType,
      language,
      sessionId: currentSessionId,
      scenario,
      userId
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = `Backend Error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error) errorMsg = errorJson.error;
    } catch (e) {
      // use raw text
    }
    throw new Error(errorMsg);
  }

  return response.json();
};

export const generateSpeech = async (text: string, voiceName?: string): Promise<AudioResponse> => {
  if (import.meta.env?.VITE_USE_MOCK === 'true') {
    return getMockAudioResponse();
  }

  const response = await fetchWithTimeout(getApiUrl('/api/tts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voiceName: voiceName || 'fr-FR-HenriNeural' // Default fallback
    })
  });

  if (!response.ok) {
    throw new Error('Speech generation failed');
  }

  const data = await response.json();
  const binaryString = window.atob(data.audioData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return {
    data: bytes,
    format: data.format || 'mp3'
  };
};

// --- AUTH & PAYMENTS ---

export const loginWithGoogle = async (token: string, userProfile: any): Promise<User> => {
  const response = await fetchWithTimeout(getApiUrl('/api/auth/google'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, userProfile })
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  return response.json();
};

export const createCheckoutSession = async (userId: string, tier: 'basic' | 'pro' = 'pro'): Promise<string> => {
  const response = await fetchWithTimeout(getApiUrl('/api/create-checkout-session'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      tier,
      successUrl: window.location.origin, // Redirect back to app
      cancelUrl: window.location.origin
    })
  });

  if (!response.ok) {
    throw new Error('Failed to create checkout session');
  }

  const data = await response.json();
  return data.url;
};