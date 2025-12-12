import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Env vars are read inside initSupabase to support testing


let supabaseInstance = null;

export const initSupabase = () => {
    if (supabaseInstance) return supabaseInstance;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

    console.log("Checking Supabase Config...");
    console.log("URL:", supabaseUrl ? "Exists" : "Missing");
    console.log("Key:", supabaseKey ? "Exists" : "Missing");

    if (supabaseUrl && supabaseKey) {
        try {
            supabaseInstance = createClient(supabaseUrl, supabaseKey);
            console.log("✅ Supabase initialized on server");
        } catch (e) {
            console.error("❌ Failed to initialize Supabase:", e);
        }
    } else {
        console.warn("⚠️ Supabase credentials missing on server. History will not persist.");
    }
    return supabaseInstance;
};

export const createScopedSupabase = (accessToken) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) return null;

    return createClient(supabaseUrl, supabaseKey, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    });
};

export const resetSupabase = () => {
    supabaseInstance = null;
};
