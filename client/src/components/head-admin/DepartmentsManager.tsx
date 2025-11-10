import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Copy, Eye, EyeOff, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Department {
  id: string;
  name: string;
  slug: string;
  department_id: string;
  head_name?: string;
  contact_email?: string;
  contact_phone?: string;
  description?: string;
  panel_link: string;
  is_active: boolean;
  created_at: string;
}

export function DepartmentsManager() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    head_name: "",
    contact_email: "",
    contact_phone: "",
    description: "",
  });
  const [newCredentials, setNewCredentials] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch departments
  const { data: departmentsData } = useQuery({
    queryKey: ['/api/head-admin/departments'],
    queryFn: async () => {
      const res = await fetch('/api/head-admin/departments');
      if (!res.ok) throw new Error('Failed to fetch departments');
      return res.json();
    },
  });

  // Create department mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/head-admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create department');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/head-admin/departments'] });
      setNewCredentials(data.credentials);
      setFormData({ name: "", head_name: "", contact_email: "", contact_phone: "", description: "" });
      toast({
        title: "Success",
        description: "Department created successfully! Save the credentials shown below.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete department mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/head-admin/departments/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete department');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/head-admin/departments'] });
      toast({
        title: "Success",
        description: "Department deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const departments: Department[] = departmentsData?.departments || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Departments Management</h2>
          <p className="text-gray-600 mt-1">Create and manage department panels</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Department
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Department Panel</DialogTitle>
              <DialogDescription>
                Create a new department with secure credentials
              </DialogDescription>
            </DialogHeader>

            {newCredentials ? (
              <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="text-sm font-medium text-blue-900">
                  ⚠️ Save these credentials! They won't be shown again.
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Department ID</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={newCredentials.department_id} readOnly className="bg-white" />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(newCredentials.department_id, "Department ID")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Password</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={newCredentials.password} readOnly className="bg-white" />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(newCredentials.password, "Password")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Panel Link</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={`${window.location.origin}${newCredentials.panel_link}`} readOnly className="bg-white" />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(`${window.location.origin}${newCredentials.panel_link}`, "Panel Link")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Button onClick={() => { setNewCredentials(null); setIsCreateOpen(false); }} className="w-full">
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Department Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Science, Arts, Sports"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="head_name">Head of Department</Label>
                  <Input
                    id="head_name"
                    value={formData.head_name}
                    onChange={(e) => setFormData({ ...formData, head_name: e.target.value })}
                    placeholder="Dr. Name"
                  />
                </div>

                <div>
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    placeholder="department@college.edu"
                  />
                </div>

                <div>
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    id="contact_phone"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="+91-XXXXXXXXXX"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the department"
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Department"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => (
          <Card key={dept.id}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                {dept.name}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(dept.panel_link, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(dept.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                ID: {dept.department_id}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {dept.head_name && (
                  <div>
                    <span className="font-medium">Head:</span> {dept.head_name}
                  </div>
                )}
                {dept.contact_email && (
                  <div>
                    <span className="font-medium">Email:</span> {dept.contact_email}
                  </div>
                )}
                {dept.contact_phone && (
                  <div>
                    <span className="font-medium">Phone:</span> {dept.contact_phone}
                  </div>
                )}
                <div>
                  <span className="font-medium">Status:</span>{" "}
                  <span className={dept.is_active ? "text-green-600" : "text-red-600"}>
                    {dept.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {departments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No departments created yet. Click "Create Department" to get started.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
