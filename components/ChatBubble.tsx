import React, { useState, useRef, useEffect } from 'react';
import { Message, Sender, LanguageConfig } from '../types';
import { Volume2, StopCircle, Sparkles, Eye, Loader2 } from 'lucide-react';
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
      <div className="flex justify-end mb-6 animate-fade-in">
        <div className="max-w-[85%] md:max-w-[70%]">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-2xl rounded-tr-sm shadow-md">
            <p className="text-lg leading-relaxed">{message.text}</p>
          </div>
          <div className="text-right text-xs text-slate-400 mt-1 mr-1">
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
      <div className="flex justify-start mb-6 animate-fade-in">
        <div className="flex flex-col max-w-[85%] md:max-w-[70%]">
          <div className="flex items-center space-x-2 mb-1">
             <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center border border-red-200">
                <span className="font-handwriting font-bold text-red-600 text-xl">{tutorInitial}</span>
             </div>
             <span className="text-sm font-medium text-slate-600">{tutorName}</span>
          </div>
          <div className="bg-white border border-slate-200 px-6 py-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center space-x-3">
            <div className="flex space-x-1 h-4 items-center">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-0"></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-150"></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-300"></div>
            </div>
            <span className="text-sm text-slate-400 font-medium animate-pulse">{message.text || `${tutorName} is thinking...`}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-8 animate-fade-in">
      <div className="flex flex-col max-w-[95%] md:max-w-[85%]">
        
        {/* Avatar Label */}
        <div className="flex items-center space-x-2 mb-2 pl-1">
           <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border-2 border-blue-100 shadow-sm">
              <span className="font-handwriting font-bold text-blue-600 text-xl">{tutorInitial}</span>
           </div>
           <span className="text-sm font-medium text-slate-600">{tutorName}</span>
           <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">Tutor</span>
        </div>

        {/* Correction Panel */}
        {correction && correction.hasMistake && (
          <div className="mb-3 ml-2 bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-lg shadow-sm">
            <div className="flex items-start space-x-3">
              <div className="mt-1">
                 <Sparkles className="w-5 h-5 text-orange-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-orange-800 uppercase tracking-wide mb-1">Correction</h4>
                <p className="text-slate-700 mb-2 text-sm">
                  <span className="font-semibold text-red-500 line-through mr-2 opacity-70">Your input</span>
                  <span className="text-green-600 font-semibold">{correction.correctedText}</span>
                </p>
                <p className="text-sm text-slate-600 italic border-t border-orange-200 pt-2 mt-2">
                  "{correction.explanation}"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Response Bubble */}
        <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm shadow-lg group relative overflow-hidden transition-all duration-500">
           {/* Decor */}
           <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>

           <div className="p-5 relative z-10">
            
            {/* Audio / Visibility Control Section */}
            <div className="flex items-center space-x-4 mb-2">
                 <button 
                    onClick={() => handleSpeak(tutorResponse?.targetText || '')}
                    disabled={isAudioLoading}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-sm ${
                      isPlaying 
                        ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse ring-4 ring-red-100' 
                        : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                    }`}
                 >
                   {isAudioLoading ? (
                     <Loader2 className="w-6 h-6 animate-spin" />
                   ) : isPlaying ? (
                     <StopCircle className="w-6 h-6" />
                   ) : (
                     <Volume2 className="w-6 h-6" />
                   )}
                 </button>

                 <div className="flex-1">
                    {isPlaying ? (
                        <div className="h-8 flex items-center space-x-1">
                            <div className="w-1 h-3 bg-blue-400 rounded-full animate-[bounce_1s_infinite]"></div>
                            <div className="w-1 h-5 bg-blue-500 rounded-full animate-[bounce_1s_infinite_0.2s]"></div>
                            <div className="w-1 h-3 bg-blue-400 rounded-full animate-[bounce_1s_infinite_0.4s]"></div>
                            <span className="ml-2 text-sm text-slate-500 font-medium">Speaking...</span>
                        </div>
                    ) : (
                        <div className="text-slate-500 text-sm font-medium">Click to replay</div>
                    )}
                 </div>
            </div>

            {/* Transcript Reveal Button */}
            {!showTranscript && (
                 <button 
                    onClick={() => setShowTranscript(true)}
                    className="mt-2 w-full py-3 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-500 text-sm font-medium transition-all group-hover:border-blue-300 group-hover:text-blue-600"
                 >
                    <Eye className="w-4 h-4 mr-2" />
                    View Transcript & Translations
                 </button>
            )}

            {/* Full Transcript Content */}
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showTranscript ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
               <div className="space-y-4">
                   {/* Target Language Main */}
                   <div>
                       <h5 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">{languageConfig?.name || "Target Language"}</h5>
                       <p className="text-xl font-medium text-slate-800 leading-relaxed font-sans">
                         {tutorResponse?.targetText}
                       </p>
                   </div>

                   {/* English Translation */}
                   <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                       <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">English</h5>
                       <p className="text-slate-600 text-base italic">
                         {tutorResponse?.english}
                       </p>
                   </div>

                    {/* Chinese Translation */}
                   <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                       <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Chinese</h5>
                       <p className="text-slate-600 text-base">
                         {tutorResponse?.chinese}
                       </p>
                   </div>
                   
                   <button 
                      onClick={() => setShowTranscript(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 underline w-full text-center pt-2"
                   >
                       Hide Transcript
                   </button>
               </div>
            </div>
           </div>
        </div>
        
        <div className="text-left text-xs text-slate-400 mt-1 ml-1">
           {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;