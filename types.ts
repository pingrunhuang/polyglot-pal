export enum Sender {
  USER = 'USER',
  TUTOR = 'TUTOR'
}

export type SupportedLanguage = 'French' | 'English' | 'Spanish' | 'German' | 'Russian' | 'Japanese' | 'Cantonese' | 'Chinese';

export interface LanguageConfig {
  id: SupportedLanguage;
  name: string;
  flag: string;
  tutorName: string;
  voiceName: string;
  speechCode: string; // e.g., 'fr-FR', 'es-ES'
  greeting: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
  isPremium: boolean;
}

export interface CorrectionData {
  hasMistake: boolean;
  correctedText?: string | null;
  explanation?: string | null;
}

export interface TutorResponseData {
  targetText: string; // The text in the target language (formerly 'french')
  english: string;
  chinese: string;
}

export interface AudioResponse {
  data: Uint8Array;
  format: 'mp3' | 'pcm';
}

export interface Message {
  id: string;
  sender: Sender;
  text: string; // Raw text for user, unused for tutor if structured data is present
  timestamp: number;
  userAudioUrl?: string; // URL to local blob for playback
  // Specific to Tutor responses
  correction?: CorrectionData;
  tutorResponse?: TutorResponseData;
  isLoading?: boolean;
}

export interface ChatState {
  messages: Message[];
  isTyping: boolean;
  error: string | null;
}

export enum Scenarios {
  INTRO = "Introduction & Basics",
  CAFE = "Ordering at a Café",
  TRAVEL = "Asking for Directions",
  HOBBIES = "Discussing Hobbies"
}
