import React, { useState, useRef, useEffect } from 'react';
import { Message, Sender, LanguageConfig } from '../types';
import { Volume2, StopCircle, Sparkles, Eye, Loader2, ChevronDown, ChevronUp, Languages } from 'lucide-react';
import { generateSpeech } from '../services/geminiService';

interface ChatBubbleProps {
  message: Message;
  languageConfig?: LanguageConfig;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, languageConfig }) => {
  const isUser = message.sender === Sender.USER;
  const [showTranscript, setShowTranscript] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const hasAutoPlayedRef = useRef(false);

  const audioCacheRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleSpeak = async (text: string) => {
    if (isAudioLoading) return;

    if (isPlaying && audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch (e) {
        console.warn("Error closing context", e);
      }
      audioContextRef.current = null;
      setIsPlaying(false);
      return;
    }

    setIsAudioLoading(true);

    try {
      let pcmData: Uint8Array;

      if (audioCacheRef.current) {
        pcmData = audioCacheRef.current;
      } else {
        pcmData = await generateSpeech(text);
        audioCacheRef.current = pcmData;
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass({ sampleRate: 24000 });

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      audioContextRef.current = ctx;

      const dataInt16 = new Int16Array(pcmData.buffer);
      const float32 = new Float32Array(dataInt16.length);
      for (let i = 0; i < dataInt16.length; i++) {
        float32[i] = dataInt16[i] / 32768;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      source.onended = () => {
        setIsPlaying(false);
      };

      source.start(0);
      setIsPlaying(true);

    } catch (error) {
      console.error("Failed to play audio:", error);
    } finally {
      setIsAudioLoading(false);
    }
  };

  useEffect(() => {
    if (!isUser && !message.isLoading && message.tutorResponse?.targetText && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      setTimeout(() => {
        handleSpeak(message.tutorResponse?.targetText || '');
      }, 100);
    }
  }, [isUser, message.isLoading, message.tutorResponse]);


  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-fade-in">
        <div className="max-w-[85%] md:max-w-[70%]">
          <div className="bg-blue-600 text-white px-5 py-3 rounded-2xl rounded-br-none shadow-sm">
            <p className="text-base leading-relaxed">{message.text}</p>
          </div>
          <div className="text-right text-[10px] text-slate-400 mt-1 mr-1 font-medium">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    );
  }

  const { correction, tutorResponse, isLoading } = message;
  const tutorName = languageConfig?.tutorName || "Tutor";
  const tutorInitial = tutorName.charAt(0);

  if (isLoading) {
    return (
      <div className="flex justify-start mb-4 animate-fade-in">
        <div className="flex items-end space-x-2 max-w-[85%]">
          <div className="w-6 h-6 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center mb-1">
            <span className="text-xs font-bold text-slate-500">{tutorInitial}</span>
          </div>
          <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center space-x-2">
            <div className="flex space-x-1 h-3 items-center">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-0"></div>
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-150"></div>
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-300"></div>
            </div>
            <span className="text-xs text-slate-400 font-medium">{message.text || "Thinking..."}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-6 animate-fade-in w-full">
      <div className="flex flex-col w-full max-w-full sm:max-w-[90%]">

        {/* Avatar Header */}
        <div className="flex items-center space-x-2 mb-1 pl-1">
          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border border-blue-100 shadow-sm">
            <span className="font-handwriting font-bold text-blue-600 text-xs">{tutorInitial}</span>
          </div>
          <span className="text-xs font-bold text-slate-500">{tutorName}</span>
        </div>

        {/* Correction Panel - More Compact */}
        {correction && correction.hasMistake && (
          <div className="mb-2 ml-2 bg-orange-50 border-l-2 border-orange-400 p-3 rounded-r-lg shadow-sm max-w-[95%]">
            <div className="flex items-start space-x-2">
              <Sparkles className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-slate-700 text-sm leading-snug">
                  <span className="font-medium text-red-500 line-through mr-1 opacity-70">{message.text}</span>
                  <span className="text-green-600 font-medium break-words">{correction.correctedText}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1 italic">
                  {correction.explanation}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Bubble */}
        <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm overflow-hidden transition-all duration-300">

          <div className="p-4">
            {/* Top Controls: Play & Toggle */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => handleSpeak(tutorResponse?.targetText || '')}
                disabled={isAudioLoading}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${isPlaying
                    ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
              >
                {isAudioLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isPlaying ? (
                  <StopCircle className="w-4 h-4 fill-current" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
                <span>{isPlaying ? "Stop" : "Play Audio"}</span>
              </button>

              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title={showTranscript ? "Hide Text" : "Show Text"}
              >
                {showTranscript ? <ChevronUp className="w-5 h-5" /> : <Languages className="w-5 h-5" />}
              </button>
            </div>

            {/* Content Area */}
            <div className={`transition-all duration-500 ease-in-out ${showTranscript ? 'opacity-100' : 'opacity-80'}`}>

              {/* Target Text (Always visible if transcript shown, or if specific logic requires. 
                   Previously it was hidden. Let's keep the 'reveal' logic but make it nicer.) */}

              {!showTranscript ? (
                <div className="text-center py-4 cursor-pointer" onClick={() => setShowTranscript(true)}>
                  <p className="text-sm text-slate-400 font-medium italic flex items-center justify-center">
                    <Eye className="w-4 h-4 mr-2" /> Tap to reveal transcript
                  </p>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  {/* Main Language Text */}
                  <div>
                    <p className="text-xl sm:text-2xl font-medium text-slate-900 leading-relaxed tracking-wide">
                      {tutorResponse?.targetText}
                    </p>
                  </div>

                  {/* Translations */}
                  <div className="pt-3 border-t border-dashed border-slate-200 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">English</span>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        {tutorResponse?.english}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Chinese / 中文</span>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        {tutorResponse?.chinese}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Status */}
          {showTranscript && (
            <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex justify-center" onClick={() => setShowTranscript(false)}>
              <button className="text-xs text-slate-400 hover:text-slate-600 font-medium flex items-center">
                <ChevronDown className="w-3 h-3 mr-1" /> Hide Transcript
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;