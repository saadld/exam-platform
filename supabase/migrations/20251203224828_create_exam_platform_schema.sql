/*
  # Create Exam Platform Schema

  ## Overview
  This migration creates the complete database schema for an online examination platform
  with anti-cheat features, supporting students, teachers, and administrators.

  ## New Tables

  ### 1. profiles
  - `id` (uuid, primary key) - References auth.users
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `role` (text) - User role: 'student', 'teacher', or 'admin'
  - `created_at` (timestamptz) - Account creation timestamp

  ### 2. exams
  - `id` (uuid, primary key) - Unique exam identifier
  - `title` (text) - Exam title
  - `description` (text) - Exam description
  - `duration_minutes` (integer) - Exam duration in minutes
  - `open_date` (timestamptz) - When exam becomes available
  - `close_date` (timestamptz) - When exam closes
  - `anti_cheat_enabled` (boolean) - Enable anti-cheat features
  - `max_warnings` (integer) - Max warnings before auto-submit (default: 2)
  - `allow_review` (boolean) - Allow students to review answers
  - `teacher_id` (uuid) - Creator's ID
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 3. questions
  - `id` (uuid, primary key) - Unique question identifier
  - `exam_id` (uuid) - Reference to exam
  - `question_type` (text) - Type: 'mcq', 'true_false', 'short_answer', 'long_answer'
  - `question_text` (text) - Question content
  - `points` (integer) - Points for correct answer
  - `correct_answer` (text) - Correct answer (for auto-grading)
  - `order_number` (integer) - Question order in exam
  - `created_at` (timestamptz) - Creation timestamp

  ### 4. question_options
  - `id` (uuid, primary key) - Unique option identifier
  - `question_id` (uuid) - Reference to question
  - `option_text` (text) - Option content
  - `is_correct` (boolean) - Whether this option is correct
  - `order_number` (integer) - Option order
  - `created_at` (timestamptz) - Creation timestamp

  ### 5. exam_sessions
  - `id` (uuid, primary key) - Unique session identifier
  - `exam_id` (uuid) - Reference to exam
  - `student_id` (uuid) - Reference to student
  - `started_at` (timestamptz) - Session start time
  - `submitted_at` (timestamptz) - Submission time (null if ongoing)
  - `status` (text) - Status: 'in_progress', 'submitted', 'auto_submitted', 'blocked'
  - `warning_count` (integer) - Number of warnings received
  - `last_warning_at` (timestamptz) - Last warning timestamp
  - `is_locked` (boolean) - Whether session is locked (cannot resume)
  - `created_at` (timestamptz) - Creation timestamp

  ### 6. student_answers
  - `id` (uuid, primary key) - Unique answer identifier
  - `session_id` (uuid) - Reference to exam session
  - `question_id` (uuid) - Reference to question
  - `answer_text` (text) - Student's answer
  - `selected_option_id` (uuid) - Selected option (for MCQ)
  - `is_correct` (boolean) - Auto-graded correctness (null if needs manual grading)
  - `points_earned` (integer) - Points earned (null until graded)
  - `last_saved_at` (timestamptz) - Last auto-save timestamp
  - `created_at` (timestamptz) - Creation timestamp

  ### 7. exam_results
  - `id` (uuid, primary key) - Unique result identifier
  - `session_id` (uuid) - Reference to exam session
  - `exam_id` (uuid) - Reference to exam
  - `student_id` (uuid) - Reference to student
  - `total_points` (integer) - Total points earned
  - `max_points` (integer) - Maximum possible points
  - `percentage` (numeric) - Percentage score
  - `graded_by` (uuid) - Teacher who graded (null if auto-graded)
  - `teacher_comments` (text) - Teacher's feedback
  - `graded_at` (timestamptz) - Grading timestamp
  - `created_at` (timestamptz) - Creation timestamp

  ## Security
  - RLS enabled on all tables
  - Students can only access their own data
  - Teachers can manage their own exams and grade students
  - Admins have full access
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create exams table
CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  open_date timestamptz NOT NULL,
  close_date timestamptz NOT NULL CHECK (close_date > open_date),
  anti_cheat_enabled boolean DEFAULT true,
  max_warnings integer DEFAULT 2 CHECK (max_warnings >= 0),
  allow_review boolean DEFAULT false,
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view available exams"
  ON exams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'student'
    )
    AND now() >= open_date
    AND now() <= close_date
  );

CREATE POLICY "Teachers can view own exams"
  ON exams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('teacher', 'admin')
    )
  );

CREATE POLICY "Teachers can create exams"
  ON exams FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('teacher', 'admin')
    )
    AND teacher_id = auth.uid()
  );

CREATE POLICY "Teachers can update own exams"
  ON exams FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own exams"
  ON exams FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_type text NOT NULL CHECK (question_type IN ('mcq', 'true_false', 'short_answer', 'long_answer')),
  question_text text NOT NULL,
  points integer NOT NULL DEFAULT 1 CHECK (points > 0),
  correct_answer text,
  order_number integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view questions for available exams"
  ON questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exams
      JOIN profiles ON profiles.id = auth.uid()
      WHERE exams.id = questions.exam_id
      AND profiles.role = 'student'
      AND now() >= exams.open_date
      AND now() <= exams.close_date
    )
  );

CREATE POLICY "Teachers can view questions for own exams"
  ON questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = questions.exam_id
      AND exams.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can manage questions for own exams"
  ON questions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = questions.exam_id
      AND exams.teacher_id = auth.uid()
    )
  );

-- Create question_options table
CREATE TABLE IF NOT EXISTS question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  is_correct boolean DEFAULT false,
  order_number integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view options for available questions"
  ON question_options FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM questions
      JOIN exams ON exams.id = questions.exam_id
      JOIN profiles ON profiles.id = auth.uid()
      WHERE questions.id = question_options.question_id
      AND profiles.role = 'student'
      AND now() >= exams.open_date
      AND now() <= exams.close_date
    )
  );

CREATE POLICY "Teachers can manage options for own questions"
  ON question_options FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM questions
      JOIN exams ON exams.id = questions.exam_id
      WHERE questions.id = question_options.question_id
      AND exams.teacher_id = auth.uid()
    )
  );

-- Create exam_sessions table
CREATE TABLE IF NOT EXISTS exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'auto_submitted', 'blocked')),
  warning_count integer DEFAULT 0,
  last_warning_at timestamptz,
  is_locked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(exam_id, student_id)
);

ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own sessions"
  ON exam_sessions FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can create own sessions"
  ON exam_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'student'
    )
  );

CREATE POLICY "Students can update own sessions"
  ON exam_sessions FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view sessions for own exams"
  ON exam_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = exam_sessions.exam_id
      AND exams.teacher_id = auth.uid()
    )
  );

-- Create student_answers table
CREATE TABLE IF NOT EXISTS student_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_text text,
  selected_option_id uuid REFERENCES question_options(id) ON DELETE SET NULL,
  is_correct boolean,
  points_earned integer,
  last_saved_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_id, question_id)
);

ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage own answers"
  ON student_answers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exam_sessions
      WHERE exam_sessions.id = student_answers.session_id
      AND exam_sessions.student_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can view answers for own exams"
  ON student_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exam_sessions
      JOIN exams ON exams.id = exam_sessions.exam_id
      WHERE exam_sessions.id = student_answers.session_id
      AND exams.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update grades for own exams"
  ON student_answers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exam_sessions
      JOIN exams ON exams.id = exam_sessions.exam_id
      WHERE exam_sessions.id = student_answers.session_id
      AND exams.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_sessions
      JOIN exams ON exams.id = exam_sessions.exam_id
      WHERE exam_sessions.id = student_answers.session_id
      AND exams.teacher_id = auth.uid()
    )
  );

-- Create exam_results table
CREATE TABLE IF NOT EXISTS exam_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES exam_sessions(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_points integer DEFAULT 0,
  max_points integer NOT NULL,
  percentage numeric(5,2) DEFAULT 0,
  graded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  teacher_comments text,
  graded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own results"
  ON exam_results FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can manage results for own exams"
  ON exam_results FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = exam_results.exam_id
      AND exams.teacher_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exams_teacher ON exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_exams_dates ON exams(open_date, close_date);
CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_question_options_question ON question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_student ON exam_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam ON exam_sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_session ON student_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam ON exam_results(exam_id);
