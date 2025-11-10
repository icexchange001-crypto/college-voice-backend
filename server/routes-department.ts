import type { Express } from "express";
import { supabase } from "./supabase";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateDepartmentToken, requireDepartmentAuth, validateDepartmentAccess } from "./department-auth";

const loginSchema = z.object({
  department_id: z.string(),
  password: z.string(),
});

const addDataSchema = z.object({
  data_type: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  metadata: z.any().optional(),
});

const updateDataSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  metadata: z.any().optional(),
});

export function registerDepartmentRoutes(app: Express) {
  
  // Department login
  app.post("/api/department/login", async (req, res) => {
    try {
      const { department_id, password } = loginSchema.parse(req.body);

      const { data: department, error } = await supabase
        .from('departments')
        .select('*')
        .eq('department_id', department_id)
        .eq('is_active', true)
        .single();

      if (error || !department) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, department.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Don't send password hash to client
      const { password: _, ...departmentData } = department;

      const token = generateDepartmentToken(department.id, department.slug);

      res.json({
        department: departmentData,
        token
      });
    } catch (error: any) {
      console.error('Department login error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get department info by slug
  app.get("/api/department/:slug", async (req, res) => {
    try {
      const { slug } = req.params;

      const { data, error } = await supabase
        .from('departments')
        .select('id, name, slug, department_id, head_name, contact_email, contact_phone, description, is_active')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      res.json({ department: data });
    } catch (error: any) {
      console.error('Error fetching department:', error);
      res.status(404).json({ message: "Department not found" });
    }
  });

  // Get department data (protected)
  app.get("/api/department/:departmentId/data", requireDepartmentAuth, validateDepartmentAccess, async (req, res) => {
    try {
      const { departmentId } = req.params;

      const { data, error } = await supabase
        .from('department_data')
        .select('*')
        .eq('department_id', departmentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json({ data });
    } catch (error: any) {
      console.error('Error fetching department data:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add department data (protected)
  app.post("/api/department/:departmentId/data", requireDepartmentAuth, validateDepartmentAccess, async (req, res) => {
    try {
      const { departmentId } = req.params;
      const validated = addDataSchema.parse(req.body);

      const { data, error } = await supabase
        .from('department_data')
        .insert({
          department_id: departmentId,
          ...validated
        })
        .select()
        .single();

      if (error) throw error;
      res.json({ data });
    } catch (error: any) {
      console.error('Error adding department data:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update department data (protected)
  app.put("/api/department/data/:id", requireDepartmentAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validated = updateDataSchema.parse(req.body);
      const departmentAuth = (req as any).departmentAuth;

      // Update only if it belongs to the authenticated department
      const { data, error } = await supabase
        .from('department_data')
        .update({
          ...validated,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('department_id', departmentAuth.departmentId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ message: "Data not found or access denied" });
        }
        throw error;
      }

      res.json({ data });
    } catch (error: any) {
      console.error('Error updating department data:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete department data (protected)
  app.delete("/api/department/data/:id", requireDepartmentAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const departmentAuth = (req as any).departmentAuth;

      // Delete only if it belongs to the authenticated department
      const { error, count } = await supabase
        .from('department_data')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('department_id', departmentAuth.departmentId);

      if (error) throw error;
      
      if (count === 0) {
        return res.status(404).json({ message: "Data not found or access denied" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting department data:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get public notices
  app.get("/api/public/notices", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('*, departments(name)')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      res.json({ notices: data });
    } catch (error: any) {
      console.error('Error fetching public notices:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get public events
  app.get("/api/public/events", async (req, res) => {
    try {
      // Show events from 7 days ago to future
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data, error } = await supabase
        .from('events')
        .select('*, departments(name)')
        .eq('is_active', true)
        .gte('event_date', sevenDaysAgo.toISOString())
        .order('event_date', { ascending: false })
        .limit(20);

      if (error) throw error;
      res.json({ events: data });
    } catch (error: any) {
      console.error('Error fetching public events:', error);
      res.status(500).json({ message: error.message });
    }
  });
}
