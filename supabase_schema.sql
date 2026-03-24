-- Supabase Schema for IT Ticket Management System

-- 0. Roles Table
CREATE TABLE IF NOT EXISTS roles (
  name TEXT PRIMARY KEY,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, description) VALUES
  ('admin', 'Full system access'),
  ('it_lead', 'Manage technicians and tickets'),
  ('technician', 'Handle assigned tickets'),
  ('end_user', 'Create and view own tickets')
ON CONFLICT (name) DO NOTHING;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'end_user' REFERENCES roles(name) ON UPDATE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Technicians Table
CREATE TABLE IF NOT EXISTS technicians (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  specialty TEXT,
  phone TEXT,
  status TEXT DEFAULT 'available', -- available, busy, offline
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT DEFAULT 'open', -- open, assigned, in_progress, pending, completed, acknowledged
  priority TEXT DEFAULT 'medium', -- low, medium, high, critical
  created_by UUID REFERENCES users(id),
  requested_for UUID REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  is_escalated BOOLEAN DEFAULT FALSE,
  escalation_reason TEXT,
  sla_target_time TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Knowledge Base Table
CREATE TABLE IF NOT EXISTS knowledge_base (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Activities Table (Resolution logs, comments, status changes)
CREATE TABLE IF NOT EXISTS activities (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL, -- created, assigned, re-assigned, commented, status_change, update, completed, acknowledged, escalated
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_requested_for ON tickets(requested_for);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_activities_ticket_id ON activities(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_ticket_id ON notifications(ticket_id);

-- 7. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE OR REPLACE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE OR REPLACE TRIGGER update_technicians_updated_at BEFORE UPDATE ON technicians FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 8. RBAC Helper Functions
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'end_user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'it_lead')
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_technician()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('technician', 'it_lead', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Enable Row Level Security (RLS)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 9. Comprehensive RLS Policies

-- Roles Table
DROP POLICY IF EXISTS "Roles are viewable by everyone" ON roles;
CREATE POLICY "Roles are viewable by everyone" ON roles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage roles" ON roles;
CREATE POLICY "Admins can manage roles" ON roles FOR ALL USING (is_admin());

-- Users Table
DROP POLICY IF EXISTS "Users are viewable by everyone" ON users;
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
CREATE POLICY "Users can insert their own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id OR is_admin());
DROP POLICY IF EXISTS "Users can update own record" ON users;
CREATE POLICY "Users can update own record" ON users FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admins can update any user" ON users;
CREATE POLICY "Admins can update any user" ON users FOR UPDATE USING (is_admin());

-- Technicians Table
DROP POLICY IF EXISTS "Technicians are viewable by everyone" ON technicians;
CREATE POLICY "Technicians are viewable by everyone" ON technicians FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage technicians" ON technicians;
CREATE POLICY "Admins can manage technicians" ON technicians FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Technicians can update own status" ON technicians;
CREATE POLICY "Technicians can update own status" ON technicians FOR UPDATE USING (auth.uid() = id);

-- Tickets Table
DROP POLICY IF EXISTS "Users can view their own tickets" ON tickets;
CREATE POLICY "Users can view their own tickets" ON tickets FOR SELECT USING (
  auth.uid() = created_by OR 
  auth.uid() = requested_for OR 
  is_technician()
);

DROP POLICY IF EXISTS "Users can create tickets" ON tickets;
CREATE POLICY "Users can create tickets" ON tickets FOR INSERT WITH CHECK (
  auth.uid() = created_by
);

DROP POLICY IF EXISTS "Technicians and Admins can update tickets" ON tickets;
CREATE POLICY "Technicians and Admins can update tickets" ON tickets FOR UPDATE USING (
  is_technician() OR auth.uid() = created_by
);

DROP POLICY IF EXISTS "Admins can delete tickets" ON tickets;
CREATE POLICY "Admins can delete tickets" ON tickets FOR DELETE USING (is_admin());

-- Activities Table
DROP POLICY IF EXISTS "Activities are viewable by ticket participants" ON activities;
CREATE POLICY "Activities are viewable by ticket participants" ON activities FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tickets 
    WHERE tickets.id = activities.ticket_id AND (
      tickets.created_by = auth.uid() OR 
      tickets.requested_for = auth.uid() OR 
      is_technician()
    )
  )
);

DROP POLICY IF EXISTS "Users can add activities to their tickets" ON activities;
CREATE POLICY "Users can add activities to their tickets" ON activities FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM tickets 
    WHERE tickets.id = activities.ticket_id AND (
      tickets.created_by = auth.uid() OR 
      is_technician()
    )
  )
);

-- Notifications Table
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);

-- 10. User Audit Log Table
CREATE TABLE IF NOT EXISTS user_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES users(id),
  old_role TEXT,
  new_role TEXT,
  old_name TEXT,
  new_name TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Audit Log
ALTER TABLE user_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view audit logs" ON user_audit_log;
CREATE POLICY "Admins can view audit logs" ON user_audit_log FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "System can insert audit logs" ON user_audit_log;
CREATE POLICY "System can insert audit logs" ON user_audit_log FOR INSERT WITH CHECK (true);

-- 11. Ticket Dependencies Table
CREATE TABLE IF NOT EXISTS ticket_dependencies (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  depends_on_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticket_id, depends_on_id)
);

-- RLS for ticket_dependencies
ALTER TABLE ticket_dependencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dependencies are viewable by everyone" ON ticket_dependencies;
CREATE POLICY "Dependencies are viewable by everyone" ON ticket_dependencies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Technicians and Admins can manage dependencies" ON ticket_dependencies;
CREATE POLICY "Technicians and Admins can manage dependencies" ON ticket_dependencies FOR ALL USING (is_technician());

-- RLS for knowledge_base
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Knowledge base is viewable by everyone" ON knowledge_base;
CREATE POLICY "Knowledge base is viewable by everyone" ON knowledge_base FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage knowledge base" ON knowledge_base;
CREATE POLICY "Admins can manage knowledge base" ON knowledge_base FOR ALL USING (is_admin());

-- 12. Migration for existing tables (Add missing columns if they don't exist)
DO $$
BEGIN
    -- Add columns to tickets table if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'escalation_reason') THEN
        ALTER TABLE tickets ADD COLUMN escalation_reason TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'sla_target_time') THEN
        ALTER TABLE tickets ADD COLUMN sla_target_time TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'tags') THEN
        ALTER TABLE tickets ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'rating') THEN
        ALTER TABLE tickets ADD COLUMN rating INTEGER CHECK (rating >= 1 AND rating <= 5);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'resolved_at') THEN
        ALTER TABLE tickets ADD COLUMN resolved_at TIMESTAMPTZ;
    END IF;

    -- Add columns to knowledge_base table if they don't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_base') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_base' AND column_name = 'tags') THEN
            ALTER TABLE knowledge_base ADD COLUMN tags TEXT[] DEFAULT '{}';
        END IF;
    END IF;
END $$;
