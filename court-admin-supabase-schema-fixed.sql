-- ============================================================================
-- COURT ADMIN PANEL - COMPLETE DATABASE SCHEMA (FIXED)
-- Built following RKSD College pattern with Court-specific requirements
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. COURT SETTINGS TABLE (General Court Info)
-- ============================================================================
CREATE TABLE IF NOT EXISTS court_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. COURT DEPARTMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS court_departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  department_code TEXT UNIQUE NOT NULL,
  head_name TEXT,
  head_designation TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. COURT BUILDINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS court_buildings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  building_code TEXT UNIQUE NOT NULL,
  description TEXT,
  landmark TEXT,
  directional_notes TEXT,
  number_of_floors INTEGER,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. COURT STAFF TABLE (Officers/Employees) - Created BEFORE court_rooms
-- ============================================================================
CREATE TABLE IF NOT EXISTS court_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  employee_id TEXT UNIQUE NOT NULL,
  department_id UUID REFERENCES court_departments(id) ON DELETE SET NULL,
  designation TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  assigned_building_id UUID REFERENCES court_buildings(id) ON DELETE SET NULL,
  assigned_room_id UUID,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_staff_department ON court_staff(department_id);
CREATE INDEX idx_staff_building ON court_staff(assigned_building_id);

-- ============================================================================
-- 5. COURT ROOMS TABLE - Now court_staff exists!
-- ============================================================================
CREATE TABLE IF NOT EXISTS court_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_number TEXT NOT NULL,
  room_name TEXT,
  building_id UUID REFERENCES court_buildings(id) ON DELETE CASCADE,
  floor INTEGER,
  purpose TEXT,
  in_charge_staff_id UUID REFERENCES court_staff(id) ON DELETE SET NULL,
  timing TEXT,
  status TEXT DEFAULT 'Open',
  photo_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rooms_building ON court_rooms(building_id);
CREATE INDEX idx_rooms_incharge ON court_rooms(in_charge_staff_id);

-- Now add the foreign key constraint to court_staff.assigned_room_id
ALTER TABLE court_staff 
  DROP CONSTRAINT IF EXISTS court_staff_assigned_room_id_fkey;

ALTER TABLE court_staff 
  ADD CONSTRAINT court_staff_assigned_room_id_fkey 
  FOREIGN KEY (assigned_room_id) 
  REFERENCES court_rooms(id) 
  ON DELETE SET NULL;

CREATE INDEX idx_staff_room ON court_staff(assigned_room_id);

