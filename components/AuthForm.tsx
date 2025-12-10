import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Loader2, Mail, Lock, X } from 'lucide-react';

interface AuthFormProps {
    onClose?: () => void;
    onSuccess?: () => void;
}

export default function AuthForm({ onClose, onSuccess }: AuthFormProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isLogin, setIsLogin] = useState(true);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                if (onSuccess) onSuccess();
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setMessage({ type: 'success', text: 'Check your email for the confirmation link!' });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-4 w-full h-full">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100 relative">
                {onClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}

                <h2 className="text-3xl font-bold text-slate-800 mb-2 text-center">
                    {isLogin ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-slate-500 text-center mb-8">
                    {isLogin ? 'Sign in to continue your language journey' : 'Join us and start learning today'}
                </p>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                            <input
                                type="email"
                                required
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                            <input
                                type="password"
                                required
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {message && (
                        <div className={`p-3 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isLogin ? 'Sign In' : 'Sign Up'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-indigo-600 font-semibold hover:underline"
                    >
                        {isLogin ? 'Sign Up' : 'Log In'}
                    </button>
                </div>
            </div>
        </div>
    );
}
