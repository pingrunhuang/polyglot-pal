import { CorrectionData, TutorResponseData, AudioResponse } from "../types";

// --- MOCK SCENARIO 1: Normal Response (Happy Path) ---
export const MOCK_NORMAL_RESPONSE: { correction: CorrectionData, response: TutorResponseData } = {
  correction: {
    hasMistake: false,
    correctedText: null,
    explanation: null
  },
  response: {
    targetText: "C'est fantastique ! Je t'entends très bien. Tu as une bonne prononciation.",
    english: "That's fantastic! I can hear you very well. You have good pronunciation.",
    chinese: "太棒了！我听得很清楚。你的发音很好。"
  }
};

// --- MOCK SCENARIO 2: Correction Needed (Error Path) ---
export const MOCK_CORRECTION_RESPONSE: { correction: CorrectionData, response: TutorResponseData } = {
  correction: {
    hasMistake: true,
    correctedText: "Je veux aller au supermarché.",
    explanation: "In French, 'supermarché' is masculine, so we use 'au' (à + le) instead of 'à la'."
  },
  response: {
    targetText: "Ah, je comprends. Tu veux faire des courses ? Allons-y ensemble.",
    english: "Ah, I understand. You want to go shopping? Let's go together.",
    chinese: "啊，我明白了。你想去购物吗？我们一起去吧。"
  }
};

// --- Helper to simulate network delay ---
export const simulateNetworkDelay = (ms: number = 1000) => new Promise(resolve => setTimeout(resolve, ms));

// --- Mock TTS Generator (Returns silent buffer to prevent errors) ---
export const getMockAudioResponse = (): AudioResponse => {
  // Create a tiny 1-second silent buffer
  const sampleRate = 24000;
  const seconds = 1;
  const bufferSize = sampleRate * seconds;
  const pcmData = new Uint8Array(bufferSize * 2); // 16-bit PCM = 2 bytes per sample

  return {
    data: pcmData,
    format: 'pcm'
  };
};

/**
 * Intelligent Mock Handler
 * Decides which mock response to return based on user input trigger words.
 */
export const getMockChatResponse = async (inputText: string = ""): Promise<{ correction: CorrectionData, response: TutorResponseData }> => {
  await simulateNetworkDelay(1500); // Fake a 1.5s thinking time

  const lowerText = inputText.toLowerCase();

  // TRIGGER: If user types/says "mistake", "wrong", or "error", return the Correction Scenario
  if (lowerText.includes('mistake') || lowerText.includes('wrong') || lowerText.includes('error')) {
    return MOCK_CORRECTION_RESPONSE;
  }

  // DEFAULT: Return Normal Scenario
  return MOCK_NORMAL_RESPONSE;
};
