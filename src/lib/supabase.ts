import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase URL or Anon Key");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AnalysisRecord {
    id?: string;
    created_at?: string;
    movement_name: string;
    confidence: number;
    analysis_data: any;
    video_url?: string;
}

/**
 * Saves a new analysis record to the database.
 */
export const saveAnalysis = async (record: AnalysisRecord) => {
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

    if (error) {
        console.error('Error saving analysis:', error);
        throw error;
    }
    return data;
};

/**
 * Fetches analysis history from the database.
 */
export const getAnalysisHistory = async () => {
    const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching history:', error);
        throw error;
    }
    return data as AnalysisRecord[];
};
