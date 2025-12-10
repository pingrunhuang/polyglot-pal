import React from 'react';
import { Languages, RefreshCcw, ArrowLeft, LogOut, Crown, User as UserIcon, LogIn } from 'lucide-react';
import { LanguageConfig, User } from '../types';

interface HeaderProps {
  onReset: () => void;
  onBack?: () => void;
  config?: LanguageConfig | null;
  user: User | null;
  onLoginClick: () => void;
  onLogout: () => void;
  onUpgrade: () => void;
}

const Header: React.FC<HeaderProps> = ({ onReset, onBack, config, user, onLoginClick, onLogout, onUpgrade }) => {
  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 fixed top-0 left-0 right-0 z-40 h-16 transition-all duration-300">
      <div className="max-w-4xl mx-auto px-4 h-full flex items-center justify-between">
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
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md">
              <Languages className="w-5 h-5" />
            </div>
          )}

          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">
              {config ? `Ami ${config.name}` : 'Polyglot Pal'}
            </h1>
            <p className="text-[10px] font-medium text-slate-400 tracking-wide uppercase">
              {config ? `Learn ${config.name} naturally` : 'AI Language Tutor'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {user ? (
            <>
              {/* Premium Status / Upgrade Button */}
              {user.isPremium ? (
                <div className="flex items-center px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold border border-amber-200" title="Premium Member">
                  <Crown className="w-3 h-3 mr-1 fill-current" />
                  <span>Premium</span>
                </div>
              ) : (
                <button
                  onClick={onUpgrade}
                  className="hidden sm:flex items-center px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full text-xs font-bold shadow-sm hover:shadow-md hover:scale-105 transition-all"
                >
                  <Crown className="w-3 h-3 mr-1" />
                  Upgrade
                </button>
              )}

              {/* User Profile */}
              <div className="flex items-center space-x-2 border-l border-slate-200 pl-3">
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-slate-200" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                    <span className="font-bold text-xs">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <button
                  onClick={onLogout}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            // GUEST MODE HEADER
            <>
              <button
                onClick={onUpgrade}
                className="flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-bold transition-all"
              >
                <Crown className="w-3 h-3 mr-1 text-slate-400" />
                Pricing
              </button>
              <div className="flex items-center space-x-2 border-l border-slate-200 pl-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-dashed border-slate-300" title="Guest Mode">
                  <UserIcon className="w-4 h-4" />
                </div>
                <button
                  onClick={onLoginClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold shadow-md transition-all"
                >
                  <LogIn className="w-3 h-3" />
                  Sign In
                </button>
              </div>
            </>
          )}

          {config && (
            <button
              onClick={onReset}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all border border-transparent hover:border-blue-100"
              title="Reset Conversation"
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