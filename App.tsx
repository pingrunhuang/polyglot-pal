import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ChatBubble from './components/ChatBubble';
import InputArea from './components/InputArea';
import { Message, Sender, Scenarios, SupportedLanguage, LanguageConfig } from './types';
import { chatWithGemini, LANGUAGE_CONFIGS, resetSession, getApiUrl } from './services/geminiService';
import { BookOpen, Coffee, Plane, Sparkles, AlertCircle, Globe2, ChevronRight, X, Terminal, ShieldAlert, Loader2 } from 'lucide-react';

const SCENARIO_OPTIONS = [
  { id: Scenarios.INTRO, icon: Sparkles, label: 'Basics', desc: 'Start from scratch' },
  { id: Scenarios.CAFE, icon: Coffee, label: 'At a Café', desc: 'Order food & drinks' },
  { id: Scenarios.TRAVEL, icon: Plane, label: 'Travel', desc: 'Ask for directions' },
  { id: Scenarios.HOBBIES, icon: BookOpen, label: 'Hobbies', desc: 'Discussing Hobbies' },
];

// Simple Error Modal Component
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
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | null>(null);
  const [currentConfig, setCurrentConfig] = useState<LanguageConfig | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState("Tutor is thinking...");
  const [loadingScenario, setLoadingScenario] = useState<Scenarios | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    setHasStarted(false);
    setMessages([]);
    setErrorMsg(null);
    setDebugInfo(null);
    resetSession(); // New session ID for new language
  };

  const handleBackToSelection = () => {
    setSelectedLanguage(null);
    setCurrentConfig(null);
    setHasStarted(false);
    setMessages([]);
    setLoadingScenario(null);
  };

  const startScenario = async (scenario: Scenarios) => {
    if (!selectedLanguage || !currentConfig) return;

    setLoadingScenario(scenario);
    setMessages([]);
    setErrorMsg(null);
    setDebugInfo(null);
    resetSession(); // New session ID for new scenario

    try {
      const result = await chatWithGemini('', selectedLanguage, scenario);

      const tutorMsg: Message = {
        id: Date.now().toString(),
        sender: Sender.TUTOR,
        text: '',
        tutorResponse: result.response,
        correction: result.correction,
        timestamp: Date.now()
      };
      setMessages([tutorMsg]);
      setHasStarted(true);
    } catch (error: any) {
      handleError(error);
      setHasStarted(false);
    } finally {
      setLoadingScenario(null);
      setIsTyping(false);
    }
  };

  // Convert Blob to Base64 Helper
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
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

    // Create Audio URL for local playback if recording exists
    const audioUrl = audioBlob ? URL.createObjectURL(audioBlob) : undefined;

    // 1. Add User Message to UI
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: Sender.USER,
      text: text, // Might be empty if audio only
      timestamp: Date.now(),
      userAudioUrl: audioUrl
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      let audioBase64: string | undefined = undefined;

      if (audioBlob) {
        audioBase64 = await blobToBase64(audioBlob);
      }

      // 2. Call Stateful Backend
      // Pass audioBlob.type if available
      const mimeType = audioBlob?.type;
      const result = await chatWithGemini(text, selectedLanguage, undefined, audioBase64, mimeType);

      const tutorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: Sender.TUTOR,
        text: '',
        tutorResponse: result.response,
        correction: result.correction,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, tutorMsg]);
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
    setHasStarted(false);
    setMessages([]);
    setErrorMsg(null);
    setDebugInfo(null);
    setLoadingScenario(null);
  };

  // --- RENDER: LANGUAGE SELECTION SCREEN ---
  if (!selectedLanguage || !currentConfig) {
    return (
      <div className="flex flex-col h-[100dvh] bg-slate-50 font-sans relative">
        <Header
          onReset={() => { }}
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
      />

      {/* PT-24 ensures content starts below the fixed header */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 pt-24 scroll-smooth">
        <div className="max-w-3xl mx-auto min-h-full flex flex-col">

          {!hasStarted && (
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

          {hasStarted && (
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
          )}
        </div>
      </main>

      {hasStarted && (
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