import React from 'react';
import { Languages, RefreshCcw, ArrowLeft } from 'lucide-react';
import { LanguageConfig } from '../types';

interface HeaderProps {
  onReset: () => void;
  onBack?: () => void;
  config?: LanguageConfig;
}

const Header: React.FC<HeaderProps> = ({ onReset, onBack, config }) => {
  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 fixed top-0 left-0 right-0 z-40 h-16 transition-all duration-300">
      <div className="max-w-3xl mx-auto px-4 h-full flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 -ml-2 mr-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          
          {config ? (
            <div className="bg-blue-50 p-2 rounded-lg text-xl shadow-sm border border-blue-100">
              {config.flag}
            </div>
          ) : (
             <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-600/20">
               <Languages className="w-6 h-6" />
             </div>
          )}

          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight flex items-center leading-tight">
              {config ? `Ami ${config.name}` : 'Polyglot Pal'}
              <span className="ml-2 text-[10px] uppercase tracking-wider bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full hidden sm:inline-block font-bold">AI Tutor</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {config ? `Learn ${config.name} naturally` : 'Choose your language'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          {config && (
            <button 
              onClick={onReset}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              title="Restart Conversation"
            >
              <RefreshCcw className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;