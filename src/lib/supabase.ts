import { createClient } from '@supabase/supabase-js';
import { AnalysisRecord } from '../types';

// Initialize the Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Missing Supabase URL or Anon Key. Falling back to local storage.");
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

// --- Local Storage Helpers ---
const LOCAL_STORAGE_KEY = 'kinetix_analysis_history';

const saveToLocalStorage = (record: AnalysisRecord): AnalysisRecord => {
    try {
        const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
        const history: AnalysisRecord[] = existing ? JSON.parse(existing) : [];

        const newRecord = {
            ...record,
            id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            created_at: new Date().toISOString()
        };

        const updatedHistory = [newRecord, ...history];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedHistory));
        console.log("Saved to local storage:", newRecord);
        return newRecord;
    } catch (e) {
        console.error("Failed to save to local storage", e);
        return record;
    }
};

const getFromLocalStorage = (): AnalysisRecord[] => {
    try {
        const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
        return existing ? JSON.parse(existing) : [];
    } catch (e) {
        console.error("Failed to load from local storage", e);
        return [];
    }
};

/**
 * Saves a new analysis record to the database (with local fallback).
 */
export const saveAnalysis = async (record: AnalysisRecord) => {
    // Try Supabase first
    if (supabaseUrl && supabaseAnonKey) {
        try {
            const { data, error } = await supabase
                .from('analyses')
                .insert([
                    {
                        movement_name: record.movement_name,
                        confidence: record.confidence,
                        analysis_data: record.analysis_data,
                        video_url: record.video_url
                    }
                ])
                .select();

            if (!error && data) {
                return data;
            }
            console.warn('Supabase save failed, falling back to local:', error);
        } catch (err) {
            console.warn('Supabase connection error, falling back to local:', err);
        }
    }

    // Fallback to Local Storage
    const localData = saveToLocalStorage(record);
    return [localData];
};

/**
 * Fetches analysis history from the database (merging with local).
 */
export const getAnalysisHistory = async () => {
    let cloudData: AnalysisRecord[] = [];

    // Try Supabase
    if (supabaseUrl && supabaseAnonKey) {
        try {
            const { data, error } = await supabase
                .from('analyses')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data) {
                cloudData = data as AnalysisRecord[];
            } else {
                console.warn('Supabase fetch failed:', error);
            }
        } catch (err) {
            console.warn('Supabase connection error:', err);
        }
    }

    // Always load local data
    const localData = getFromLocalStorage();

    // Merge (Local first, then Cloud) - simple concatenation for now
    // Ideally we would dedup, but since IDs differ (UUID vs local_), we treat them as separate sources
    return [...localData, ...cloudData];
};
