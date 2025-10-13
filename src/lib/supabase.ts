import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qbllldbzhcmnwfdsnfek.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFibGxsZGJ6aGNtbndmZHNuZmVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMDMzNDAsImV4cCI6MjA3NTc3OTM0MH0.4IWrC5MCMIc9piCJe-by4b0IRcWgJbQYjT3hfk1nYGQ';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Types for our profile_notes table
export interface ProfileNote {
  id: string;
  user_id: number;
  peer_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileNoteInsert {
  user_id: number;
  peer_id: string;
  notes: string;
}

export interface ProfileNoteUpdate {
  notes: string;
}
