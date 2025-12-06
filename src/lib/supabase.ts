import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: 'student' | 'teacher' | 'admin';
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: 'student' | 'teacher' | 'admin';
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: 'student' | 'teacher' | 'admin';
          created_at?: string;
        };
      };
      exams: {
        Row: {
          id: string;
          title: string;
          description: string;
          duration_minutes: number;
          open_date: string;
          close_date: string;
          anti_cheat_enabled: boolean;
          max_warnings: number;
          allow_review: boolean;
          teacher_id: string;
          created_at: string;
          updated_at: string;
        };
      };
      questions: {
        Row: {
          id: string;
          exam_id: string;
          question_type: 'mcq' | 'true_false' | 'short_answer' | 'long_answer';
          question_text: string;
          points: number;
          correct_answer: string | null;
          order_number: number;
          created_at: string;
        };
      };
      question_options: {
        Row: {
          id: string;
          question_id: string;
          option_text: string;
          is_correct: boolean;
          order_number: number;
          created_at: string;
        };
      };
      exam_sessions: {
        Row: {
          id: string;
          exam_id: string;
          student_id: string;
          started_at: string;
          submitted_at: string | null;
          status: 'in_progress' | 'submitted' | 'auto_submitted' | 'blocked';
          warning_count: number;
          last_warning_at: string | null;
          is_locked: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          exam_id: string;
          student_id: string;
          started_at?: string;
          submitted_at?: string | null;
          status?: 'in_progress' | 'submitted' | 'auto_submitted' | 'blocked';
          warning_count?: number;
          last_warning_at?: string | null;
          is_locked?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          exam_id?: string;
          student_id?: string;
          started_at?: string;
          submitted_at?: string | null;
          status?: 'in_progress' | 'submitted' | 'auto_submitted' | 'blocked';
          warning_count?: number;
          last_warning_at?: string | null;
          is_locked?: boolean;
          created_at?: string;
        };
      };
      student_answers: {
        Row: {
          id: string;
          session_id: string;
          question_id: string;
          answer_text: string | null;
          selected_option_id: string | null;
          is_correct: boolean | null;
          points_earned: number | null;
          last_saved_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          question_id: string;
          answer_text?: string | null;
          selected_option_id?: string | null;
          is_correct?: boolean | null;
          points_earned?: number | null;
          last_saved_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          question_id?: string;
          answer_text?: string | null;
          selected_option_id?: string | null;
          is_correct?: boolean | null;
          points_earned?: number | null;
          last_saved_at?: string;
          created_at?: string;
        };
      };
      exam_results: {
        Row: {
          id: string;
          session_id: string;
          exam_id: string;
          student_id: string;
          total_points: number;
          max_points: number;
          percentage: number;
          graded_by: string | null;
          teacher_comments: string | null;
          graded_at: string | null;
          created_at: string;
        };
      };
    };
  };
};
