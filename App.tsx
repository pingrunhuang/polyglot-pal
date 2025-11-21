import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ChatBubble from './components/ChatBubble';
import InputArea from './components/InputArea';
import { Message, Sender, Scenarios, SupportedLanguage, LanguageConfig } from './types';
import { initChat, sendMessageToGemini, LANGUAGE_CONFIGS } from './services/geminiService';
import { BookOpen, Coffee, Plane, Sparkles, AlertCircle, Globe2, ChevronRight, X } from 'lucide-react';

const SCENARIO_OPTIONS = [
  { id: Scenarios.INTRO, icon: Sparkles, label: 'Basics', desc: 'Start from scratch' },
  { id: Scenarios.CAFE, icon: Coffee, label: 'At a Café', desc: 'Order food & drinks' },
  { id: Scenarios.TRAVEL, icon: Plane, label: 'Travel', desc: 'Ask for directions' },
  { id: Scenarios.HOBBIES, icon: BookOpen, label: 'Hobbies', desc: 'Talk about interests' },
];

// Simple Error Modal Component
const ErrorModal = ({ message, onClose }: { message: string; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-red-100">
      <div className="bg-red-50 px-6 py-4 flex items-center justify-between border-b border-red-100">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-bold text-red-800">Connection Issue</h3>
        </div>
        <button onClick={onClose} className="text-red-400 hover:text-red-700 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6">
        <p className="text-slate-600 leading-relaxed">{message}</p>
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
  </div>
);

function App() {
  // State for Language Selection
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | null>(null);
  const [currentConfig, setCurrentConfig] = useState<LanguageConfig | null>(null);

  // State for Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState("Tutor is thinking...");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Dynamic loading text effect
  useEffect(() => {
    let interval: any;
    if (isTyping && currentConfig) {
      let seconds = 0;
      setLoadingText(`${currentConfig.tutorName} is thinking...`);
      interval = setInterval(() => {
        seconds++;
        if (seconds === 2) setLoadingText("Designing the perfect phrase...");
        if (seconds === 5) setLoadingText(`Connecting to ${currentConfig.name === 'Japanese' ? 'Tokyo' : currentConfig.name === 'French' ? 'Paris' : 'the tutor'}...`);
        if (seconds === 10) setLoadingText(`Still trying to reach ${currentConfig.tutorName}...`);
        if (seconds === 15) setLoadingText("The connection is taking a while...");
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
    setIsTyping(true);
    
    try {
      // initChat now calls the backend which returns the initial message
      const result = await initChat(scenario, selectedLanguage);
      
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
      console.error("Failed to start chat", error);
      let userFriendlyMsg = `Couldn't connect to ${currentConfig.tutorName}.`;
      
      if (error.message.includes("Request timed out")) {
        userFriendlyMsg = "The server took too long to respond. Please check if the backend is running and accessible.";
      } else if (error.message.includes("Failed to fetch")) {
        userFriendlyMsg = "Unable to reach the server. Please check your network connection and VITE_API_URL configuration.";
      }

      setErrorMsg(userFriendlyMsg);
      setHasStarted(false);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!currentConfig) return;
    setErrorMsg(null);
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: Sender.USER,
      text: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const result = await sendMessageToGemini(text);
      
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
      console.error("Error sending message", error);
      let userFriendlyMsg = `${currentConfig.tutorName} is having trouble responding right now.`;
      
      if (error.message.includes("Request timed out")) {
         userFriendlyMsg = "Response timed out. The server might be overwhelmed.";
      }

      setErrorMsg(userFriendlyMsg);
    } finally {
      setIsTyping(false);
    }
  };

  const handleReset = () => {
    setHasStarted(false);
    setMessages([]);
    setErrorMsg(null);
  };

  // --- RENDER: LANGUAGE SELECTION SCREEN ---
  if (!selectedLanguage || !currentConfig) {
    return (
      <div className="flex flex-col h-[100dvh] bg-slate-50 font-sans relative">
        <Header onReset={() => {}} />
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
        {errorMsg && <ErrorModal message={errorMsg} onClose={() => setErrorMsg(null)} />}
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

      <main className="flex-1 overflow-y-auto p-4 scroll-smooth">
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
               <div className="text-center py-4">
                  <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                    Scenario: {SCENARIO_OPTIONS.find(s => messages.length > 0)?.label || "Conversation"}
                  </span>
               </div>
               
               {messages.map((msg) => (
                 <ChatBubble 
                    key={msg.id} 
                    message={msg} 
                    languageConfig={currentConfig}
                 />
               ))}

               {isTyping && (
                 <div className="flex justify-start mb-6 animate-fade-in">
                   <div className="flex flex-col max-w-[85%]">
                     <div className="flex items-center space-x-2 mb-1">
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center border border-red-200">
                           <span className="font-handwriting font-bold text-red-600 text-xl">{currentConfig.tutorName.charAt(0)}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-600">{currentConfig.tutorName}</span>
                     </div>
                     <div className="bg-white border border-slate-200 px-6 py-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center space-x-3">
                        <div className="flex space-x-1 h-4 items-center">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-0"></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-150"></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-300"></div>
                        </div>
                        <span className="text-sm text-slate-400 font-medium animate-pulse">{loadingText}</span>
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
      
      {errorMsg && <ErrorModal message={errorMsg} onClose={() => setErrorMsg(null)} />}
    </div>
  );
}

export default App;