import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ChatBubble from './components/ChatBubble';
import InputArea from './components/InputArea';
import { Message, Sender, Scenarios, SupportedLanguage, LanguageConfig } from './types';
import { chatWithGemini, LANGUAGE_CONFIGS, resetSession, getApiUrl } from './services/geminiService';
import { BookOpen, Coffee, Plane, Sparkles, AlertCircle, Globe2, ChevronRight, X, Terminal, ShieldAlert, Save, RotateCcw } from 'lucide-react';

const SCENARIO_OPTIONS = [
  { id: Scenarios.INTRO, icon: Sparkles, label: 'Basics', desc: 'Start from scratch' },
  { id: Scenarios.CAFE, icon: Coffee, label: 'At a Café', desc: 'Order food & drinks' },
  { id: Scenarios.TRAVEL, icon: Plane, label: 'Travel', desc: 'Ask for directions' },
  { id: Scenarios.HOBBIES, icon: BookOpen, label: 'Hobbies', desc: 'Discussing Hobbies' },
];

// Settings Modal Component
const SettingsModal = ({ onClose }: { onClose: () => void }) => {
  const [apiUrl, setApiUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('custom_api_url');
    if (stored) setApiUrl(stored);
  }, []);

  const handleSave = () => {
    if (apiUrl.trim()) {
      localStorage.setItem('custom_api_url', apiUrl.trim());
    } else {
      localStorage.removeItem('custom_api_url');
    }
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
      window.location.reload(); // Reload to apply changes
    }, 800);
  };

  const handleReset = () => {
    localStorage.removeItem('custom_api_url');
    setApiUrl('');
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
      window.location.reload();
    }, 800);
  };

  const currentEffectiveUrl = getApiUrl('');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Settings</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Backend API URL</label>
            <p className="text-xs text-slate-500 mb-3">
              If automatic configuration fails, paste your Render URL here (e.g., <code>https://your-app.onrender.com</code>).
            </p>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div className="bg-slate-100 rounded p-3 mb-4 text-xs text-slate-500 break-all">
            <strong>Current Active URL:</strong><br />
            {currentEffectiveUrl || "Relative (Proxy)"}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleSave}
              className={`flex-1 py-2 px-4 rounded-lg font-medium flex items-center justify-center transition-all ${saved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              {saved ? 'Saved!' : <><Save className="w-4 h-4 mr-2" /> Save & Reload</>}
            </button>
            <button
              onClick={handleReset}
              className="py-2 px-4 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg font-medium flex items-center"
              title="Reset to Default"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple Error Modal Component
const ErrorModal = ({ message, debugInfo, onClose, onOpenSettings }: { message: string; debugInfo?: string; onClose: () => void; onOpenSettings: () => void }) => {
  const isMixedContentError = debugInfo?.includes("Mixed Content") || debugInfo?.includes("was loaded over HTTPS, but requested an insecure resource");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
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
        <div className="px-6 py-4 bg-slate-50 flex justify-between">
          <button
            onClick={() => { onClose(); onOpenSettings(); }}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Configure Settings
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
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
  const [showSettings, setShowSettings] = useState(false);

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
  };

  const startScenario = async (scenario: Scenarios) => {
    if (!selectedLanguage || !currentConfig) return;

    setHasStarted(true);
    setMessages([]);
    setErrorMsg(null);
    setDebugInfo(null);
    setIsTyping(true);
    resetSession(); // New session ID for new scenario

    try {
      // Pass empty message + scenario to trigger start
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
    } catch (error: any) {
      handleError(error);
      setHasStarted(false);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!currentConfig || !selectedLanguage) return;
    setErrorMsg(null);
    setDebugInfo(null);

    // 1. Add User Message to UI
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: Sender.USER,
      text: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      // 2. Call Stateful Backend (Just send text)
      const result = await chatWithGemini(text, selectedLanguage);

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
  };

  // --- RENDER: LANGUAGE SELECTION SCREEN ---
  if (!selectedLanguage || !currentConfig) {
    return (
      <div className="flex flex-col h-[100dvh] bg-slate-50 font-sans relative">
        <Header
          onReset={() => { }}
          onSettings={() => setShowSettings(true)}
        />
        <main className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl w-full mx-auto animate-fade-in min-h-full flex flex-col pb-8">
            <div className="text-center mb-12 mt-8 md:mt-16">
              <div className="inline-flex items-center justify-center p-4 bg-white rounded-full shadow-xl mb-6">
                <Globe2 className="w-12 h-12 text-blue-600" />
              </div>
              <h2 className="text-4xl font-bold text-slate-800 mb-4">Choose Your Language</h2>
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
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        {errorMsg && (
          <ErrorModal
            message={errorMsg}
            debugInfo={debugInfo || undefined}
            onClose={() => setErrorMsg(null)}
            onOpenSettings={() => { setErrorMsg(null); setShowSettings(true); }}
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
        onSettings={() => setShowSettings(true)}
        config={currentConfig}
      />

      {/* Reduced padding from p-4 to p-3 sm:p-4 for better mobile width */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 scroll-smooth">
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
                    className="flex items-center p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all group text-left"
                  >
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mr-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <option.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{option.label}</h3>
                      <p className="text-xs text-slate-500">{option.desc}</p>
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
                <div className="flex justify-start mb-6 animate-fade-in">
                  <div className="flex items-end space-x-2 max-w-[85%]">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center mb-1">
                      <span className="text-xs font-bold text-slate-500">{currentConfig.tutorName.charAt(0)}</span>
                    </div>
                    <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center space-x-2">
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

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {errorMsg && (
        <ErrorModal
          message={errorMsg}
          debugInfo={debugInfo || undefined}
          onClose={() => setErrorMsg(null)}
          onOpenSettings={() => { setErrorMsg(null); setShowSettings(true); }}
        />
      )}
    </div>
  );
}

export default App;