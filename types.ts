
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

export interface CorrectionData {
  hasMistake: boolean;
  correctedText?: string | null;
  explanation?: string | null;
}

export interface TutorResponseData {
  targetText: string;
  english: string;
  chinese: string;
}

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  timestamp: number;
  userAudioUrl?: string; 
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

export interface AudioResponse {
  data: Uint8Array;
  format: 'mp3' | 'pcm';
}

export interface User {
  id: string;
  email?: string;
}