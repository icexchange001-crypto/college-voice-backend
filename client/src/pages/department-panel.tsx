import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, Mic, LogOut, Building2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DepartmentData } from "@/lib/supabase";

export default function DepartmentPanel() {
  const [, params] = useRoute("/department/:slug");
  const [, setLocation] = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [departmentInfo, setDepartmentInfo] = useState<any>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ department_id: "", password: "" });
  const [dataForm, setDataForm] = useState({ data_type: "", title: "", content: "", metadata: {} });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingData, setEditingData] = useState<DepartmentData | null>(null);
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const slug = params?.slug;

  // Fetch department info
  const { data: deptData } = useQuery({
    queryKey: [`/api/department/${slug}`],
    enabled: !!slug,
    queryFn: async () => {
      const res = await fetch(`/api/department/${slug}`);
      if (!res.ok) throw new Error('Department not found');
      return res.json();
    },
  });

  // Fetch department data
  const { data: departmentDataList } = useQuery<{ data: DepartmentData[] }>({
    queryKey: [`/api/department/${departmentInfo?.id}/data`],
    enabled: !!departmentInfo?.id && isLoggedIn && !!authToken,
    queryFn: async () => {
      const res = await fetch(`/api/department/${departmentInfo.id}/data`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch data');
      return res.json();
    },
  });

  // Real-time subscription for department data
  useEffect(() => {
    if (!departmentInfo?.id || !isLoggedIn) return;

    const dataChannel = supabase
      .channel('department_data_changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'department_data',
          filter: `department_id=eq.${departmentInfo.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: [`/api/department/${departmentInfo.id}/data`] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dataChannel);
    };
  }, [departmentInfo?.id, isLoggedIn, queryClient]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: { department_id: string; password: string }) => {
      const res = await fetch('/api/department/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) throw new Error('Invalid credentials');
      return res.json();
    },
    onSuccess: (data) => {
      setDepartmentInfo(data.department);
      setAuthToken(data.token);
      setIsLoggedIn(true);
      localStorage.setItem(`dept_token_${slug}`, data.token);
      toast({ title: "Success", description: "Logged in successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Invalid credentials", variant: "destructive" });
    },
  });

  // Add data mutation
  const addDataMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/department/${departmentInfo.id}/data`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add data');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/department/${departmentInfo.id}/data`] });
      setDataForm({ data_type: "", title: "", content: "", metadata: {} });
      setIsAddDialogOpen(false);
      toast({ title: "Success", description: "Information added successfully" });
    },
  });

  // Update data mutation
  const updateDataMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/department/data/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update data');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/department/${departmentInfo.id}/data`] });
      setIsEditDialogOpen(false);
      setEditingData(null);
      toast({ title: "Success", description: "Information updated successfully" });
    },
  });

  // Delete data mutation
  const deleteDataMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/department/data/${id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (!res.ok) throw new Error('Failed to delete data');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/department/${departmentInfo.id}/data`] });
      toast({ title: "Success", description: "Information deleted successfully" });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginForm);
  };

  const handleAddData = (e: React.FormEvent) => {
    e.preventDefault();
    addDataMutation.mutate(dataForm);
  };

  const handleEdit = (data: DepartmentData) => {
    setEditingData(data);
    setDataForm({
      data_type: data.data_type,
      title: data.title,
      content: data.content,
      metadata: data.metadata || {}
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateData = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingData) return;
    updateDataMutation.mutate({
      id: editingData.id,
      data: {
        title: dataForm.title,
        content: dataForm.content,
        metadata: dataForm.metadata
      }
    });
  };

  const handleVoiceInput = (field: 'content' | 'title') => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.lang = 'hi-IN';
      recognition.continuous = false;
      
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setDataForm(prev => ({ ...prev, [field]: prev[field] + ' ' + transcript }));
      };
      
      recognition.start();
    } else {
      toast({ title: "Not supported", description: "Voice input not supported in this browser", variant: "destructive" });
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setDepartmentInfo(null);
    setAuthToken(null);
    setLoginForm({ department_id: "", password: "" });
    if (slug) {
      localStorage.removeItem(`dept_token_${slug}`);
    }
  };

  if (!slug || !deptData?.department) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6">
            <p className="text-center text-gray-600">Department not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-blue-600 rounded-full">
                <Building2 className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl">{deptData.department.name}</CardTitle>
            <CardDescription>Department Panel Login</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="department_id">Department ID</Label>
                <Input
                  id="department_id"
                  value={loginForm.department_id}
                  onChange={(e) => setLoginForm({ ...loginForm, department_id: e.target.value })}
                  placeholder="DEPT-XXXXXXXX"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Logging in..." : "Login"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dataList = departmentDataList?.data || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sticky top-0 z-10">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">{departmentInfo.name}</h1>
          <p className="text-xs sm:text-sm text-gray-600">Department Panel</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="w-full sm:w-auto">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>

      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Department Information</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Add and manage department data</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Information
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Department Information</DialogTitle>
                <DialogDescription>This will be synced in real-time</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddData} className="space-y-4">
                <div>
                  <Label htmlFor="data_type">Information Type *</Label>
                  <Input
                    id="data_type"
                    value={dataForm.data_type}
                    onChange={(e) => setDataForm({ ...dataForm, data_type: e.target.value })}
                    placeholder="e.g., timings, events, facilities"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="title">Title *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="title"
                      value={dataForm.title}
                      onChange={(e) => setDataForm({ ...dataForm, title: e.target.value })}
                      placeholder="Information title"
                      required
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => handleVoiceInput('title')}
                      className={isListening ? "bg-red-100" : ""}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="content">Content *</Label>
                  <div className="space-y-2">
                    <Textarea
                      id="content"
                      value={dataForm.content}
                      onChange={(e) => setDataForm({ ...dataForm, content: e.target.value })}
                      placeholder="Detailed information"
                      rows={6}
                      required
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleVoiceInput('content')}
                      className={`w-full ${isListening ? "bg-red-100" : ""}`}
                    >
                      <Mic className="h-4 w-4 mr-2" />
                      {isListening ? "Listening..." : "Use Voice Input"}
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={addDataMutation.isPending}>
                  {addDataMutation.isPending ? "Adding..." : "Add Information"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {dataList.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
                        {item.data_type}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(item)}
                    >
                      <Edit2 className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteDataMutation.mutate(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{item.content}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Updated: {new Date(item.updated_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {dataList.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No information added yet. Click "Add Information" to get started.
            </CardContent>
          </Card>
        )}

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Department Information</DialogTitle>
              <DialogDescription>Update the information below</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUpdateData} className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Title *</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-title"
                    value={dataForm.title}
                    onChange={(e) => setDataForm({ ...dataForm, title: e.target.value })}
                    placeholder="Information title"
                    required
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => handleVoiceInput('title')}
                    className={isListening ? "bg-red-100" : ""}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-content">Content *</Label>
                <div className="space-y-2">
                  <Textarea
                    id="edit-content"
                    value={dataForm.content}
                    onChange={(e) => setDataForm({ ...dataForm, content: e.target.value })}
                    placeholder="Detailed information"
                    rows={6}
                    required
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleVoiceInput('content')}
                    className={`w-full ${isListening ? "bg-red-100" : ""}`}
                  >
                    <Mic className="h-4 w-4 mr-2" />
                    {isListening ? "Listening..." : "Use Voice Input"}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={updateDataMutation.isPending}>
                {updateDataMutation.isPending ? "Updating..." : "Update Information"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
