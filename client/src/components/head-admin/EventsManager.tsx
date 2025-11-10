import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useVoice } from "@/hooks/use-voice";
import { Plus, Trash2, Calendar, Edit, Sparkles, Mic, MicOff, Loader2, ChevronDown, Youtube, Instagram, Image as ImageIcon, Video } from "lucide-react";
import { EnhancedAIInput } from "@/components/admin/EnhancedAIInput";
import { EnhancedAIPreview } from "@/components/admin/EnhancedAIPreview";

interface Event {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  event_date?: string;
  location?: string;
  is_active: boolean;
  department_id?: string;
  departments?: { name: string };
}

export function EventsManager() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGeneratedData, setAiGeneratedData] = useState<any>(null);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_type: "",
    event_date: "",
    location: "",
    department_id: "",
    youtube_url: "",
    instagram_url: "",
    image_url: "",
    video_url: "",
    formatted_message: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
    browserSupported,
  } = useVoice();

  const { data: eventsData } = useQuery({
    queryKey: ['/api/head-admin/events'],
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['/api/head-admin/departments'],
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
    setCurrentPreviewIndex(0);
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
      const res = await fetch("/api/admin/ai-generate-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: aiPrompt }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate event");
      }

      const data = await res.json();
      setAiGeneratedData(data);
      setCurrentPreviewIndex(0);
      const count = data.entries?.length || 1;
      toast({
        title: "Success",
        description: `Generated ${count} event${count > 1 ? 's' : ''} successfully!`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate event",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmAI = async () => {
    if (!aiGeneratedData) return;
    
    const entries = aiGeneratedData.entries || [aiGeneratedData];
    
    try {
      let successCount = 0;
      let failedEntries: string[] = [];
      
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const res = await fetch('/api/head-admin/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ message: 'Unknown error' }));
          failedEntries.push(`${entry.title || `Entry ${i + 1}`}: ${errorData.message}`);
        } else {
          successCount++;
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/head-admin/events'] });
      
      if (failedEntries.length === 0) {
        toast({ 
          title: "Success", 
          description: `${successCount} event${successCount > 1 ? 's' : ''} created successfully` 
        });
      } else if (successCount > 0) {
        toast({
          title: "Partial Success",
          description: `${successCount} event(s) created. Failed: ${failedEntries.join(', ')}`,
          variant: "default",
        });
      } else {
        throw new Error(`All entries failed: ${failedEntries.join(', ')}`);
      }
      
      setAiPrompt("");
      setAiGeneratedData(null);
      setCurrentPreviewIndex(0);
      setIsAiMode(false);
      setIsCreateOpen(false);
      resetTranscript();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create events",
        variant: "destructive",
      });
    }
  };

  const handleEditEntry = (entry: any, index: number) => {
    setFormData({
      title: entry.title || "",
      description: entry.description || "",
      event_type: entry.event_type || "",
      event_date: entry.event_date || "",
      location: entry.location || "",
      department_id: "",
      youtube_url: "",
      instagram_url: "",
      image_url: "",
      video_url: "",
      formatted_message: entry.formatted_message || "",
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
      title: "",
      description: "",
      event_type: "",
      event_date: "",
      location: "",
      department_id: "",
      youtube_url: "",
      instagram_url: "",
      image_url: "",
      video_url: "",
      formatted_message: "",
    });
    setAiPrompt("");
    setAiGeneratedData(null);
    resetTranscript();
  };

  const handleOpenDialog = (mode: 'manual' | 'ai') => {
    setIsAiMode(mode === 'ai');
    setIsCreateOpen(true);
    resetForm();
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/head-admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/head-admin/events'] });
      resetForm();
      setIsCreateOpen(false);
      toast({ title: "Success", description: "Event created successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/head-admin/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/head-admin/events'] });
      setIsEditOpen(false);
      setEditingEvent(null);
      toast({ title: "Success", description: "Event updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/head-admin/events/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/head-admin/events'] });
      toast({ title: "Success", description: "Event deleted successfully" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...formData };
    if (!payload.department_id) delete payload.department_id;
    createMutation.mutate(payload);
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      event_type: event.event_type,
      event_date: event.event_date ? new Date(event.event_date).toISOString().slice(0, 16) : "",
      location: event.location || "",
      department_id: event.department_id || "",
      youtube_url: "",
      instagram_url: "",
      image_url: "",
      video_url: "",
      formatted_message: "",
    });
    setIsEditOpen(true);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    const payload: any = { ...formData };
    if (!payload.department_id) delete payload.department_id;
    updateMutation.mutate({ id: editingEvent.id, data: payload });
  };

  const events: Event[] = (eventsData as any)?.events || [];
  const departments = (departmentsData as any)?.departments || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Events Management</h2>
          <p className="text-gray-600 mt-1">Create and manage college events</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Event
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isAiMode ? "AI Mode - Create Event" : "Create New Event"}</DialogTitle>
            <DialogDescription>
              {isAiMode ? "Describe the event in natural language" : "Add a new event to the calendar"}
            </DialogDescription>
          </DialogHeader>

          {isAiMode ? (
            <>
              {!aiGeneratedData ? (
                <EnhancedAIInput
                  prompt={aiPrompt}
                  onPromptChange={setAiPrompt}
                  onGenerate={handleGenerateAI}
                  isGenerating={isGenerating}
                  isListening={isListening}
                  onToggleVoice={handleToggleVoice}
                  browserSupported={browserSupported}
                  placeholder="Describe event(s) you want to add - single or multiple..."
                  examples={[
                    "Add Sports Day on December 20, 2024 at Main Ground",
                    "Add three events: Annual Function on Dec 25, Tech Fest on Jan 15, and Cultural Night on Feb 10",
                    "Create a workshop on AI and Machine Learning scheduled for next week in Auditorium"
                  ]}
                  sectionType="events"
                />
              ) : (
                <EnhancedAIPreview
                  entries={aiGeneratedData.entries || [aiGeneratedData]}
                  currentIndex={currentPreviewIndex}
                  onIndexChange={setCurrentPreviewIndex}
                  renderPreview={(event) => (
                    <div className="space-y-3">
                      <div>
                        <span className="font-semibold text-gray-700 block mb-1">Title:</span>
                        <p className="text-gray-900 text-lg">{event.title}</p>
                      </div>
                      {event.description && (
                        <div>
                          <span className="font-semibold text-gray-700 block mb-1">Description:</span>
                          <p className="text-gray-900">{event.description}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t">
                        <div>
                          <span className="font-semibold text-gray-700 block mb-1">Type:</span>
                          <p className="text-gray-900">{event.event_type}</p>
                        </div>
                        {event.event_date && (
                          <div>
                            <span className="font-semibold text-gray-700 block mb-1">Date:</span>
                            <p className="text-gray-900">{new Date(event.event_date).toLocaleString()}</p>
                          </div>
                        )}
                        {event.location && (
                          <div className="col-span-2">
                            <span className="font-semibold text-gray-700 block mb-1">Location:</span>
                            <p className="text-gray-900">{event.location}</p>
                          </div>
                        )}
                      </div>
                      {event.formatted_message && (
                        <div className="mt-4 pt-3 border-t">
                          <span className="font-semibold text-gray-700 block mb-2">Formatted Message:</span>
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{event.formatted_message}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  onConfirmAll={handleConfirmAI}
                  onRegenerate={handleRegenerateAI}
                  onEditEntry={handleEditEntry}
                  onDeleteEntry={handleDeleteEntry}
                  confirmButtonText={`Add ${(aiGeneratedData.entries || [aiGeneratedData]).length} Event${(aiGeneratedData.entries || [aiGeneratedData]).length > 1 ? 's' : ''}`}
                  entryTypeName="Event"
                />
              )}
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Event Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Event name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Event details"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="event_type">Event Type *</Label>
                  <Input
                    id="event_type"
                    value={formData.event_type}
                    onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                    placeholder="e.g., Cultural, Sports, Academic"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="event_date">Event Date</Label>
                  <Input
                    id="event_date"
                    type="datetime-local"
                    value={formData.event_date}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Venue"
                />
              </div>

              <div>
                <Label>Department (Optional)</Label>
                <Select value={formData.department_id || "college-wide"} onValueChange={(v) => setFormData({ ...formData, department_id: v === "college-wide" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="College-wide event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="college-wide">College-wide</SelectItem>
                    {departments.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 pt-3 border-t">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Media & Links (Optional)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="youtube_url" className="flex items-center gap-2">
                      <Youtube className="h-4 w-4 text-red-600" />
                      YouTube URL
                    </Label>
                    <Input
                      id="youtube_url"
                      value={formData.youtube_url}
                      onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                      placeholder="https://youtube.com/..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="instagram_url" className="flex items-center gap-2">
                      <Instagram className="h-4 w-4 text-pink-600" />
                      Instagram URL
                    </Label>
                    <Input
                      id="instagram_url"
                      value={formData.instagram_url}
                      onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                      placeholder="https://instagram.com/..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="image_url">Image URL</Label>
                    <Input
                      id="image_url"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder="Image URL"
                    />
                  </div>
                  <div>
                    <Label htmlFor="video_url">Video URL</Label>
                    <Input
                      id="video_url"
                      value={formData.video_url}
                      onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                      placeholder="Video URL"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="formatted_message">Formatted Message (with emojis)</Label>
                  <Textarea
                    id="formatted_message"
                    value={formData.formatted_message}
                    onChange={(e) => setFormData({ ...formData, formatted_message: e.target.value })}
                    placeholder="📅 Event announcement with emojis for landing page..."
                    rows={3}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Event"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {events.map((event) => (
          <Card key={event.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4" />
                    <CardTitle className="text-lg">{event.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
                      {event.event_type}
                    </span>
                    {event.departments && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-600">
                        {event.departments.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(event)}
                  >
                    <Edit className="h-4 w-4 text-blue-500" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(event.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {event.description && <p className="text-gray-700 mb-2">{event.description}</p>}
              {event.event_date && (
                <p className="text-sm text-gray-600">
                  📅 {new Date(event.event_date).toLocaleDateString()} at {new Date(event.event_date).toLocaleTimeString()}
                </p>
              )}
              {event.location && (
                <p className="text-sm text-gray-600">📍 {event.location}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {events.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No events yet. Click "Create Event" to add one.
          </CardContent>
        </Card>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Update event information</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Event Title *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Event name"
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Event details"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-event_type">Event Type *</Label>
                <Input
                  id="edit-event_type"
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                  placeholder="e.g., Cultural, Sports, Academic"
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit-event_date">Event Date</Label>
                <Input
                  id="edit-event_date"
                  type="datetime-local"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Venue"
              />
            </div>

            <div>
              <Label>Department (Optional)</Label>
              <Select value={formData.department_id || "college-wide"} onValueChange={(v) => setFormData({ ...formData, department_id: v === "college-wide" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="College-wide event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="college-wide">College-wide</SelectItem>
                  {departments.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update Event"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
