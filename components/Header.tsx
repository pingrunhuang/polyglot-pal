import React, { useState } from 'react';
import { Languages, RefreshCcw, ArrowLeft, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { LanguageConfig, User } from '../types';
import AuthModal from './AuthModal';
import { supabase } from '../services/supabaseClient';

interface HeaderProps {
  onReset: () => void;
  onBack?: () => void;
  config?: LanguageConfig;
  user: User | null;
}

const Header: React.FC<HeaderProps> = ({ onReset, onBack, config, user }) => {
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    // Force reload to clear state effectively or let App.tsx handle it
    window.location.reload();
  };

  return (
    <>
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
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                {config ? `Learn ${config.name} naturally` : 'Choose your language'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {config && (
              <button
                onClick={onReset}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                title="Restart Conversation"
              >
                <RefreshCcw className="w-5 h-5" />
              </button>
            )}

            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold hover:bg-slate-200 transition-all"
              >
                <UserIcon className="w-3 h-3" />
                <span className="hidden sm:inline">Logout</span>
                <LogOut className="w-3 h-3 ml-1" />
              </button>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold hover:bg-blue-700 shadow-md transition-all"
              >
                <LogIn className="w-3 h-3" />
                <span className="hidden sm:inline">Login / Sign Up</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
};

export default Header;