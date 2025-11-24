import React, { useState, useRef, useEffect } from 'react';
import { Message, Sender, LanguageConfig } from '../types';
import { Volume2, StopCircle, Sparkles, Eye, Loader2, ChevronDown, ChevronUp, Play, Pause } from 'lucide-react';
import { generateSpeech, AudioResponse } from '../services/geminiService';

interface ChatBubbleProps {
  message: Message;
  languageConfig?: LanguageConfig;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, languageConfig }) => {
  const isUser = message.sender === Sender.USER;
  const [showTranscript, setShowTranscript] = useState(false);

  // Tutor Audio State
  const [isTutorAudioLoading, setIsTutorAudioLoading] = useState(false);
  const [isTutorPlaying, setIsTutorPlaying] = useState(false);

  // User Audio State
  const [isUserPlaying, setIsUserPlaying] = useState(false);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const hasAutoPlayedRef = useRef(false);
  const audioCacheRef = useRef<AudioResponse | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => { });
      }
    };
  }, []);

  // --- User Audio Logic ---
  const toggleUserAudio = () => {
    if (!userAudioRef.current) return;

    if (isUserPlaying) {
      userAudioRef.current.pause();
      setIsUserPlaying(false);
    } else {
      userAudioRef.current.play();
      setIsUserPlaying(true);
    }
  };

  useEffect(() => {
    if (message.userAudioUrl && isUser) {
      const audio = new Audio(message.userAudioUrl);
      audio.onended = () => setIsUserPlaying(false);
      userAudioRef.current = audio;
    }
  }, [message.userAudioUrl, isUser]);


  // --- Tutor Audio Logic ---
  const stopTutorAudio = async () => {
    try {
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current = null;
      }
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
    } catch (e) {
      // Ignore errors during cleanup
    } finally {
      setIsTutorPlaying(false);
      setIsTutorAudioLoading(false);
    }
  };

  const handleSpeakTutor = async (text: string) => {
    if (isTutorAudioLoading) return;

    if (isTutorPlaying) {
      await stopTutorAudio();
      return;
    }

    setIsTutorAudioLoading(true);

    try {
      let audioResponse: AudioResponse;
      if (audioCacheRef.current) {
        audioResponse = audioCacheRef.current;
      } else {
        audioResponse = await generateSpeech(text);
        audioCacheRef.current = audioResponse;
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass(); // No sampleRate needed for mp3 decode

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      audioContextRef.current = ctx;

      let audioBuffer: AudioBuffer;

      if (audioResponse.format === 'mp3') {
        // Standard decoding for MP3 (Edge TTS)
        // We must copy the buffer because decodeAudioData detaches it
        const bufferCopy = audioResponse.data.buffer.slice(0) as ArrayBuffer;
        audioBuffer = await ctx.decodeAudioData(bufferCopy);
      } else {
        // Fallback for PCM (Legacy Gemini)
        const pcmData = audioResponse.data;
        const dataInt16 = new Int16Array(pcmData.buffer);
        const float32 = new Float32Array(dataInt16.length);
        for (let i = 0; i < dataInt16.length; i++) {
          float32[i] = dataInt16[i] / 32768;
        }
        audioBuffer = ctx.createBuffer(1, float32.length, 24000);
        audioBuffer.getChannelData(0).set(float32);
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      sourceRef.current = source;

      source.onended = () => {
        setIsTutorPlaying(false);
        sourceRef.current = null;
      };

      source.start(0);
      setIsTutorPlaying(true);

    } catch (error) {
      console.error("Failed to play audio:", error);
      setIsTutorPlaying(false);
    } finally {
      setIsTutorAudioLoading(false);
    }
  };

  useEffect(() => {
    if (!isUser && !message.isLoading && message.tutorResponse?.targetText && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      setTimeout(() => {
        handleSpeakTutor(message.tutorResponse?.targetText || '');
      }, 300);
    }
  }, [isUser, message.isLoading, message.tutorResponse]);


  // --- Render User Bubble ---
  if (isUser) {
    return (
      <div className="flex justify-end mb-6 animate-fade-in">
        <div className="max-w-[85%] md:max-w-[70%]">
          <div className="bg-blue-600 text-white px-5 py-3.5 rounded-2xl rounded-br-none shadow-md relative">
            {message.userAudioUrl && (
              <div className={`flex items-center space-x-3 ${message.text ? 'mb-2 pb-2 border-b border-blue-500/50' : ''}`}>
                <button
                  onClick={toggleUserAudio}
                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  {isUserPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                </button>
                <div className="h-6 flex-1 flex items-center space-x-1 opacity-70">
                  {/* Fake waveform visual */}
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 bg-white rounded-full transition-all duration-300 ${isUserPlaying ? 'animate-pulse' : ''}`}
                      style={{ height: `${Math.random() * 12 + 4}px` }}
                    ></div>
                  ))}
                </div>
              </div>
            )}
            {message.text && (
              <p className="text-base leading-relaxed font-medium">{message.text}</p>
            )}
          </div>
          <div className="text-right text-[10px] text-slate-400 mt-1 mr-1 font-medium opacity-70">
            You • {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    );
  }

  // --- Render Tutor Bubble ---
  const { correction, tutorResponse } = message;
  const tutorName = languageConfig?.tutorName || "Tutor";
  const tutorInitial = tutorName.charAt(0);

  return (
    <div className="flex justify-start mb-8 animate-fade-in w-full group">
      <div className="flex flex-col w-full max-w-full sm:max-w-[92%]">

        <div className="flex items-center space-x-2 mb-1.5 pl-1">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-slate-200 shadow-sm">
            <span className="font-handwriting font-bold text-blue-600 text-sm">{tutorInitial}</span>
          </div>
          <span className="text-xs font-bold text-slate-600">{tutorName}</span>
          <span className="text-[10px] text-slate-400 font-medium">• {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        {correction && correction.hasMistake && (
          <div className="mb-3 ml-2 bg-orange-50 border-l-4 border-orange-400 p-3 rounded-r-xl shadow-sm max-w-[95%]">
            <div className="flex items-start space-x-3">
              <Sparkles className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-slate-700 text-sm leading-snug mb-1">
                  {message.text && (
                    <span className="font-medium text-red-500 line-through mr-2 opacity-60">{message.text}</span>
                  )}
                  <span className="text-green-700 font-bold break-words">{correction.correctedText}</span>
                </p>
                <p className="text-xs text-slate-500 italic">
                  {correction.explanation}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-3xl rounded-tl-none shadow-sm overflow-hidden">
          <div className="p-5">
            <div className="flex items-center space-x-3 mb-4">
              <button
                onClick={() => handleSpeakTutor(tutorResponse?.targetText || '')}
                disabled={isTutorAudioLoading}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${isTutorPlaying
                  ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-200'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                  }`}
              >
                {isTutorAudioLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isTutorPlaying ? (
                  <StopCircle className="w-5 h-5 fill-current" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <span className="text-sm text-slate-400 font-medium cursor-pointer" onClick={() => handleSpeakTutor(tutorResponse?.targetText || '')}>
                {isTutorAudioLoading ? "Loading audio..." : isTutorPlaying ? "Listening..." : "Click to replay"}
              </span>
            </div>

            <div className="transition-all duration-300">
              {!showTranscript ? (
                <div
                  className="text-center py-6 cursor-pointer group/reveal bg-slate-50 rounded-xl border border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
                  onClick={() => setShowTranscript(true)}
                >
                  <div className="flex flex-col items-center justify-center text-slate-400 group-hover/reveal:text-blue-600 transition-colors">
                    <Eye className="w-6 h-6 mb-2" />
                    <span className="text-sm font-bold">Tap to reveal text</span>
                  </div>
                </div>
              ) : (
                <div className="animate-fade-in space-y-6">
                  <div>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">
                      {languageConfig?.name.toUpperCase()}
                    </p>
                    <p className="text-xl sm:text-2xl font-medium text-slate-800 leading-relaxed">
                      {tutorResponse?.targetText}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        English
                      </p>
                      <p className="text-slate-700 text-sm leading-relaxed">
                        {tutorResponse?.english}
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Chinese
                      </p>
                      <p className="text-slate-700 text-sm leading-relaxed">
                        {tutorResponse?.chinese}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div
            className="bg-slate-50 border-t border-slate-100 px-4 py-3 flex justify-center cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => setShowTranscript(!showTranscript)}
          >
            <button className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center">
              {showTranscript ? (
                <><ChevronUp className="w-3 h-3 mr-1" /> Hide Transcript</>
              ) : (
                <><ChevronDown className="w-3 h-3 mr-1" /> Show Transcript</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;