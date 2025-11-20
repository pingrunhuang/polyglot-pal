import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ChatBubble from './components/ChatBubble';
import InputArea from './components/InputArea';
import { Message, Sender, Scenarios, SupportedLanguage, LanguageConfig } from './types';
import { initChat, sendMessageToGemini, LANGUAGE_CONFIGS } from './services/geminiService';
import { BookOpen, Coffee, Plane, Sparkles, AlertCircle, Globe2, ChevronRight } from 'lucide-react';

const SCENARIO_OPTIONS = [
  { id: Scenarios.INTRO, icon: Sparkles, label: 'Basics', desc: 'Start from scratch' },
  { id: Scenarios.CAFE, icon: Coffee, label: 'At a Café', desc: 'Order food & drinks' },
  { id: Scenarios.TRAVEL, icon: Plane, label: 'Travel', desc: 'Ask for directions' },
  { id: Scenarios.HOBBIES, icon: BookOpen, label: 'Hobbies', desc: 'Talk about interests' },
];

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
  }, [messages, isTyping, errorMsg]);

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
        if (seconds === 8) setLoadingText(`Still trying to reach ${currentConfig.tutorName}...`);
        if (seconds === 12) setLoadingText("Just a moment longer...");
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
      const prompt = initChat(scenario, selectedLanguage);
      const result = await sendMessageToGemini(prompt);
      
      const tutorMsg: Message = {
        id: Date.now().toString(),
        sender: Sender.TUTOR,
        text: '', 
        tutorResponse: result.response,
        correction: result.correction, 
        timestamp: Date.now()
      };
      setMessages([tutorMsg]);
    } catch (error) {
      console.error("Failed to start chat", error);
      setErrorMsg(`Couldn't connect to ${currentConfig.tutorName}. Please check your connection.`);
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
    } catch (error) {
      console.error("Error sending message", error);
      setErrorMsg(`${currentConfig.tutorName} is having trouble responding right now.`);
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
      <div className="flex flex-col h-screen bg-slate-50 font-sans">
        <Header onReset={() => {}} />
        <main className="flex-1 overflow-y-auto flex items-center justify-center p-4">
           <div className="max-w-4xl w-full animate-fade-in">
              <div className="text-center mb-12">
                 <div className="inline-flex items-center justify-center p-4 bg-white rounded-full shadow-xl mb-6">
                    <Globe2 className="w-12 h-12 text-blue-600" />
                 </div>
                 <h2 className="text-4xl font-bold text-slate-800 mb-4">Choose Your Language</h2>
                 <p className="text-lg text-slate-500 max-w-xl mx-auto">
                   Select a language to start your immersive learning journey with an AI friend.
                 </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
      </div>
    );
  }

  // --- RENDER: CHAT APPLICATION ---
  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      <Header 
        onReset={handleReset} 
        onBack={handleBackToSelection} 
        config={currentConfig} 
      />

      <main className="flex-1 overflow-y-auto relative">
        {!hasStarted ? (
          <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-full animate-fade-in">
             <div className="w-24 h-24 bg-white rounded-full shadow-xl mb-8 flex items-center justify-center border-4 border-blue-50 text-6xl">
                {currentConfig.flag}
             </div>
             <h2 className="text-3xl font-bold text-slate-800 mb-3 text-center">{currentConfig.greeting}</h2>
             <p className="text-slate-500 text-center mb-10 max-w-md text-lg">
               Choose a scenario to start practicing your {currentConfig.name} with {currentConfig.tutorName}.
             </p>
             
             {errorMsg && (
               <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center">
                 <AlertCircle className="w-5 h-5 mr-2" />
                 {errorMsg}
               </div>
             )}

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                {SCENARIO_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => startScenario(opt.id)}
                    className="flex items-center p-6 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-2xl transition-all shadow-sm hover:shadow-md group text-left"
                  >
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mr-5 group-hover:scale-110 transition-transform">
                      <opt.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">{opt.label}</h3>
                      <p className="text-slate-500 text-sm">{opt.desc}</p>
                    </div>
                  </button>
                ))}
             </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-8">
            {messages.map((msg) => (
              <ChatBubble 
                key={msg.id} 
                message={msg} 
                languageConfig={currentConfig}
              />
            ))}
            
            {isTyping && (
               <ChatBubble 
                 message={{
                   id: 'loading',
                   sender: Sender.TUTOR,
                   text: loadingText,
                   timestamp: Date.now(),
                   isLoading: true
                 }}
                 languageConfig={currentConfig}
               />
            )}

            {errorMsg && (
              <div className="flex justify-center mt-4 mb-4">
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm flex items-center shadow-sm">
                   <AlertCircle className="w-4 h-4 mr-2" />
                   {errorMsg}
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {hasStarted && (
        <InputArea 
          onSend={handleSendMessage} 
          disabled={isTyping} 
          tutorName={currentConfig.tutorName}
          languageCode={currentConfig.speechCode}
        />
      )}
    </div>
  );
}

export default App;