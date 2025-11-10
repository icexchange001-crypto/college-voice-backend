import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useVoice } from "@/hooks/use-voice";
import { Plus, Edit, Trash2, Mail, Phone, Sparkles, Mic, MicOff, Loader2, ChevronDown } from "lucide-react";
import { EnhancedAIInput } from "./EnhancedAIInput";
import { EnhancedAIPreview } from "./EnhancedAIPreview";
import { SmartAIUpdatePreview } from "./SmartAIUpdatePreview";

interface StaffMember {
  id: string;
  full_name: string;
  employee_id: string;
  department_id: string;
  role: string;
  designation: string;
  email: string;
  phone: string;
  qualification: string;
  specialization: string;
  joining_date: string;
  is_active: boolean;
}

interface Department {
  id: string;
  name: string;
}

export function StaffSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGeneratedData, setAiGeneratedData] = useState<any>(null);
  const [smartAIResponse, setSmartAIResponse] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [formData, setFormData] = useState({
    full_name: "",
    employee_id: "",
    department_id: "",
    role: "",
    designation: "",
    email: "",
    phone: "",
    qualification: "",
    specialization: "",
    joining_date: "",
  });

  const token = localStorage.getItem("adminToken");

  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
    browserSupported,
  } = useVoice();

  const { data: staffData } = useQuery<{ staff: StaffMember[] }>({
    queryKey: ["/api/admin/staff"],
    queryFn: async () => {
      const res = await fetch("/api/admin/staff", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch staff");
      return await res.json();
    },
  });

  const { data: departmentsData } = useQuery<{ departments: Department[] }>({
    queryKey: ["/api/admin/departments"],
    queryFn: async () => {
      const res = await fetch("/api/admin/departments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch departments");
      return await res.json();
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('staff-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_members'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add staff member");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
      toast({ title: "Success", description: "Staff member added successfully" });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/admin/staff/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update staff member");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
      toast({ title: "Success", description: "Staff member updated successfully" });
      setEditingStaff(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/staff/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete staff member");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
      toast({ title: "Success", description: "Staff member removed successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (transcript && isAiMode) {
      setAiPrompt(transcript);
    }
  }, [transcript, isAiMode]);

  const handleToggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening(aiPrompt);
    }
  };

  const handleClearPrompt = () => {
    setAiPrompt("");
    resetTranscript();
  };

  const handleRegenerateAI = () => {
    setAiGeneratedData(null);
    setSmartAIResponse(null);
    setCurrentPreviewIndex(0);
  };

  const handleCancelSmartAI = () => {
    setSmartAIResponse(null);
    setAiGeneratedData(null);
    setAiPrompt("");
    setCurrentPreviewIndex(0);
    resetTranscript();
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a description or use voice input",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const updateKeywords = ['change', 'update', 'modify', 'kar do', 'badlo', 'edit', 'correct', 'fix'];
      const isUpdateIntent = updateKeywords.some(keyword => 
        aiPrompt.toLowerCase().includes(keyword)
      );

      if (isUpdateIntent) {
        const res = await fetch("/api/admin/ai-smart-generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ 
            prompt: aiPrompt,
            sectionType: 'staff'
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to generate staff member");
        }

        const data = await res.json();
        setSmartAIResponse(data);
        
        toast({
          title: "Success",
          description: data.operation === 'update' 
            ? "Update detected! Review changes below." 
            : "Staff member information generated successfully!",
        });
      } else {
        const res = await fetch("/api/admin/ai-generate-staff", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ prompt: aiPrompt }),
        });

        if (!res.ok) {
          throw new Error("Failed to generate staff member");
        }

        const data = await res.json();
        setAiGeneratedData(data);
        
        toast({
          title: "Success",
          description: "Staff member information generated successfully!",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate staff member",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmAI = async () => {
    try {
      if (smartAIResponse && smartAIResponse.operation === 'update') {
        const matchedEntry = smartAIResponse.matched_entry;
        const changes = smartAIResponse.changes;
        
        if (!matchedEntry || !matchedEntry.id) {
          throw new Error("No entry found to update");
        }

        // Apply changes to the matched entry
        const updatedData = { ...matchedEntry };
        for (const [fieldName, change] of Object.entries(changes)) {
          updatedData[fieldName] = (change as any).new;
        }

        // Clean the data - convert null to appropriate values for Zod validation
        // Note: department_id should be a valid UUID or undefined (not empty string)
        const cleanedData: any = {
          full_name: updatedData.full_name || '',
          employee_id: updatedData.employee_id || '',
          role: updatedData.role || '',
          designation: updatedData.designation || '',
          email: updatedData.email || '',
          phone: updatedData.phone || '',
          qualification: updatedData.qualification || '',
          specialization: updatedData.specialization || '',
          joining_date: updatedData.joining_date || '',
        };
        
        // Only include department_id if it's a valid value (not null, undefined, or empty string)
        if (updatedData.department_id && updatedData.department_id.trim()) {
          cleanedData.department_id = updatedData.department_id;
        }

        console.log('Updating staff member:', matchedEntry.id, 'with cleaned data:', cleanedData);

        const res = await fetch(`/api/admin/staff/${matchedEntry.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(cleanedData),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to update staff member");
        }

        // Invalidate queries to refresh data immediately
        await queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
        
        // Wait a moment for the update to propagate
        await new Promise(resolve => setTimeout(resolve, 500));

        toast({ 
          title: "Success", 
          description: "Staff member updated successfully! Changes are now visible." 
        });
        
        // Reset state after successful update
        setAiPrompt("");
        setAiGeneratedData(null);
        setSmartAIResponse(null);
        setCurrentPreviewIndex(0);
        setIsAiMode(false);
        setIsCreateOpen(false);
        resetTranscript();
      } else if (aiGeneratedData) {
        // Handle CREATE flow
        const entries = aiGeneratedData.entries || [aiGeneratedData];
        
        const creationPromises = entries.map(async (entry: any) => {
          // Clean the data before sending - remove empty department_id
          const cleanedEntry: any = { ...entry };
          if (!cleanedEntry.department_id || !cleanedEntry.department_id.trim()) {
            delete cleanedEntry.department_id;
          }
          
          const res = await fetch("/api/admin/staff", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(cleanedEntry),
          });
          
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to create: ${entry.full_name}`);
          }
          
          return res.json();
        });

        await Promise.all(creationPromises);
        
        // Invalidate queries to refresh data immediately
        await queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
        
        // Wait a moment for the creation to propagate
        await new Promise(resolve => setTimeout(resolve, 500));
        
        toast({ 
          title: "Success", 
          description: `${entries.length} staff member${entries.length > 1 ? 's' : ''} added successfully!` 
        });
        
        // Reset state after successful creation
        setAiPrompt("");
        setAiGeneratedData(null);
        setSmartAIResponse(null);
        setCurrentPreviewIndex(0);
        setIsAiMode(false);
        setIsCreateOpen(false);
        resetTranscript();
      }
    } catch (error: any) {
      console.error('Error in handleConfirmAI:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to process request", 
        variant: "destructive" 
      });
    }
  };

  const handleEditEntry = (entry: any, index: number) => {
    setFormData({
      full_name: entry.full_name || "",
      employee_id: entry.employee_id || "",
      department_id: "",
      role: entry.role || "",
      designation: entry.designation || "",
      email: entry.email || "",
      phone: entry.phone || "",
      qualification: entry.qualification || "",
      specialization: entry.specialization || "",
      joining_date: entry.joining_date || "",
    });
    
    setAiGeneratedData(null);
    setCurrentPreviewIndex(0);
    setIsAiMode(false);
  };

  const handleDeleteEntry = (index: number) => {
    if (!aiGeneratedData) return;
    
    const entries = aiGeneratedData.entries || [aiGeneratedData];
    const updatedEntries = entries.filter((_: any, i: number) => i !== index);
    
    if (updatedEntries.length === 0) {
      setAiGeneratedData(null);
      setCurrentPreviewIndex(0);
      toast({
        title: "Info",
        description: "All entries removed. You can generate new ones.",
      });
    } else {
      setAiGeneratedData({ entries: updatedEntries });
      if (currentPreviewIndex >= updatedEntries.length) {
        setCurrentPreviewIndex(updatedEntries.length - 1);
      }
      toast({
        title: "Success",
        description: "Entry removed from preview",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      employee_id: "",
      department_id: "",
      role: "",
      designation: "",
      email: "",
      phone: "",
      qualification: "",
      specialization: "",
      joining_date: "",
    });
    setAiPrompt("");
    setAiGeneratedData(null);
    setCurrentPreviewIndex(0);
    resetTranscript();
  };

  const handleOpenDialog = (mode: 'manual' | 'ai') => {
    setIsAiMode(mode === 'ai');
    setIsCreateOpen(true);
    setAiPrompt("");
    setAiGeneratedData(null);
    setCurrentPreviewIndex(0);
    resetTranscript();
  };

  const handleSubmit = () => {
    if (editingStaff) {
      updateMutation.mutate({ id: editingStaff.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const startEdit = (staff: StaffMember) => {
    setEditingStaff(staff);
    setFormData({
      full_name: staff.full_name,
      employee_id: staff.employee_id,
      department_id: staff.department_id || "",
      role: staff.role,
      designation: staff.designation,
      email: staff.email,
      phone: staff.phone,
      qualification: staff.qualification,
      specialization: staff.specialization,
      joining_date: staff.joining_date || "",
    });
  };

  const staff = staffData?.staff || [];
  const departments = departmentsData?.departments || [];

  const filteredStaff = selectedDepartment === "all"
    ? staff
    : staff.filter((s) => s.department_id === selectedDepartment);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Staff Detail</h2>
          <p className="text-sm sm:text-base text-gray-600">Manage college staff members by department</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Staff
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleOpenDialog('manual')}>
              Manual Mode
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleOpenDialog('ai')}>
              <Sparkles className="h-4 w-4 mr-2" />
              AI Mode (Smart Add)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {isAiMode ? "AI Mode - Add Staff Member" : "Add Staff Member"}
            </DialogTitle>
          </DialogHeader>
          
          {isAiMode ? (
            <>
              {!aiGeneratedData && !smartAIResponse ? (
                <EnhancedAIInput
                  prompt={aiPrompt}
                  onPromptChange={setAiPrompt}
                  onGenerate={handleGenerateAI}
                  isGenerating={isGenerating}
                  isListening={isListening}
                  onToggleVoice={handleToggleVoice}
                  browserSupported={browserSupported}
                  placeholder="Add or update staff members (e.g., 'Mr. Ajay physical department ka contact number 9876543210 kar do')..."
                  examples={[
                    "Add Dr. Rajesh Kumar, Professor of Computer Science, PhD",
                    "Update Prof. Sharma's phone number to 9876543210",
                    "Change Dr. Verma's designation to Head of Department",
                    "Add three staff: Prof. Sharma (Physics), Dr. Verma (Maths), Ms. Patel (Chemistry)"
                  ]}
                  sectionType="staff members"
                />
              ) : smartAIResponse ? (
                <SmartAIUpdatePreview
                  operation={smartAIResponse.operation}
                  confidence={smartAIResponse.confidence}
                  matched_entry={smartAIResponse.matched_entry}
                  changes={smartAIResponse.changes}
                  entries={smartAIResponse.entries}
                  explanation={smartAIResponse.explanation}
                  sectionType="staff"
                  onConfirm={handleConfirmAI}
                  onRegenerate={handleRegenerateAI}
                  onCancel={handleCancelSmartAI}
                  renderPreview={(staff) => (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="font-semibold text-gray-700 text-xs">Name:</span>
                          <p className="text-gray-900 text-sm">{staff.full_name}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700 text-xs">Role:</span>
                          <p className="text-gray-900 text-sm">{staff.role}</p>
                        </div>
                        {staff.email && (
                          <div>
                            <span className="font-semibold text-gray-700 text-xs">Email:</span>
                            <p className="text-gray-900 text-sm">{staff.email}</p>
                          </div>
                        )}
                        {staff.phone && (
                          <div>
                            <span className="font-semibold text-gray-700 text-xs">Phone:</span>
                            <p className="text-gray-900 text-sm">{staff.phone}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                />
              ) : (
                <EnhancedAIPreview
                  entries={aiGeneratedData.entries || [aiGeneratedData]}
                  currentIndex={currentPreviewIndex}
                  onIndexChange={setCurrentPreviewIndex}
                  renderPreview={(staff) => (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <span className="font-semibold text-gray-700 block mb-1">Name:</span>
                          <p className="text-gray-900 text-lg">{staff.full_name}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700 block mb-1">Employee ID:</span>
                          <p className="text-gray-900">{staff.employee_id}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700 block mb-1">Role:</span>
                          <p className="text-gray-900">{staff.role}</p>
                        </div>
                        {staff.designation && (
                          <div>
                            <span className="font-semibold text-gray-700 block mb-1">Designation:</span>
                            <p className="text-gray-900">{staff.designation}</p>
                          </div>
                        )}
                      </div>
                      {(staff.email || staff.phone || staff.qualification || staff.specialization || staff.joining_date) && (
                        <div className="mt-4 pt-3 border-t grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {staff.email && (
                            <div>
                              <span className="font-semibold text-gray-700 block mb-1">Email:</span>
                              <p className="text-gray-900">{staff.email}</p>
                            </div>
                          )}
                          {staff.phone && (
                            <div>
                              <span className="font-semibold text-gray-700 block mb-1">Phone:</span>
                              <p className="text-gray-900">{staff.phone}</p>
                            </div>
                          )}
                          {staff.qualification && (
                            <div>
                              <span className="font-semibold text-gray-700 block mb-1">Qualification:</span>
                              <p className="text-gray-900">{staff.qualification}</p>
                            </div>
                          )}
                          {staff.specialization && (
                            <div>
                              <span className="font-semibold text-gray-700 block mb-1">Specialization:</span>
                              <p className="text-gray-900">{staff.specialization}</p>
                            </div>
                          )}
                          {staff.joining_date && (
                            <div>
                              <span className="font-semibold text-gray-700 block mb-1">Joining Date:</span>
                              <p className="text-gray-900">{staff.joining_date}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  onConfirmAll={handleConfirmAI}
                  onRegenerate={handleRegenerateAI}
                  onEditEntry={handleEditEntry}
                  onDeleteEntry={handleDeleteEntry}
                  confirmButtonText={`Add ${(aiGeneratedData.entries || [aiGeneratedData]).length} Staff Member${(aiGeneratedData.entries || [aiGeneratedData]).length > 1 ? 's' : ''}`}
                  entryTypeName="Staff Member"
                />
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label>Employee ID</Label>
                  <Input
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    placeholder="e.g., EMP001"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Department</Label>
                  <Select
                    value={formData.department_id}
                    onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Professor">Professor</SelectItem>
                      <SelectItem value="Associate Professor">Associate Professor</SelectItem>
                      <SelectItem value="Assistant Professor">Assistant Professor</SelectItem>
                      <SelectItem value="Lecturer">Lecturer</SelectItem>
                      <SelectItem value="Lab Assistant">Lab Assistant</SelectItem>
                      <SelectItem value="Administrative Staff">Administrative Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Designation</Label>
                <Input
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="e.g., Head of Department"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91-XXXXXXXXXX"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Qualification</Label>
                  <Input
                    value={formData.qualification}
                    onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                    placeholder="e.g., Ph.D., M.Sc."
                  />
                </div>
                <div>
                  <Label>Joining Date</Label>
                  <Input
                    type="date"
                    value={formData.joining_date}
                    onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Specialization</Label>
                <Textarea
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  placeholder="Area of expertise..."
                  rows={2}
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                Add Staff Member
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Edit Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Employee ID</Label>
                <Input
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Department</Label>
                <Select
                  value={formData.department_id}
                  onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Professor">Professor</SelectItem>
                    <SelectItem value="Associate Professor">Associate Professor</SelectItem>
                    <SelectItem value="Assistant Professor">Assistant Professor</SelectItem>
                    <SelectItem value="Lecturer">Lecturer</SelectItem>
                    <SelectItem value="Lab Assistant">Lab Assistant</SelectItem>
                    <SelectItem value="Administrative Staff">Administrative Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Designation</Label>
              <Input
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Qualification</Label>
                <Input
                  value={formData.qualification}
                  onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                />
              </div>
              <div>
                <Label>Joining Date</Label>
                <Input
                  type="date"
                  value={formData.joining_date}
                  onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Specialization</Label>
              <Textarea
                value={formData.specialization}
                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                rows={2}
              />
            </div>
            <Button onClick={handleSubmit} className="w-full">
              Update Staff Member
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs value={selectedDepartment} onValueChange={setSelectedDepartment}>
        <TabsList>
          <TabsTrigger value="all">All Staff</TabsTrigger>
          {departments.map((dept) => (
            <TabsTrigger key={dept.id} value={dept.id}>
              {dept.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedDepartment} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStaff.map((member) => (
              <Card key={member.id}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    {member.full_name}
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(member)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(member.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    {member.employee_id} - {member.role}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {member.designation && (
                      <div><span className="font-medium">Designation:</span> {member.designation}</div>
                    )}
                    {member.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {member.email}
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {member.phone}
                      </div>
                    )}
                    {member.qualification && (
                      <div><span className="font-medium">Qualification:</span> {member.qualification}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredStaff.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                No staff members found for this department. Click "Add Staff" to get started.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