-- ============================================================================
-- 6. COURT MINI ADMINS TABLE (Like RKSD Departments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS court_mini_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  scope_type TEXT,
  scope_value TEXT,
  panel_link TEXT UNIQUE NOT NULL,
  email TEXT,
  permissions JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. COURT FAQs TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS court_faqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL,
  department_id UUID REFERENCES court_departments(id) ON DELETE SET NULL,
  is_head_editable BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_faqs_category ON court_faqs(category);
CREATE INDEX idx_faqs_department ON court_faqs(department_id);

-- ============================================================================
-- 8. COURT TICKETS TABLE (Unanswered Queries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS court_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  source TEXT DEFAULT 'web',
  status TEXT DEFAULT 'Pending',
  assigned_to UUID REFERENCES court_mini_admins(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tickets_status ON court_tickets(status);
CREATE INDEX idx_tickets_assigned ON court_tickets(assigned_to);

-- ============================================================================
-- 9. COURT ANNOUNCEMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS court_announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  is_pinned BOOLEAN DEFAULT FALSE,
  expiry_date TIMESTAMPTZ,
  department_id UUID REFERENCES court_departments(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_announcements_priority ON court_announcements(priority);
CREATE INDEX idx_announcements_pinned ON court_announcements(is_pinned);

-- ============================================================================
-- 10. MAIN ADMIN TABLE (Single Admin Login)
-- ============================================================================
CREATE TABLE IF NOT EXISTS court_main_admin (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SEED INITIAL DATA
-- ============================================================================

-- Insert default main admin (password: admin123)
INSERT INTO court_main_admin (username, password, full_name, email)
VALUES (
  'admin',
  '$2b$10$2S.wv7lMYqwbH6RfQrK/kurTMIBV2h7gloOdm3KPgiM/EFybylLzm',
  'Court Administrator',
  'admin@kaithalcourt.gov.in'
) ON CONFLICT (username) DO NOTHING;

-- Insert basic court info
INSERT INTO court_settings (key, value)
VALUES (
  'court_basic_info',
  '{
    "court_name": "Kaithal District Court",
    "address": "Court Road, Kaithal, Haryana, India - 136027",
    "contact_numbers": {
      "reception": "+91-1746-234567",
      "pro": "+91-1746-234568",
      "legal_aid": "+91-1746-234569"
    },
    "email": "kaithalcourt@gov.in",
    "website": "https://kaithalcourt.gov.in",
    "working_hours": "10:00 AM - 5:00 PM",
    "lunch_break": "1:00 PM - 2:00 PM",
    "total_judges": 12,
    "total_buildings": 3,
    "total_rooms": 45
  }'::jsonb
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Insert default holidays
INSERT INTO court_settings (key, value)
VALUES (
  'holidays_list',
  '{
    "holidays": [
      {"date": "2025-01-26", "name": "Republic Day"},
      {"date": "2025-08-15", "name": "Independence Day"},
      {"date": "2025-10-02", "name": "Gandhi Jayanti"},
      {"date": "2025-12-25", "name": "Christmas"}
    ]
  }'::jsonb
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Insert sample departments
INSERT INTO court_departments (name, slug, department_code, head_name, head_designation, description)
VALUES 
  ('Civil Court', 'civil', 'DEPT-CIV', 'Justice R.K. Sharma', 'Senior Civil Judge', 'Handles all civil cases'),
  ('Criminal Court', 'criminal', 'DEPT-CRM', 'Justice P.K. Verma', 'Senior Criminal Judge', 'Handles all criminal cases'),
  ('Family Court', 'family', 'DEPT-FAM', 'Justice M. Singh', 'Family Court Judge', 'Handles family disputes and matrimonial cases'),
  ('Registry Office', 'registry', 'DEPT-REG', 'Mr. A.K. Gupta', 'Registrar', 'Court registry and file management'),
  ('Accounts Department', 'accounts', 'DEPT-ACC', 'Mr. S.K. Jain', 'Court Manager', 'Financial and administrative matters')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE court_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_mini_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_main_admin ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for service role)
DROP POLICY IF EXISTS "Enable all for service role" ON court_settings;
DROP POLICY IF EXISTS "Enable all for service role" ON court_departments;
DROP POLICY IF EXISTS "Enable all for service role" ON court_buildings;
DROP POLICY IF EXISTS "Enable all for service role" ON court_rooms;
DROP POLICY IF EXISTS "Enable all for service role" ON court_staff;
DROP POLICY IF EXISTS "Enable all for service role" ON court_mini_admins;
DROP POLICY IF EXISTS "Enable all for service role" ON court_faqs;
DROP POLICY IF EXISTS "Enable all for service role" ON court_tickets;
DROP POLICY IF EXISTS "Enable all for service role" ON court_announcements;
DROP POLICY IF EXISTS "Enable all for service role" ON court_main_admin;

CREATE POLICY "Enable all for service role" ON court_settings FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON court_departments FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON court_buildings FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON court_rooms FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON court_staff FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON court_mini_admins FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON court_faqs FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON court_tickets FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON court_announcements FOR ALL USING (true);
CREATE POLICY "Enable all for service role" ON court_main_admin FOR ALL USING (true);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all tables
DROP TRIGGER IF EXISTS update_court_settings_updated_at ON court_settings;
DROP TRIGGER IF EXISTS update_court_departments_updated_at ON court_departments;
DROP TRIGGER IF EXISTS update_court_buildings_updated_at ON court_buildings;
DROP TRIGGER IF EXISTS update_court_rooms_updated_at ON court_rooms;
DROP TRIGGER IF EXISTS update_court_staff_updated_at ON court_staff;
DROP TRIGGER IF EXISTS update_court_mini_admins_updated_at ON court_mini_admins;
DROP TRIGGER IF EXISTS update_court_faqs_updated_at ON court_faqs;
DROP TRIGGER IF EXISTS update_court_tickets_updated_at ON court_tickets;
DROP TRIGGER IF EXISTS update_court_announcements_updated_at ON court_announcements;
DROP TRIGGER IF EXISTS update_court_main_admin_updated_at ON court_main_admin;

CREATE TRIGGER update_court_settings_updated_at BEFORE UPDATE ON court_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_court_departments_updated_at BEFORE UPDATE ON court_departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_court_buildings_updated_at BEFORE UPDATE ON court_buildings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_court_rooms_updated_at BEFORE UPDATE ON court_rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_court_staff_updated_at BEFORE UPDATE ON court_staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_court_mini_admins_updated_at BEFORE UPDATE ON court_mini_admins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_court_faqs_updated_at BEFORE UPDATE ON court_faqs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_court_tickets_updated_at BEFORE UPDATE ON court_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_court_announcements_updated_at BEFORE UPDATE ON court_announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_court_main_admin_updated_at BEFORE UPDATE ON court_main_admin FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMPLETE! 
-- This schema provides full database structure for Court Admin Panel
-- All foreign key dependencies resolved properly
-- ============================================================================
