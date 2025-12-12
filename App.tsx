import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ChatBubble from './components/ChatBubble';
import InputArea from './components/InputArea';
import { Message, Sender, Scenarios, SupportedLanguage, LanguageConfig, User } from './types';
import { chatWithGemini, fetchHistory, LANGUAGE_CONFIGS, resetSession, getApiUrl } from './services/geminiService';
import { BookOpen, Coffee, Plane, Sparkles, AlertCircle, Globe2, ChevronRight, X, Terminal, ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from './services/supabaseClient';

const SCENARIO_OPTIONS = [
  { id: Scenarios.INTRO, icon: Sparkles, label: 'Basics', desc: 'Start from scratch' },
  { id: Scenarios.CAFE, icon: Coffee, label: 'At a Café', desc: 'Order food & drinks' },
  { id: Scenarios.TRAVEL, icon: Plane, label: 'Travel', desc: 'Ask for directions' },
  { id: Scenarios.HOBBIES, icon: BookOpen, label: 'Hobbies', desc: 'Discussing Hobbies' },
];

const ErrorModal = ({ message, debugInfo, onClose }: { message: string; debugInfo?: string; onClose: () => void }) => {
  const isMixedContentError = debugInfo?.includes("Mixed Content") || debugInfo?.includes("was loaded over HTTPS, but requested an insecure resource");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-red-100">
        <div className="bg-red-50 px-6 py-4 flex items-center justify-between border-b border-red-100">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-bold text-red-800">Connection Issue</h3>
          </div>
          <button onClick={onClose} className="text-red-400 hover:text-red-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <p className="text-slate-600 leading-relaxed mb-4 font-medium">{message}</p>

          {isMixedContentError && (
            <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <ShieldAlert className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-orange-800 text-sm mb-1">Security Block Detected (Mixed Content)</h4>
                  <p className="text-sm text-orange-700 mb-2">
                    Your frontend is secure (HTTPS) but your backend is insecure (HTTP).
                  </p>
                  <div className="text-xs bg-white p-2 rounded border border-orange-200 text-slate-600">
                    <strong>Fix:</strong> Deploy backend to Render (Automatic HTTPS) or use Ngrok.
                  </div>
                </div>
              </div>
            </div>
          )}

          {debugInfo && (
            <div className="bg-slate-900 rounded-lg p-4 overflow-hidden">
              <div className="flex items-center space-x-2 text-slate-400 mb-2 border-b border-slate-700 pb-2">
                <Terminal className="w-4 h-4" />
                <span className="text-xs font-mono uppercase tracking-wider">Debug Information</span>
              </div>
              <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all">
                {debugInfo}
              </pre>
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div >
  );
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | null>(null);
  const [currentConfig, setCurrentConfig] = useState<LanguageConfig | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState("Tutor is thinking...");
  const [loadingScenario, setLoadingScenario] = useState<Scenarios | null>(null);
  const [activeScenario, setActiveScenario] = useState<Scenarios | null>(null);
  const [showContinueOption, setShowContinueOption] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- SUPABASE AUTH & HISTORY ---
  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
      } else {
        setUser(null);
        setMessages([]);
        setHasStarted(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchChatHistory = async (userId: string, language: string, scenario: string): Promise<Message[]> => {
    try {
      const data = await fetchHistory(userId, language, scenario);

      if (data && data.length > 0) {
        // Transform DB messages to UI format
        const uiMessages: Message[] = data.map((dbMsg: any) => {
          const content = dbMsg.content;
          let tutorResponse = content.tutorResponse;
          let correction = content.correction;

          // Handle Gemini "parts" format stored in DB (Array of parts)
          if (Array.isArray(content) && content.length > 0 && content[0].text && dbMsg.role === 'model') {
            try {
              // The DB stores the raw text response from Gemini, which is a JSON string
              const parsed = JSON.parse(content[0].text);
              tutorResponse = parsed.response;
              correction = parsed.parse;
            } catch (e) {
              console.error("Failed to parse stored JSON history:", e);
              // Fallback: If it's not JSON, maybe just text?
              tutorResponse = { targetText: content[0].text, english: '', chinese: '' };
            }
          }

          return {
            id: dbMsg.id,
            sender: dbMsg.role === 'user' ? Sender.USER : Sender.TUTOR,
            text: tutorResponse?.targetText || content.text || '', // Display target text or fallback
            timestamp: new Date(dbMsg.created_at).getTime(),
            userAudioUrl: content.userAudioUrl,
            correction: correction,
            tutorResponse: tutorResponse
          };
        });
        setMessages(uiMessages);
        if (uiMessages.length > 0) setHasStarted(true);
        return uiMessages;
      }
      return [];
    } catch (err) {
      console.error("Error fetching history:", err);
      return [];
    }
  };

  const saveMessageToDb = async (role: 'user' | 'model', content: any) => {
    // Legacy function: Backend now handles persistence of model turns.
    // User turns are transient/client-side only.
  };

  // --------------------------------

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    let interval: any;
    if (isTyping && currentConfig) {
      let seconds = 0;
      setLoadingText(`${currentConfig.tutorName} is thinking...`);
      interval = setInterval(() => {
        seconds++;
        if (seconds === 2) setLoadingText("Designing the perfect phrase...");
        if (seconds === 5) setLoadingText(`Connecting to ${currentConfig.name}...`);
        if (seconds === 10) setLoadingText(`Waiting for server response...`);
      }, 1000);
    } else {
      setLoadingText("");
    }
    return () => clearInterval(interval);
  }, [isTyping, currentConfig]);

  const handleLanguageSelect = (lang: SupportedLanguage) => {
    setSelectedLanguage(lang);
    setCurrentConfig(LANGUAGE_CONFIGS[lang]);

    // If not logged in, reset. If logged in, we rely on fetched history or fresh start.
    if (!user) {
      setHasStarted(false);
      setMessages([]);
      resetSession();
    }
    setErrorMsg(null);
    setDebugInfo(null);
  };

  const handleBackToSelection = () => {
    setSelectedLanguage(null);
    setCurrentConfig(null);
    // Only reset UI state, keep fetched messages in memory if needed, 
    // but typically we hide them until lang selected again.
    setHasStarted(false);
    setLoadingScenario(null);
    setActiveScenario(null);
    setShowContinueOption(false);
  };

  const startScenario = async (scenario: Scenarios) => {
    if (!selectedLanguage || !currentConfig) return;

    setLoadingScenario(scenario);
    setActiveScenario(scenario);

    // If visitor, clear messages. If user, we might want to keep history?
    // Usually starting a scenario implies a fresh context or specific prompt.
    // For this implementation, we'll append to history if logged in, or clear if visitor.
    if (!user) {
      setMessages([]);
      resetSession();
    }

    setErrorMsg(null);
    setDebugInfo(null);

    try {
      // Fetch scoped history if user is logged in
      let existingMessages: Message[] = [];
      if (user) {
        existingMessages = await fetchChatHistory(user.id, selectedLanguage, scenario);
      } else {
        setMessages([]);
        resetSession();
      }

      // Check if we should continue existing session or start fresh
      if (existingMessages.length > 0) {
        setShowContinueOption(true);
        setHasStarted(true);
        setLoadingScenario(null);
        return; // STOP HERE! Wait for user to click "Continue"
      }


      // If no history, proceed with Auto Greeting (Fresh Start)

      const historyContext = undefined; // No history for fresh start

      const result = await chatWithGemini('', selectedLanguage, scenario, undefined, undefined, historyContext, user?.id);

      const tutorMsgContent = {
        text: '',
        tutorResponse: result.response,
        correction: result.correction
      };

      const tutorMsg: Message = {
        id: Date.now().toString(),
        sender: Sender.TUTOR,
        timestamp: Date.now(),
        ...tutorMsgContent
      };

      setMessages(prev => [...prev, tutorMsg]);
      // Backend saves model response automatically now.
      setHasStarted(true);
    } catch (error: any) {
      handleError(error);
      setHasStarted(false);
    } finally {
      if (!showContinueOption) { // Only clear loading if we aren't waiting for user
        setLoadingScenario(null);
      }
      setIsTyping(false);
    }
  };

  const handleContinueConversation = async () => {
    if (!currentConfig || !selectedLanguage || !activeScenario) return;

    setShowContinueOption(false);
    setIsTyping(true);

    try {
      // Prepare history for context
      const historyContext = user ? messages.map(m => {
        const parts = [];
        if (m.text) parts.push({ text: m.text });
        return {
          role: m.sender === Sender.USER ? 'user' : 'model',
          parts
        };
      }) : undefined;

      // Trigger AI with empty prompt to continue
      const result = await chatWithGemini('', selectedLanguage, activeScenario, undefined, undefined, historyContext, user?.id);

      const tutorMsgContent = {
        text: '',
        tutorResponse: result.response,
        correction: result.correction
      };

      const tutorMsg: Message = {
        id: Date.now().toString(),
        sender: Sender.TUTOR,
        timestamp: Date.now(),
        ...tutorMsgContent
      };

      setMessages(prev => [...prev, tutorMsg]);

    } catch (error: any) {
      handleError(error);
    } finally {
      setIsTyping(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSendMessage = async (text: string, audioBlob?: Blob) => {
    if (!currentConfig || !selectedLanguage) return;
    setErrorMsg(null);
    setDebugInfo(null);

    const audioUrl = audioBlob ? URL.createObjectURL(audioBlob) : undefined;

    const userMsgContent = {
      text: text,
      userAudioUrl: audioUrl // Note: For DB persistence, you'd need to upload blob to storage
    };

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: Sender.USER,
      timestamp: Date.now(),
      ...userMsgContent
    };

    setMessages(prev => [...prev, userMsg]);
    // Note: Saving local object URL to DB won't work across sessions. 
    // Ideally upload to Supabase Storage first. Skipping storage implementation for brevity.

    setIsTyping(true);

    try {
      let audioBase64: string | undefined = undefined;

      if (audioBlob) {
        audioBase64 = await blobToBase64(audioBlob);
      }

      // Prepare History Context for Gemini (if logged in)
      const historyContext = user ? messages.map(m => {
        const parts = [];
        if (m.text) parts.push({ text: m.text });
        // Note: We don't send past audio blobs back to Gemini context to save bandwidth, just text history
        return {
          role: m.sender === Sender.USER ? 'user' : 'model',
          parts
        };
      }) : undefined;

      const mimeType = audioBlob?.type;
      const result = await chatWithGemini(text, selectedLanguage, undefined, audioBase64, mimeType, historyContext, user?.id);

      const tutorMsgContent = {
        text: '',
        tutorResponse: result.response,
        correction: result.correction
      };

      const tutorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: Sender.TUTOR,
        timestamp: Date.now(),
        ...tutorMsgContent
      };
      setMessages(prev => [...prev, tutorMsg]);
      saveMessageToDb('model', tutorMsgContent);

    } catch (error: any) {
      handleError(error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleError = (error: any) => {
    console.error("Chat Error", error);
    let userFriendlyMsg = `Couldn't connect to ${currentConfig?.tutorName}.`;
    let isMixedContent = false;

    if (error.message.includes("Request timed out")) {
      userFriendlyMsg = "The server took too long to respond. It might be waking up.";
    } else if (error.message.includes("Failed to fetch")) {
      userFriendlyMsg = "Unable to reach the server. Please check connection.";
      if (window.location.protocol === 'https:' && getApiUrl('').startsWith('http:')) {
        isMixedContent = true;
      }
    }

    const configuredUrl = getApiUrl('');
    const displayUrl = configuredUrl || "Not set (using relative /api)";

    let debugDetails = `Configured Backend URL:\n${displayUrl}\n\nRaw Error:\n${error.message}`;
    if (isMixedContent) {
      debugDetails += "\n\nPossible Cause: Mixed Content (HTTPS frontend accessing HTTP backend).";
    }

    setDebugInfo(debugDetails);
    setErrorMsg(userFriendlyMsg);
  };

  const handleReset = () => {
    if (user) {
      // Option: Clear history in DB? Or just start new context?
      // For now, just clearing UI.
    }
    setHasStarted(false);
    setMessages([]);
    setErrorMsg(null);
    setDebugInfo(null);
    setLoadingScenario(null);
    resetSession();
  };

  // --- RENDER: LANGUAGE SELECTION SCREEN ---
  if (!selectedLanguage || !currentConfig) {
    return (
      <div className="flex flex-col h-[100dvh] bg-slate-50 font-sans relative">
        <Header
          onReset={() => { }}
          user={user}
        />
        <main className="flex-1 overflow-y-auto p-4 pt-24 scroll-smooth">
          <div className="max-w-4xl w-full mx-auto animate-fade-in min-h-full flex flex-col pb-8">
            <div className="text-center mb-12 mt-4 md:mt-8">
              <div className="inline-flex items-center justify-center p-4 bg-white rounded-full shadow-xl mb-6">
                <Globe2 className="w-12 h-12 text-blue-600" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">Choose Your Language</h2>
              <p className="text-lg text-slate-500 max-w-xl mx-auto">
                Select a language to start your immersive learning journey with an AI friend.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
              {(Object.values(LANGUAGE_CONFIGS) as LanguageConfig[]).map((config) => (
                <button
                  key={config.id}
                  onClick={() => handleLanguageSelect(config.id)}
                  className="group bg-white hover:bg-blue-600 hover:text-white border border-slate-200 rounded-2xl p-6 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 flex flex-col items-center text-center"
                >
                  <div className="text-6xl mb-4 transition-transform group-hover:scale-110">
                    {config.flag}
                  </div>
                  <h3 className="text-xl font-bold mb-1">{config.name}</h3>
                  <p className="text-sm text-slate-400 group-hover:text-blue-200 font-medium mb-4">
                    Tutor: {config.tutorName}
                  </p>
                  <div className="mt-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center text-sm font-semibold bg-white/20 py-1 px-3 rounded-full">
                    Start Learning <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </main>
        {errorMsg && (
          <ErrorModal
            message={errorMsg}
            debugInfo={debugInfo || undefined}
            onClose={() => setErrorMsg(null)}
          />
        )}
      </div>
    );
  }

  // --- RENDER: CHAT INTERFACE ---
  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 font-sans relative">
      <Header
        onReset={handleReset}
        onBack={handleBackToSelection}
        config={currentConfig}
        user={user}
      />

      <main className="flex-1 overflow-y-auto p-3 sm:p-4 pt-24 scroll-smooth">
        <div className="max-w-3xl mx-auto min-h-full flex flex-col">

          {!hasStarted && messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-8 py-12 animate-fade-in">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 bg-white rounded-full mx-auto flex items-center justify-center shadow-xl border-4 border-blue-50 mb-6">
                  <span className="text-6xl">{currentConfig.flag}</span>
                </div>
                <h2 className="text-3xl font-bold text-slate-800">Bienvenue!</h2>
                <p className="text-slate-500 max-w-md mx-auto">
                  I am {currentConfig.tutorName}. Choose a scenario to start our conversation in {currentConfig.name}.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-4">
                {SCENARIO_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => startScenario(option.id)}
                    disabled={loadingScenario !== null}
                    className={`flex items-center p-4 bg-white border rounded-xl transition-all group text-left relative overflow-hidden ${loadingScenario === option.id
                      ? 'border-blue-400 ring-2 ring-blue-100 shadow-md'
                      : 'border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer'
                      } ${loadingScenario !== null && loadingScenario !== option.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 transition-colors ${loadingScenario === option.id
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                      }`}>
                      {loadingScenario === option.id ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <option.icon className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{option.label}</h3>
                      <p className="text-xs text-slate-500">
                        {loadingScenario === option.id ? "Connecting..." : option.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="pb-4">
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                languageConfig={currentConfig}
              />
            ))}

            {isTyping && (
              <div className="flex justify-start mb-6 animate-fade-in px-1">
                <div className="flex items-end space-x-2 max-w-[85%]">
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center mb-1 shadow-sm">
                    <span className="text-xs font-bold text-slate-500">{currentConfig.tutorName.charAt(0)}</span>
                  </div>
                  <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-bl-none shadow-md flex items-center space-x-2">
                    <div className="flex space-x-1 h-3 items-center">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-0"></div>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-150"></div>
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-300"></div>
                    </div>
                    <span className="text-xs text-slate-400 font-medium animate-pulse">{loadingText}</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {showContinueOption && (
            <div className="flex justify-center mb-6 animate-fade-in">
              <button
                onClick={handleContinueConversation}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-bold shadow-lg transition-transform transform hover:scale-105 active:scale-95"
              >
                <Sparkles className="w-5 h-5" />
                <span>Continue Conversation</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Show Input Area only if started and NOT waiting for continue decision (unless we want to allow typing too?) 
          Usually "Continue" implies letting the AI speak first. 
          But user might want to interrupt. 
          For now, let's keep input area visible but maybe highlight the button.
          Actually, if we pause, we can just leave InputArea visible. 
      */}
      {(hasStarted || messages.length > 0) && (
        <InputArea
          onSend={handleSendMessage}
          disabled={isTyping}
          tutorName={currentConfig.tutorName}
          languageCode={currentConfig.speechCode}
        />
      )}

      {errorMsg && (
        <ErrorModal
          message={errorMsg}
          debugInfo={debugInfo || undefined}
          onClose={() => setErrorMsg(null)}
        />
      )}
    </div>
  );
}

export default App;