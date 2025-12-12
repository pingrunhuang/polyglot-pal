import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initSupabase, resetSupabase } from '../supabase.js';
import { createClient } from '@supabase/supabase-js';

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(),
}));

describe('initSupabase', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.clearAllMocks();
        resetSupabase();
        process.env = { ...originalEnv };
        vi.mocked(createClient).mockReturnValue({ auth: {} }); // Default mock return
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('initializes Supabase when env vars are present', () => {
        process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
        process.env.VITE_SUPABASE_ANON_KEY = 'test-key';

        const client = initSupabase();

        expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'test-key');
        expect(client).toBeDefined();
    });

    it('returns null and logs warning when env vars are missing', () => {
        delete process.env.VITE_SUPABASE_URL;
        delete process.env.SUPABASE_URL;
        delete process.env.VITE_SUPABASE_ANON_KEY;
        delete process.env.SUPABASE_ANON_KEY;
        delete process.env.SUPABASE_SERVICE_KEY;

        // Spy on console.warn
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        const client = initSupabase();

        expect(createClient).not.toHaveBeenCalled();
        expect(client).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith("⚠️ Supabase credentials missing on server. History will not persist.");

        consoleSpy.mockRestore();
    });

    it('returns existing instance if already initialized', () => {
        process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
        process.env.VITE_SUPABASE_ANON_KEY = 'test-key';

        // Mock return value for createClient so we can check strict equality
        const mockClient = { auth: {} };
        vi.mocked(createClient).mockReturnValue(mockClient);

        const client1 = initSupabase();
        const client2 = initSupabase();

        expect(createClient).toHaveBeenCalledTimes(1); // Only once
        expect(client1).toBe(mockClient);
        expect(client2).toBe(mockClient);
    });

    it('handles createClient errors gracefully', () => {
        process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
        process.env.VITE_SUPABASE_ANON_KEY = 'test-key';

        // Mock createClient to throw
        vi.mocked(createClient).mockImplementation(() => {
            throw new Error("Init failed");
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        const client = initSupabase();

        expect(client).toBeNull(); // Should be null on error if try-catch block sets it? 
        // looking at implementation: if error, supabaseInstance is NOT set. so it stays null. 
        // Wait, supabaseInstance is initialized to null. 
        // If init throws inside try block, supabaseInstance is not assigned.
        // So it returns null. Correct.

        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
});
