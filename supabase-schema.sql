-- Supabase Schema for College Management System
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Head Admin Table
CREATE TABLE IF NOT EXISTS head_admin (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments Table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  department_id TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  head_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  description TEXT,
  panel_link TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES head_admin(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Department Data Table (stores all department information)
CREATE TABLE IF NOT EXISTS department_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notices Table
CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  notice_type TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_by UUID REFERENCES head_admin(id),
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- College Settings Table (for general college info)
CREATE TABLE IF NOT EXISTS college_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events Table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL,
  event_date TIMESTAMPTZ,
  location TEXT,
  youtube_url TEXT,
  instagram_url TEXT,
  image_url TEXT,
  video_url TEXT,
  formatted_message TEXT,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_by UUID REFERENCES head_admin(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Holidays Table
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  holiday_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timings Table
CREATE TABLE IF NOT EXISTS timings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_name TEXT NOT NULL,
  opening_time TIME,
  closing_time TIME,
  days TEXT[], -- Array of days: ['Monday', 'Tuesday', etc.]
  special_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses Table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_name TEXT NOT NULL,
  course_code TEXT UNIQUE NOT NULL,
  course_type TEXT, -- UG, PG, Diploma, etc.
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  duration TEXT, -- e.g., "3 Years", "2 Years"
  description TEXT,
  eligibility TEXT,
  total_seats INTEGER,
  fees_per_year DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff Members Table
CREATE TABLE IF NOT EXISTS staff_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  employee_id TEXT UNIQUE NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  role TEXT NOT NULL, -- Professor, Assistant Professor, Lecturer, etc.
  designation TEXT,
  email TEXT,
  phone TEXT,
  qualification TEXT,
  specialization TEXT,
  joining_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_departments_slug ON departments(slug);
CREATE INDEX IF NOT EXISTS idx_departments_department_id ON departments(department_id);
CREATE INDEX IF NOT EXISTS idx_department_data_dept ON department_data(department_id);
CREATE INDEX IF NOT EXISTS idx_notices_active ON notices(is_active);
CREATE INDEX IF NOT EXISTS idx_events_active ON events(is_active);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(course_code);
CREATE INDEX IF NOT EXISTS idx_courses_dept ON courses(department_id);
CREATE INDEX IF NOT EXISTS idx_staff_employee_id ON staff_members(employee_id);
CREATE INDEX IF NOT EXISTS idx_staff_dept ON staff_members(department_id);

-- Enable Row Level Security (RLS)
ALTER TABLE head_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE college_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE timings ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public read access
CREATE POLICY "Public read access for departments" ON departments FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access for department_data" ON department_data FOR SELECT USING (true);
CREATE POLICY "Public read access for notices" ON notices FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access for college_settings" ON college_settings FOR SELECT USING (true);
CREATE POLICY "Public read access for events" ON events FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access for holidays" ON holidays FOR SELECT USING (true);
CREATE POLICY "Public read access for timings" ON timings FOR SELECT USING (true);
CREATE POLICY "Public read access for courses" ON courses FOR SELECT USING (is_active = true);
CREATE POLICY "Public read access for staff_members" ON staff_members FOR SELECT USING (is_active = true);

-- Enable Realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE departments;
ALTER PUBLICATION supabase_realtime ADD TABLE department_data;
ALTER PUBLICATION supabase_realtime ADD TABLE notices;
ALTER PUBLICATION supabase_realtime ADD TABLE college_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE holidays;
ALTER PUBLICATION supabase_realtime ADD TABLE timings;
ALTER PUBLICATION supabase_realtime ADD TABLE courses;
ALTER PUBLICATION supabase_realtime ADD TABLE staff_members;

-- Insert default head admin (change password before production)
INSERT INTO head_admin (username, password, email) 
VALUES ('admin', '$2b$10$rVxYvpYLQc6SxQJYw4b.XuGr5ILlMZQqX/KZL.qHNjKwH8LfKJ8Ku', 'admin@rksdcollege.ac.in')
ON CONFLICT (username) DO NOTHING;
-- Default password is: admin123 (please change this immediately)
