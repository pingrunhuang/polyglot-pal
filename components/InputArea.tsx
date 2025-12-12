import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, AudioLines } from 'lucide-react';

interface InputAreaProps {
  onSend: (text: string, audioBlob?: Blob) => void;
  disabled: boolean;
  tutorName?: string;
  languageCode?: string; // Kept for consistency, though native MediaRecorder auto-detects
}

const InputArea: React.FC<InputAreaProps> = ({ onSend, disabled, tutorName = "Tutor" }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Refs for handling recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isHoldingRef = useRef(false);
  const mimeTypeRef = useRef<string>('audio/webm');
  const startTimeRef = useRef<number>(0);

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

  const startRecording = async (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    if (isHoldingRef.current) return;

    e.preventDefault(); // Prevent text selection/context menu on mobile

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Check supported MIME types for Safari compatibility
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
          if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          } else if (MediaRecorder.isTypeSupported('audio/aac')) {
            mimeType = 'audio/aac';
          }
        }
      }
      mimeTypeRef.current = mimeType;

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      startTimeRef.current = Date.now();
      isHoldingRef.current = true;
      setIsRecording(true);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecordingAndSend = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const duration = Date.now() - startTimeRef.current;

      // Duration check: less than 1 second
      if (duration < 1000) {
        mediaRecorderRef.current.onstop = null; // Prevent sending
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current = null;
        setIsRecording(false);
        audioChunksRef.current = [];
        // Audio discarded, do nothing.
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });

        // Stop all tracks to release mic
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current = null;

        setIsRecording(false);

        // Send Audio Blob directly. No text needed.
        // We pass an empty string for text, and the blob as the second argument.
        onSend("", audioBlob);
      };
      mediaRecorderRef.current.stop();
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



        <div className={`flex items-end space-x-2 bg-slate-50 border rounded-2xl p-2 transition-all shadow-sm ${isRecording ? 'border-red-300 ring-1 ring-red-100 bg-red-50/30' : 'border-slate-200 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500'}`}>

          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecordingAndSend}
            onMouseLeave={stopRecordingAndSend}
            onTouchStart={startRecording}
            onTouchEnd={stopRecordingAndSend}
            disabled={disabled}
            className={`p-3 rounded-xl transition-all flex-shrink-0 select-none touch-none ${isRecording
              ? 'bg-red-500 text-white shadow-md scale-110 ring-4 ring-red-200'
              : 'text-slate-400 hover:bg-white hover:text-blue-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
            title="Hold to Record, Release to Send"
          >
            <Mic className={`w-5 h-5 ${isRecording ? 'animate-pulse' : ''}`} />
          </button>

          <div className="flex-1 relative">
            {isRecording && (
              <div className="absolute inset-0 flex items-center text-red-500 px-1 pointer-events-none bg-red-50/30 font-medium animate-pulse">
                <AudioLines className="w-5 h-5 mr-2" />
                <span className="text-sm">Recording... Release to Send</span>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled || isRecording}
              placeholder={disabled ? `${tutorName} is thinking...` : isRecording ? "" : "Type a message..."}
              className={`w-full bg-transparent border-0 focus:ring-0 resize-none py-3 text-slate-800 placeholder:text-slate-400 max-h-32 disabled:opacity-50 ${isRecording ? 'opacity-0' : ''}`}
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