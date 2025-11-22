import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Square, AudioLines } from 'lucide-react';

interface InputAreaProps {
  onSend: (text: string, audioUrl?: string) => void;
  disabled: boolean;
  tutorName?: string;
  languageCode?: string; // e.g. 'fr-FR'
}

const InputArea: React.FC<InputAreaProps> = ({ onSend, disabled, tutorName = "Tutor", languageCode = "en-US" }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Refs for handling recording state without re-renders interrupting logic
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptRef = useRef('');

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      transcriptRef.current = '';
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

  const startRecording = async () => {
    try {
      // 1. Start Audio Capture (MediaRecorder)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();

      // 2. Start Transcription (SpeechRecognition)
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = languageCode;
        recognition.continuous = true; // Keep listening until we manually stop
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          // Update UI for feedback
          const currentText = finalTranscript || interimTranscript;
          if (currentText) {
            setText(currentText);
            transcriptRef.current = currentText; // Store in ref for access during stop
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }

      setIsRecording(true);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecordingAndSend = () => {
    if (!mediaRecorderRef.current) return;

    setIsRecording(false);

    // Stop Speech Recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Stop Media Recorder
    mediaRecorderRef.current.onstop = () => {
      // Create Audio Blob URL
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const finalTranscript = transcriptRef.current;

      // Stop all tracks to release mic
      mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());

      // AUTO SEND
      if (finalTranscript.trim()) {
        onSend(finalTranscript.trim(), audioUrl);
        setText('');
        transcriptRef.current = '';
      } else {
        // If no text was captured but audio was, we technically could send audio, 
        // but our backend expects text for logic. For now, we skip.
        // Fallback: If no transcript but we have audio, maybe prompt user? 
        // Keeping it simple: No transcript = no send.
        console.warn("No speech detected.");
      }
    };

    mediaRecorderRef.current.stop();
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecordingAndSend();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [text]);

  return (
    <div className="bg-white border-t border-slate-200 p-3 pb-5 sm:p-4 sm:pb-6">
      <div className="max-w-3xl mx-auto relative">

        {isRecording && (
          <div className="absolute -top-10 left-0 right-0 flex justify-center">
            <div className="bg-red-50 text-red-600 px-4 py-1 rounded-full text-xs font-bold flex items-center shadow-sm animate-pulse border border-red-100">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
              Recording... Tap to Send
            </div>
          </div>
        )}

        <div className={`flex items-end space-x-2 bg-slate-50 border rounded-2xl p-2 transition-all shadow-sm ${isRecording ? 'border-red-300 ring-1 ring-red-100 bg-red-50/30' : 'border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500'}`}>

          <button
            onClick={toggleRecording}
            disabled={disabled}
            className={`p-3 rounded-xl transition-all flex-shrink-0 ${isRecording
                ? 'bg-red-500 text-white shadow-md hover:bg-red-600 transform scale-105'
                : 'text-slate-400 hover:bg-white hover:text-blue-600'
              }`}
            title={isRecording ? "Stop & Send" : "Record Voice Message"}
          >
            {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
          </button>

          <div className="flex-1 relative">
            {isRecording && !text && (
              <div className="absolute inset-0 flex items-center text-slate-400 px-1 pointer-events-none">
                <AudioLines className="w-4 h-4 mr-2 animate-pulse" />
                <span className="text-sm">Listening...</span>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled || isRecording}
              placeholder={disabled ? `${tutorName} is thinking...` : isRecording ? "" : "Type a message..."}
              className={`w-full bg-transparent border-0 focus:ring-0 resize-none py-3 text-slate-800 placeholder:text-slate-400 max-h-32 disabled:opacity-50 ${isRecording ? 'text-slate-500' : ''}`}
              rows={1}
            />
          </div>

          {!isRecording && (
            <button
              onClick={handleSend}
              disabled={!text.trim() || disabled}
              className={`p-3 rounded-xl transition-all flex-shrink-0 ${text.trim() && !disabled
                  ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700 transform hover:-translate-y-0.5'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InputArea;