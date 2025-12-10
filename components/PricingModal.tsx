import React from 'react';
import { Check, X, Loader2, Sparkles, Zap, Crown } from 'lucide-react';

interface PricingModalProps {
    onClose: () => void;
    onSelectTier: (tier: 'basic' | 'pro') => void;
    onLogin: () => void;
    isLoggedIn: boolean;
    loadingTier: string | null;
}

export default function PricingModal({ onClose, onSelectTier, onLogin, isLoggedIn, loadingTier }: PricingModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Choose Your Plan</h2>
                        <p className="text-slate-500 text-sm">Unlock the full potential of your language journey</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* FREE TIER */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col relative transition-transform hover:scale-[1.02]">
                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Guest</h3>
                                <div className="mt-2 flex items-baseline">
                                    <span className="text-4xl font-extrabold text-slate-900">$0</span>
                                    <span className="ml-1 text-slate-500">/forever</span>
                                </div>
                                <p className="mt-2 text-slate-500 text-sm">Perfect for trying out the tutor.</p>
                            </div>
                            <ul className="space-y-3 mb-8 flex-1">
                                <li className="flex items-start text-sm text-slate-600">
                                    <Check className="w-5 h-5 text-green-500 mr-2 shrink-0" />
                                    <span>Basic Conversations</span>
                                </li>
                                <li className="flex items-start text-sm text-slate-600">
                                    <Check className="w-5 h-5 text-green-500 mr-2 shrink-0" />
                                    <span>Access to all languages</span>
                                </li>
                                <li className="flex items-start text-sm text-slate-400">
                                    <X className="w-5 h-5 text-slate-300 mr-2 shrink-0" />
                                    <span>No History Saved</span>
                                </li>
                                <li className="flex items-start text-sm text-slate-400">
                                    <X className="w-5 h-5 text-slate-300 mr-2 shrink-0" />
                                    <span>Standard Response Time</span>
                                </li>
                            </ul>
                            <button
                                onClick={onClose}
                                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all"
                            >
                                Continue as Guest
                            </button>
                        </div>

                        {/* BASIC TIER ($1) */}
                        <div className="bg-white rounded-2xl p-6 shadow-md border border-blue-100 flex flex-col relative transition-transform hover:scale-[1.02] ring-1 ring-blue-100">
                            <div className="absolute top-0 right-0 -mt-2 -mr-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                                Popular
                            </div>
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Zap className="w-5 h-5 text-blue-500 fill-current" />
                                    <h3 className="text-xl font-bold text-blue-600 uppercase tracking-wide">Learner</h3>
                                </div>
                                <div className="mt-2 flex items-baseline">
                                    <span className="text-4xl font-extrabold text-slate-900">$1</span>
                                    <span className="ml-1 text-slate-500">/month</span>
                                </div>
                                <p className="mt-2 text-slate-500 text-sm">Save your progress and keep learning.</p>
                            </div>
                            <ul className="space-y-3 mb-8 flex-1">
                                <li className="flex items-start text-sm text-slate-600">
                                    <Check className="w-5 h-5 text-green-500 mr-2 shrink-0" />
                                    <span>Everything in Guest</span>
                                </li>
                                <li className="flex items-start text-sm text-slate-800 font-medium">
                                    <Check className="w-5 h-5 text-blue-500 mr-2 shrink-0" />
                                    <span>Save Chat History</span>
                                </li>
                                <li className="flex items-start text-sm text-slate-600">
                                    <Check className="w-5 h-5 text-green-500 mr-2 shrink-0" />
                                    <span>Resume conversations anytime</span>
                                </li>
                            </ul>
                            {isLoggedIn ? (
                                <button
                                    onClick={() => onSelectTier('basic')}
                                    disabled={!!loadingTier}
                                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-200 flex items-center justify-center gap-2"
                                >
                                    {loadingTier === 'basic' ? <Loader2 className="animate-spin w-5 h-5" /> : 'Subscribe for $1'}
                                </button>
                            ) : (
                                <button
                                    onClick={onLogin}
                                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-200"
                                >
                                    Sign in to Subscribe
                                </button>
                            )}
                        </div>

                        {/* PRO TIER ($5) */}
                        <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 flex flex-col relative transition-transform hover:scale-[1.02] text-white">
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 rounded-t-2xl"></div>
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Crown className="w-5 h-5 text-amber-400 fill-current" />
                                    <h3 className="text-xl font-bold text-amber-400 uppercase tracking-wide">Master</h3>
                                </div>
                                <div className="mt-2 flex items-baseline">
                                    <span className="text-4xl font-extrabold text-white">$5</span>
                                    <span className="ml-1 text-slate-400">/month</span>
                                </div>
                                <p className="mt-2 text-slate-400 text-sm">The ultimate immersive experience.</p>
                            </div>
                            <ul className="space-y-3 mb-8 flex-1">
                                <li className="flex items-start text-sm text-slate-300">
                                    <Check className="w-5 h-5 text-amber-400 mr-2 shrink-0" />
                                    <span>Everything in Learner</span>
                                </li>
                                <li className="flex items-start text-sm text-white font-medium">
                                    <Check className="w-5 h-5 text-amber-400 mr-2 shrink-0" />
                                    <span>Unlimited History Storage</span>
                                </li>
                                <li className="flex items-start text-sm text-white font-medium">
                                    <Check className="w-5 h-5 text-amber-400 mr-2 shrink-0" />
                                    <span>Advanced Grammar Correction</span>
                                </li>
                                <li className="flex items-start text-sm text-white font-medium">
                                    <Check className="w-5 h-5 text-amber-400 mr-2 shrink-0" />
                                    <span>Priority Response Speed</span>
                                </li>
                            </ul>
                            {isLoggedIn ? (
                                <button
                                    onClick={() => onSelectTier('pro')}
                                    disabled={!!loadingTier}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2"
                                >
                                    {loadingTier === 'pro' ? <Loader2 className="animate-spin w-5 h-5 text-white" /> : 'Get Pro for $5'}
                                </button>
                            ) : (
                                <button
                                    onClick={onLogin}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-900/20"
                                >
                                    Sign in to Subscribe
                                </button>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
