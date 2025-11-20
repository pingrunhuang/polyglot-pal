import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';

interface InputAreaProps {
  onSend: (text: string) => void;
  disabled: boolean;
  tutorName?: string;
  languageCode?: string; // e.g. 'fr-FR'
}

const InputArea: React.FC<InputAreaProps> = ({ onSend, disabled, tutorName = "Tutor", languageCode = "en-US" }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = languageCode; 
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setText((prev) => (prev ? prev + ' ' + transcript : transcript));
        };
        
        recognitionRef.current = recognition;
        recognition.start();
      } else {
        alert("Speech recognition not supported in this browser.");
      }
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [text]);

  return (
    <div className="bg-white border-t border-slate-200 p-4 pb-6">
      <div className="max-w-3xl mx-auto relative">
        <div className="flex items-end space-x-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all shadow-sm">
          
          <button
            onClick={toggleListening}
            disabled={disabled}
            className={`p-3 rounded-xl transition-colors flex-shrink-0 ${
              isListening 
                ? 'bg-red-100 text-red-600 animate-pulse' 
                : 'text-slate-400 hover:bg-white hover:text-blue-600'
            }`}
            title="Speak"
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={disabled ? `${tutorName} is thinking...` : "Type..."}
            className="w-full bg-transparent border-0 focus:ring-0 resize-none py-3 text-slate-800 placeholder:text-slate-400 max-h-32 disabled:opacity-50"
            rows={1}
          />

          <button
            onClick={handleSend}
            disabled={!text.trim() || disabled}
            className={`p-3 rounded-xl transition-all flex-shrink-0 ${
              text.trim() && !disabled
                ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 transform hover:-translate-y-0.5'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="text-center mt-2">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">
                Practice makes perfect
            </p>
        </div>
      </div>
    </div>
  );
};

export default InputArea;