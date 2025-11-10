import type { Express } from "express";
import { supabase } from "./supabase";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

const createDepartmentSchema = z.object({
  name: z.string().min(1),
  head_name: z.string().optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().optional(),
  description: z.string().optional(),
});

const updateDepartmentSchema = z.object({
  head_name: z.string().optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
});

const createNoticeSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  notice_type: z.enum(['general', 'urgent', 'holiday', 'exam', 'event']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  department_id: z.string().uuid().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  event_type: z.string().min(1),
  event_date: z.string().optional(),
  location: z.string().optional(),
  department_id: z.string().uuid().optional(),
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generateDepartmentId(): string {
  return `DEPT-${nanoid(8).toUpperCase()}`;
}

function generatePassword(): string {
  return nanoid(12);
}

export function registerHeadAdminRoutes(app: Express) {
  
  // Get all departments
  app.get("/api/head-admin/departments", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json({ departments: data });
    } catch (error: any) {
      console.error('Error fetching departments:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create new department
  app.post("/api/head-admin/departments", async (req, res) => {
    try {
      const validated = createDepartmentSchema.parse(req.body);
      const slug = generateSlug(validated.name);
      const departmentId = generateDepartmentId();
      const password = generatePassword();
      const hashedPassword = await bcrypt.hash(password, 10);
      const panelLink = `/department/${slug}`;

      const { data, error } = await supabase
        .from('departments')
        .insert({
          name: validated.name,
          slug,
          department_id: departmentId,
          password: hashedPassword,
          head_name: validated.head_name,
          contact_email: validated.contact_email,
          contact_phone: validated.contact_phone,
          description: validated.description,
          panel_link: panelLink,
        })
        .select()
        .single();

      if (error) throw error;

      res.json({
        department: data,
        credentials: {
          department_id: departmentId,
          password: password, // Send plain password only once
          panel_link: panelLink
        }
      });
    } catch (error: any) {
      console.error('Error creating department:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update department
  app.put("/api/head-admin/departments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validated = updateDepartmentSchema.parse(req.body);

      const { data, error } = await supabase
        .from('departments')
        .update({
          ...validated,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ department: data });
    } catch (error: any) {
      console.error('Error updating department:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete department
  app.delete("/api/head-admin/departments/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting department:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all notices
  app.get("/api/head-admin/notices", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('*, departments(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json({ notices: data });
    } catch (error: any) {
      console.error('Error fetching notices:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create notice
  app.post("/api/head-admin/notices", async (req, res) => {
    try {
      const validated = createNoticeSchema.parse(req.body);

      const { data, error } = await supabase
        .from('notices')
        .insert({
          ...validated,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      res.json({ notice: data });
    } catch (error: any) {
      console.error('Error creating notice:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update notice
  app.put("/api/head-admin/notices/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from('notices')
        .update({
          ...req.body,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ notice: data });
    } catch (error: any) {
      console.error('Error updating notice:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete notice
  app.delete("/api/head-admin/notices/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const { error } = await supabase
        .from('notices')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting notice:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all events
  app.get("/api/head-admin/events", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, departments(name)')
        .order('event_date', { ascending: true });

      if (error) throw error;
      res.json({ events: data });
    } catch (error: any) {
      console.error('Error fetching events:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create event
  app.post("/api/head-admin/events", async (req, res) => {
    try {
      const validated = createEventSchema.parse(req.body);

      const { data, error } = await supabase
        .from('events')
        .insert({
          ...validated,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      res.json({ event: data });
    } catch (error: any) {
      console.error('Error creating event:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update event
  app.put("/api/head-admin/events/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from('events')
        .update({
          ...req.body,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ event: data });
    } catch (error: any) {
      console.error('Error updating event:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete event
  app.delete("/api/head-admin/events/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting event:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all department data
  app.get("/api/head-admin/department-data", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('department_data')
        .select('*, departments(name)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      res.json({ data });
    } catch (error: any) {
      console.error('Error fetching department data:', error);
      res.status(500).json({ message: error.message, data: [] });
    }
  });

  // Get department statistics
  app.get("/api/head-admin/stats", async (req, res) => {
    try {
      const [depts, notices, events] = await Promise.all([
        supabase.from('departments').select('id', { count: 'exact', head: true }),
        supabase.from('notices').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);

      res.json({
        total_departments: depts.count || 0,
        active_notices: notices.count || 0,
        upcoming_events: events.count || 0,
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: error.message });
    }
  });
}
