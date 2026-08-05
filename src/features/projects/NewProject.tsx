import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CalendarIcon,
  Plus,
  X,
  Upload,
  FileText,
  Users,
  Building2,
  Paperclip,
  ListTodo,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileSpreadsheet,
  Palette,
  Laptop,
  Wrench,
  Smartphone,
  Settings,
  Zap,
  Cpu,
  FlaskConical,
  Factory,
  BookOpen,
  Link as LinkIcon,
  Globe,
  Flag,
  Target,
  Pencil,
  Loader2,
  Smile,
  Eye
} from "lucide-react";
import { format, isBefore, startOfMonth } from "date-fns";
import { cn, isValidPhoneNumber } from "@/lib/utils";
import { PhoneInput } from "@/components/ui/phone-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateProject } from "@/hooks/useProjects";
import { useOrganizationMembers } from "@/hooks/useProjectTeam";
import { useCreateAttachment } from '@/hooks/useProjectAttachments';
import { useCreateProjectLink } from '@/hooks/useProjectLinks';
import { modulesService } from "@/services/modules.service";
import { milestonesService } from "@/services/milestones.service";
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { projectStorageService, UploadedProjectFile } from "@/services/projectStorage.service";
import { attachmentsService } from "@/services/attachments.service";
import { projectLinksService } from "@/services/projectLinks.service";
import { projectMembersService } from "@/services/projectMembers.service";
import { isValidUuid } from "@/utils/uuid";
import { logger } from '@/services/monitoring/logger';
import type { ProjectRole } from "@/types";

const projectTypes = [
  "Hardware Development",
  "Software Development",
  "Firmware Development",
  "Full Product Development",
  "Research & Development",
  "Proof of Concept",
  "Prototype",
  "Production",
];

const projectStages = [
  { value: "concept", label: "Concept" },
  { value: "design", label: "Design" },
  { value: "development", label: "Development" },
  { value: "testing", label: "Testing" },
  { value: "production", label: "Production" },
];

const departments = [
  { id: "design", name: "Design", icon: Palette },
  // { id: "development", name: "Development", icon: Laptop },
  { id: "hardware", name: "Hardware", icon: Wrench },
  { id: "software", name: "Software", icon: Smartphone },
  { id: "mechanical", name: "Mechanical", icon: Settings },
  { id: "electrical", name: "Electrical", icon: Zap },
  { id: "firmware", name: "Firmware", icon: Cpu },
  { id: "testing", name: "Testing & QA", icon: FlaskConical },
  { id: "manufacturing", name: "Manufacturing", icon: Factory },
  { id: "documentation", name: "Documentation", icon: BookOpen },
];

interface TeamMemberAssignment {
  memberId: string;
  role: ProjectRole;
}

interface Department {
  id: string;
  name: string;
  icon: React.ElementType;
}

interface ProjectLink {
  id: string;
  title: string;
  url: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  url?: string;
  path?: string;
  file?: File; // For pending uploads before project creation
}

interface ExtractedTask {
  id: string;
  title: string;
  description: string;
  priority: string;
}

interface ProjectModule {
  id: string;
  name: string;
}

interface ProjectMilestone {
  id: string;
  name: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
}

const NewProject = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { user: currentUser } = useAuth();
  const createProjectMutation = useCreateProject();
  const { data: teamMembers = [] } = useOrganizationMembers(currentOrganization?.id);
  const [isCreating, setIsCreating] = useState(false);

  // Basic Details
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectType, setProjectType] = useState("");
  const [projectStage, setProjectStage] = useState<string>("concept");
  const [projectEmoji, setProjectEmoji] = useState<string>("📁");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [expectedEndDate, setExpectedEndDate] = useState<Date>();
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isExpectedEndDateOpen, setIsExpectedEndDateOpen] = useState(false);

  // Common project emojis
  const projectEmojis = [
    "📁", "📂", "🚀", "💡", "⚡", "🎯", "🔧", "⚙️", "🛠️", "💻",
    "📱", "🖥️", "🔌", "🔋", "📡", "🛰️", "🤖", "🧠", "🔬", "🧪",
    "📊", "📈", "📉", "🎨", "🎬", "🎮", "🏗️", "🏭", "🌐", "🔐",
    "✨", "🌟", "⭐", "💎", "🏆", "🎖️", "🥇", "🎁", "📦", "🗃️"
  ];

  // Auto-set stage based on type
  useEffect(() => {
    if (!projectType) return;

    let stage = 'concept';
    const typeLower = projectType.toLowerCase();
    if (typeLower.includes('production')) stage = 'production';
    else if (typeLower.includes('prototype')) stage = 'development';
    else if (typeLower.includes('testing')) stage = 'testing';
    else if (typeLower.includes('design')) stage = 'design';

    setProjectStage(stage);
  }, [projectType]);

  // The project creator is always added as Admin by the backend on creation,
  // so reflect that in the UI without requiring the user to add themselves.
  useEffect(() => {
    if (!currentUser?.id) return;
    setAssignedMembers(prev =>
      prev.some(m => m.memberId === currentUser.id)
        ? prev
        : [{ memberId: currentUser.id, role: 'admin' as ProjectRole }, ...prev]
    );
  }, [currentUser?.id]);

  // Optional Details
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientOrganization, setClientOrganization] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [notes, setNotes] = useState("");
  const [clientContactError, setClientContactError] = useState("");
  const [clientOrgError, setClientOrgError] = useState("");

  // Team Members
  const [assignedMembers, setAssignedMembers] = useState<TeamMemberAssignment[]>([]);
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  // Departments
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [customDepartments, setCustomDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);

  // Storage (Attachments & Links)
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const isLinkUrlValid = !newLinkUrl || (() => {
    try { const p = new URL(newLinkUrl); return p.protocol === 'https:' || p.protocol === 'http:'; }
    catch { return false; }
  })();
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  // Tasks from document
  const [taskDocument, setTaskDocument] = useState<UploadedFile | null>(null);
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modules
  const [modules, setModules] = useState<ProjectModule[]>([]);
  const [newModuleName, setNewModuleName] = useState("");
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  // Milestones
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [newMilestoneStart, setNewMilestoneStart] = useState<Date>();
  const [newMilestoneEnd, setNewMilestoneEnd] = useState<Date>();
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [isMilestoneStartOpen, setIsMilestoneStartOpen] = useState(false);
  const [isMilestoneEndOpen, setIsMilestoneEndOpen] = useState(false);
  const [milestoneStartCalendarMonth, setMilestoneStartCalendarMonth] = useState<Date>(() =>
    startOfMonth(new Date())
  );
  const [milestoneEndCalendarMonth, setMilestoneEndCalendarMonth] = useState<Date>(() =>
    startOfMonth(new Date())
  );

  useLayoutEffect(() => {
    if (isMilestoneStartOpen) {
      setMilestoneStartCalendarMonth(
        startOfMonth(newMilestoneStart ?? startDate ?? new Date())
      );
    }
  }, [isMilestoneStartOpen, newMilestoneStart, startDate]);

  useLayoutEffect(() => {
    if (isMilestoneEndOpen) {
      setMilestoneEndCalendarMonth(
        startOfMonth(newMilestoneEnd ?? newMilestoneStart ?? startDate ?? new Date())
      );
    }
  }, [isMilestoneEndOpen, newMilestoneEnd, newMilestoneStart, startDate]);

  // Deletion Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    type: 'module' | 'milestone' | 'attachment' | 'link' | null;
    id: string | null;
  }>({
    isOpen: false,
    type: null,
    id: null
  });

  const confirmDelete = () => {
    const { type, id } = deleteConfirmation;
    if (!type || !id) return;

    if (type === 'module') {
      setModules(modules.filter(m => m.id !== id));
      if (editingModuleId === id) {
        setEditingModuleId(null);
        setNewModuleName("");
      }
    } else if (type === 'milestone') {
      setMilestones(milestones.filter(m => m.id !== id));
      if (editingMilestoneId === id) {
        setEditingMilestoneId(null);
        setNewMilestoneName("");
        setNewMilestoneStart(undefined);
        setNewMilestoneEnd(undefined);
      }
    } else if (type === 'attachment') {
      setAttachments(attachments.filter(f => f.id !== id));
    } else if (type === 'link') {
      setLinks(links.filter(l => l.id !== id));
    }

    setDeleteConfirmation({ isOpen: false, type: null, id: null });
  };

  const handleAddModule = () => {
    if (newModuleName.trim()) {
      if (editingModuleId) {
        setModules(modules.map(m => m.id === editingModuleId ? { ...m, name: newModuleName.trim() } : m));
        setEditingModuleId(null);
      } else {
        setModules([...modules, { id: Math.random().toString(36).substr(2, 9), name: newModuleName.trim() }]);
      }
      setNewModuleName("");
    }
  };

  const handleEditModule = (module: ProjectModule) => {
    setNewModuleName(module.name);
    setEditingModuleId(module.id);
  };

  const handleRemoveModule = (id: string) => {
    setDeleteConfirmation({ isOpen: true, type: 'module', id });
  };

  const handleAddMilestone = () => {
    if (newMilestoneStart && newMilestoneEnd && isBefore(newMilestoneEnd, newMilestoneStart)) {
      toast.error("Milestone end date cannot be before the start date");
      return;
    }
    if (newMilestoneName.trim() && newMilestoneStart && newMilestoneEnd) {
      if (editingMilestoneId) {
        setMilestones(milestones.map(m => m.id === editingMilestoneId ? {
          ...m,
          name: newMilestoneName.trim(),
          startDate: newMilestoneStart,
          endDate: newMilestoneEnd
        } : m));
        setEditingMilestoneId(null);
      } else {
        setMilestones([
          ...milestones,
          {
            id: Math.random().toString(36).substr(2, 9),
            name: newMilestoneName.trim(),
            startDate: newMilestoneStart,
            endDate: newMilestoneEnd
          }
        ]);
      }
      setNewMilestoneName("");
      setNewMilestoneStart(undefined);
      setNewMilestoneEnd(undefined);
    }
  };

  const handleEditMilestone = (milestone: ProjectMilestone) => {
    setNewMilestoneName(milestone.name);
    setNewMilestoneStart(milestone.startDate);
    setNewMilestoneEnd(milestone.endDate);
    setEditingMilestoneId(milestone.id);
  };

  const handleRemoveMilestone = (id: string) => {
    setDeleteConfirmation({ isOpen: true, type: 'milestone', id });
  };

  const handleChangeAssignedMemberRole = (memberId: string, role: ProjectRole) => {
    setAssignedMembers(prev => prev.map(m => (m.memberId === memberId ? { ...m, role } : m)));
  };

  const handleToggleMemberSelection = (memberId: string) => {
    const isAssigned = assignedMembers.some(am => am.memberId === memberId);
    if (isAssigned) {
      setAssignedMembers(prev => prev.filter(m => m.memberId !== memberId));
    } else {
      setAssignedMembers(prev => [...prev, { memberId, role: 'member' as ProjectRole }]);
    }
  };

  const handleRemoveTeamMember = (memberId: string) => {
    if (memberId === currentUser?.id) return; // Creator is always Admin, can't be removed
    setAssignedMembers(assignedMembers.filter(m => m.memberId !== memberId));
  };

  const handleDepartmentToggle = (departmentId: string) => {
    setSelectedDepartments(prev =>
      prev.includes(departmentId)
        ? prev.filter(d => d !== departmentId)
        : [...prev, departmentId]
    );
  };

  const handleAddCustomDepartment = () => {
    if (newDeptName.trim()) {
      const newId = `custom-${Date.now()}`;
      const newDept: Department = {
        id: newId,
        name: newDeptName.trim(),
        icon: Building2 // Use generic icon for custom departments
      };

      setCustomDepartments([...customDepartments, newDept]);
      setSelectedDepartments([...selectedDepartments, newId]); // Auto-select new department
      setNewDeptName("");
      setIsAddDeptOpen(false);
    }
  };

  const handleDeleteCustomDepartment = (e: React.MouseEvent, departmentId: string) => {
    e.stopPropagation();
    setCustomDepartments(prev => prev.filter(d => d.id !== departmentId));
    setSelectedDepartments(prev => prev.filter(id => id !== departmentId));
  };

  const handleRemoveAttachment = (fileId: string) => {
    setDeleteConfirmation({ isOpen: true, type: 'attachment', id: fileId });
  };

  const handleAddLink = () => {
    if (!newLinkName || !newLinkUrl) return;
    try {
      const parsed = new URL(newLinkUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        toast.error('URL must start with https:// or http://');
        return;
      }
    } catch {
      toast.error('Please enter a valid URL (e.g., https://example.com)');
      return;
    }
    setLinks([...links, { id: Math.random().toString(36).substr(2, 9), title: newLinkName, url: newLinkUrl }]);
    setNewLinkName("");
    setNewLinkUrl("");
  };

  const handleRemoveLink = (linkId: string) => {
    setDeleteConfirmation({ isOpen: true, type: 'link', id: linkId });
  };

  // File upload handlers
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || 'file';
  };

  const processFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'text/markdown',
      'text/x-markdown',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/vnd.rar',
    ];

    const maxSize = 50 * 1024 * 1024; // 50MB
    const newFiles: UploadedFile[] = [];
    const errors: string[] = [];

    Array.from(files).forEach(file => {
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: Unsupported file type`);
        return;
      }
      if (file.size > maxSize) {
        errors.push(`${file.name}: File too large (max 50MB)`);
        return;
      }

      newFiles.push({
        id: Math.random().toString(36).substring(2, 11),
        name: file.name,
        size: formatFileSize(file.size),
        type: getFileExtension(file.name),
        file: file, // Store file for later upload
      });
    });

    if (errors.length > 0) {
      toast.error('Some files could not be added', {
        description: errors.join('\n'),
      });
    }

    if (newFiles.length > 0) {
      setAttachments(prev => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} file(s) added`, {
        description: 'Files will be uploaded when the project is created.',
      });
    }
  }, []);

  useEffect(() => {
    const urls: Record<string, string> = {};
    attachments.forEach(file => {
      if (file.file && (file.file.type.startsWith('image/') || file.file.type === 'application/pdf')) {
        urls[file.id] = URL.createObjectURL(file.file);
      }
    });
    setPreviewUrls(urls);
    return () => {
      Object.values(urls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [attachments]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleTaskDocumentUpload = () => {
    // Task import feature - coming soon
    toast.info('Task import feature coming soon!', {
      description: 'This feature will allow you to upload Excel or CSV files to automatically extract tasks.'
    });
  };

  const handleRemoveTask = (taskId: string) => {
    setExtractedTasks(extractedTasks.filter(t => t.id !== taskId));
  };

  const handleCreateProject = async () => {
    if (!currentOrganization || !isValidUuid(currentOrganization.id)) {
      toast.error('Please select an organization first');
      return;
    }

    if (!projectName.trim()) {
      toast.error('Project name is required');
      return;
    }

    if (!projectType.trim()) {
      toast.error('Project type is required');
      return;
    }

    if (!projectDescription.trim()) {
      toast.error('Project description is required');
      return;
    }

    if (!startDate) {
      toast.error('Start date is required');
      return;
    }

    if (!expectedEndDate) {
      toast.error('Expected completion date is required');
      return;
    }

    if (isBefore(expectedEndDate, startDate)) {
      toast.error('Expected completion date must be after the start date');
      return;
    }

    if (newMilestoneName.trim() || newMilestoneStart || newMilestoneEnd) {
      toast.error("You have an unsaved milestone. Please click '+ Add Milestone' or clear the inputs.");
      return;
    }

    if (newModuleName.trim()) {
      toast.error("You have an unsaved module. Please click 'Add Module' or clear the input.");
      return;
    }

    if (newLinkName.trim() || newLinkUrl.trim()) {
      toast.error("You have an unsaved project link. Please click 'Add Link' or clear the inputs.");
      return;
    }

    if (clientContact && !isValidPhoneNumber(clientContact)) {
      toast.error('Please enter a valid phone number');
      setShowOptionalDetails(true);
      return;
    }

    if (clientOrganization && /[^a-zA-Z\s\-'.]/.test(clientOrganization)) {
      toast.error('Organisation name must contain only letters and spaces');
      setShowOptionalDetails(true);
      return;
    }

    setIsCreating(true);

    try {
      // Create the project

      // Create the project
      const project = await createProjectMutation.mutateAsync({
        project: {
          name: projectName.trim(),
          description: projectDescription.trim(),
          stage: projectStage,
          type: projectType,
          startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
          targetDate: expectedEndDate ? format(expectedEndDate, 'yyyy-MM-dd') : undefined,
          icon: projectEmoji,
          clientName,
          clientOrganization,
          clientContact,
          notes,
          departments: selectedDepartments,
        },
        organizationId: currentOrganization.id,
      });

      // Create initial modules if specified
      if (modules.length > 0) {
        await Promise.all(modules.map(m =>
          modulesService.create({
            project_id: project.id,
            name: m.name,
            module_type: 'software', // Default type
          })
        ));
      }

      // Create initial milestones if specified  
      if (milestones.length > 0) {
        await Promise.all(milestones.map(m =>
          milestonesService.create({
            project_id: project.id,
            name: m.name,
            due_date: m.endDate ? format(m.endDate, 'yyyy-MM-dd') : null,
          })
        ));
      }

      // Upload files to S3 storage
      if (attachments.length > 0) {
        const filesToUpload = attachments.filter(att => att.file);
        if (filesToUpload.length > 0) {
          try {
            await Promise.all(
              filesToUpload.map(att => projectStorageService.upload(project.id, att.file!))
            );
            toast.success(`${filesToUpload.length} file(s) uploaded successfully`);
          } catch (uploadError) {
            logger.error('Error uploading files:', uploadError);
            toast.warning('Project created but some files failed to upload');
          }
        }
      }

      // Add team members to the project (exclude creator — backend already adds them as admin)
      const membersToAdd = assignedMembers.filter(m => m.memberId !== currentUser?.id);
      if (membersToAdd.length > 0) {
        try {
          const memberData = membersToAdd.map(m => ({
            userId: m.memberId,
            role: m.role,
          }));
          await projectMembersService.addMembers(project.id, memberData);
        } catch (memberError) {
          logger.error('Error adding team members:', memberError);
          toast.warning('Project created but some team members could not be added');
        }
      }

      // Create project links
      if (links.length > 0) {
        try {
          await projectLinksService.createMany(
            project.id,
            links.map(l => ({ title: l.title, url: l.url }))
          );
        } catch (linkError) {
          logger.error('Error creating project links:', linkError);
          toast.warning('Project created but some links could not be saved');
        }
      }

      toast.success('Project created successfully!');
      navigate(`/projects/${project.id}`);
    } catch (error) {
      logger.error('Error creating project:', error);
      const message = error instanceof Error ? error.message : 'Failed to create project';
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const getMemberById = (id: string) => teamMembers.find(m => m.id === id);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "bg-priority-critical/10 text-priority-critical border-priority-critical/20";
      case "major": return "bg-priority-high/10 text-priority-high border-priority-high/20";
      case "minor": return "bg-priority-medium/10 text-priority-medium border-priority-medium/20";
      default: return "bg-priority-low/10 text-priority-low border-priority-low/20";
    }
  };

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/projects")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Create New Project</h1>
            {/* <p className="text-muted-foreground">Fill in the details to set up your new project</p> */}
          </div>
        </div>

        {/* Section 1: Basic Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Basic Details
            </CardTitle>
            <CardDescription>Enter the essential information about your project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0 text-xl"
                        title="Select project icon"
                      >
                        {projectEmoji}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3" align="start">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Smile className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Select Project Icon</span>
                        </div>
                        <div className="grid grid-cols-8 gap-1">
                          {projectEmojis.map((emoji) => (
                            <Button
                              key={emoji}
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-8 w-8 text-lg hover:bg-primary/10",
                                projectEmoji === emoji && "bg-primary/20 ring-1 ring-primary"
                              )}
                              onClick={() => {
                                setProjectEmoji(emoji);
                                setIsEmojiPickerOpen(false);
                              }}
                            >
                              {emoji}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Input
                    id="projectName"
                    placeholder="Enter project name"
                    value={projectName}
                    maxLength={100}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectType">Project Type <span className="text-destructive">*</span></Label>
                <Select value={projectType} onValueChange={setProjectType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project type" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectStage">Project Stage <span className="text-destructive">*</span></Label>
                <Select value={projectStage} onValueChange={setProjectStage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectStages.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectDescription">Project Description <span className="text-destructive">*</span></Label>
              <div className="space-y-1">
                <Textarea
                  id="projectDescription"
                  placeholder="Describe your project goals, scope, and key deliverables..."
                  value={projectDescription}
                  maxLength={1000}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  rows={4}
                />
                <div className="flex justify-end">
                  <span className={cn(
                    "text-[10px] tabular-nums",
                    projectDescription.length >= 1000 ? "text-destructive font-medium" : "text-muted-foreground"
                  )}>
                    {projectDescription.length}/1000
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date <span className="text-destructive">*</span></Label>
                <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Select start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        setStartDate(date);
                        if (date && expectedEndDate && isBefore(expectedEndDate, date)) {
                          setExpectedEndDate(undefined);
                        }
                        setIsStartDateOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Expected Completion Date <span className="text-destructive">*</span></Label>
                <Popover open={isExpectedEndDateOpen} onOpenChange={setIsExpectedEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !expectedEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expectedEndDate ? format(expectedEndDate, "PPP") : "Select end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expectedEndDate}
                      onSelect={(date) => {
                        setExpectedEndDate(date);
                        setIsExpectedEndDateOpen(false);
                      }}
                      disabled={(date) => (startDate ? isBefore(date, startDate) : false)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Optional Details Toggle */}
            <Separator className="my-4" />
            <Button
              variant="ghost"
              className="w-full justify-between"
              onClick={() => setShowOptionalDetails(!showOptionalDetails)}
            >
              <span className="text-muted-foreground">Optional Details (Client Info & Notes)</span>
              {showOptionalDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showOptionalDetails && (
              <div className="space-y-4 pt-2">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input
                      id="clientName"
                      placeholder="Client name"
                      value={clientName}
                      maxLength={100}
                      onChange={(e) => setClientName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientOrg">Organisation Name</Label>
                    <Input
                      id="clientOrg"
                      placeholder="Organisation"
                      value={clientOrganization}
                      maxLength={100}
                      onChange={(e) => {
                        const filtered = e.target.value.replace(/[^a-zA-Z\s\-'.]/g, "");
                        setClientOrganization(filtered);
                        setClientOrgError(filtered !== e.target.value ? "Only letters and spaces are allowed" : "");
                      }}
                    />
                    {clientOrgError && <p className="text-xs text-destructive">{clientOrgError}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Number</Label>
                    <PhoneInput
                      value={clientContact}
                      onChange={(fullValue, error) => {
                        setClientContact(fullValue);
                        setClientContactError(error);
                      }}
                    />
                    {clientContactError && <p className="text-xs text-destructive">{clientContactError}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <div className="space-y-1">
                    <Textarea
                      id="notes"
                      placeholder="Any additional notes or comments..."
                      value={notes}
                      maxLength={2000}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end">
                      <span className={cn(
                        "text-[10px] tabular-nums",
                        notes.length >= 2000 ? "text-destructive font-medium" : "text-muted-foreground"
                      )}>
                        {notes.length}/2000
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Team Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Team Members
            </CardTitle>
            <CardDescription>Assign team members to this project and set their project role (defaults to Member)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Multi-select dropdown with checkboxes */}
            <Popover open={isMemberDropdownOpen} onOpenChange={(open) => { setIsMemberDropdownOpen(open); if (!open) setMemberSearch(""); }}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between font-normal"
                >
                  {assignedMembers.length > 0
                    ? `${assignedMembers.length} member${assignedMembers.length > 1 ? 's' : ''} selected`
                    : "Select team member"}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                <div className="p-2 border-b">
                  <Input
                    placeholder="Search members..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {teamMembers
                    .filter(m => m.id !== currentUser?.id)
                    .filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
                    .length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {memberSearch ? "No members match your search" : "No members available"}
                    </p>
                  ) : (
                    teamMembers
                      .filter(m => m.id !== currentUser?.id)
                      .filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
                      .map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleToggleMemberSelection(member.id)}
                        >
                          <Checkbox
                            checked={assignedMembers.some(am => am.memberId === member.id)}
                            onCheckedChange={() => handleToggleMemberSelection(member.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={member.avatar} />
                            <AvatarFallback className="text-xs">{member.initials}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{member.name}</span>
                        </div>
                      ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {assignedMembers.length > 0 && (
              <div className="space-y-2">
                {assignedMembers.map((assignment) => {
                  const member = getMemberById(assignment.memberId);
                  if (!member) return null;
                  const isCreator = assignment.memberId === currentUser?.id;
                  return (
                    <div
                      key={assignment.memberId}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback>{member.initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm flex items-center gap-2">
                            {member.name}
                            {isCreator && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">You · Creator</Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isCreator ? (
                          <Badge variant="outline" className="h-8 px-3 flex items-center text-xs font-normal">Admin</Badge>
                        ) : (
                          <>
                            <Select
                              value={assignment.role}
                              onValueChange={(v) => handleChangeAssignedMemberRole(assignment.memberId, v as ProjectRole)}
                            >
                              <SelectTrigger className="h-8 w-[120px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="maintainer">Maintainer</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveTeamMember(assignment.memberId)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {assignedMembers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No team members added yet</p>
                <p className="text-sm">Select members from the dropdown above to assign them</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Departments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Departments <span className="text-destructive">*</span>
            </CardTitle>
            <CardDescription>Select the departments involved in this project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  onClick={() => handleDepartmentToggle(dept.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all",
                    selectedDepartments.includes(dept.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <dept.icon className={cn(
                    "h-8 w-8",
                    selectedDepartments.includes(dept.id) ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className="text-sm font-medium text-center">{dept.name}</span>
                  {selectedDepartments.includes(dept.id) && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
              ))}

              {/* Custom Departments */}
              {customDepartments.map((dept) => (
                <div
                  key={dept.id}
                  onClick={() => handleDepartmentToggle(dept.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all relative group",
                    selectedDepartments.includes(dept.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => handleDeleteCustomDepartment(e, dept.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <dept.icon className={cn(
                    "h-8 w-8",
                    selectedDepartments.includes(dept.id) ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className="text-sm font-medium text-center">{dept.name}</span>
                  {selectedDepartments.includes(dept.id) && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
              ))}

              {/* Add Custom Department Button */}
              <Dialog open={isAddDeptOpen} onOpenChange={setIsAddDeptOpen}>
                <DialogTrigger asChild>
                  <div
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-border cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
                  >
                    <Plus className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm font-medium text-center text-muted-foreground">Add Custom</span>
                  </div>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Custom Department</DialogTitle>
                    <DialogDescription>
                      Create a new department for this project.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="dept-name">Department Name</Label>
                      <Input
                        id="dept-name"
                        placeholder="e.g., Marketing, Legal, etc."
                        value={newDeptName}
                        onChange={(e) => setNewDeptName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddCustomDepartment();
                        }}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDeptOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddCustomDepartment} disabled={!newDeptName.trim()}>Add Department</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Project Modules */}
        {/*<Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              Project Modules
            </CardTitle>
            <CardDescription>Define the functional modules for this project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="Module Name (e.g., User Authentication, Payment Gateway)"
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddModule();
                }}
              />
              <Button onClick={handleAddModule} disabled={!newModuleName.trim()}>
                {editingModuleId ? <Pencil className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                {editingModuleId ? "Update Module" : "Add Module"}
              </Button>
            </div>

            {modules.length > 0 ? (
              <div className="space-y-2">
                {modules.map((module) => (
                  <div
                    key={module.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <span className="font-medium text-sm">{module.name}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleEditModule(module)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveModule(module.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No modules added yet. Add modules to organize your project structure.
              </p>
            )}
          </CardContent>
        </Card>*/}

        {/* Section 5: Project Milestones */}
        {/*<Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-primary" />
              Project Milestones
            </CardTitle>
            <CardDescription>Set key milestones and their timelines</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4 items-end">
              <div className="md:col-span-2 space-y-1">
                <Label className="text-xs">Milestone Name</Label>
                <Input
                  placeholder="e.g., Alpha Release"
                  value={newMilestoneName}
                  onChange={(e) => setNewMilestoneName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Start Date</Label>
                <Popover open={isMilestoneStartOpen} onOpenChange={setIsMilestoneStartOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal text-xs h-10",
                        !newMilestoneStart && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {newMilestoneStart ? format(newMilestoneStart, "PPP") : "Start"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    {isMilestoneStartOpen && (
                      <Calendar
                        variant="dropdown"
                        mode="single"
                        month={milestoneStartCalendarMonth}
                        onMonthChange={setMilestoneStartCalendarMonth}
                        selected={newMilestoneStart}
                        onSelect={(date) => {
                          setNewMilestoneStart(date);
                          setIsMilestoneStartOpen(false);
                        }}
                        disabled={(date) =>
                          (startDate ? isBefore(date, startDate) : false) ||
                          (expectedEndDate ? isBefore(expectedEndDate, date) : false)
                        }
                        initialFocus
                      />
                    )}
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Date</Label>
                <Popover open={isMilestoneEndOpen} onOpenChange={setIsMilestoneEndOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal text-xs h-10",
                        !newMilestoneEnd && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {newMilestoneEnd ? format(newMilestoneEnd, "PPP") : "End"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    {isMilestoneEndOpen && (
                      <Calendar
                        variant="dropdown"
                        mode="single"
                        month={milestoneEndCalendarMonth}
                        onMonthChange={setMilestoneEndCalendarMonth}
                        selected={newMilestoneEnd}
                        onSelect={(date) => {
                          setNewMilestoneEnd(date);
                          setIsMilestoneEndOpen(false);
                        }}
                        disabled={(date) =>
                          (newMilestoneStart ? isBefore(date, newMilestoneStart) : false) ||
                          (startDate ? isBefore(date, startDate) : false) ||
                          (expectedEndDate ? isBefore(expectedEndDate, date) : false)
                        }
                        initialFocus
                      />
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleAddMilestone}
              disabled={!newMilestoneName.trim() || !newMilestoneStart || !newMilestoneEnd}
            >
              {editingMilestoneId ? <Pencil className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              {editingMilestoneId ? "Update Milestone" : "Add Milestone"}
            </Button>

            {milestones.length > 0 ? (
              <div className="space-y-2 mt-4">
                {milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div>
                      <p className="font-medium text-sm">{milestone.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {milestone.startDate && format(milestone.startDate, "MMM d, yyyy")} - {milestone.endDate && format(milestone.endDate, "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleEditMilestone(milestone)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveMilestone(milestone.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No milestones added yet. Define key milestones to track progress.
              </p>
            )}
          </CardContent>
        </Card> */}

        {/* Section 6: Storage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-primary" />
              Storage
            </CardTitle>
            <CardDescription>Manage project documents, files, and external links</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Files & Documents</Label>
                {attachments.length > 0 && (
                  <Badge variant="secondary">{attachments.length} file(s)</Badge>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.jpg,.jpeg,.png,.gif,.webp,.svg,.zip,.rar"
                className="hidden"
              />

              <div
                onClick={handleUploadClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer",
                  isDragOver
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                )}
              >
                <Upload className={cn(
                  "h-10 w-10 mx-auto mb-3 transition-colors",
                  isDragOver ? "text-primary" : "text-muted-foreground"
                )} />
                <p className="font-medium">
                  {isDragOver ? "Drop files here" : "Drop files here or click to upload"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports PDF, DOC, XLS, PPT, images, and archives (max 50MB each)
                </p>
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div
                        className="flex items-center gap-3 cursor-pointer min-w-0"
                        onClick={() => setPreviewFile(file)}
                      >
                        {previewUrls[file.id] && file.file?.type.startsWith('image/') ? (
                          <img
                            src={previewUrls[file.id]}
                            alt={file.name}
                            className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{file.size}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => setPreviewFile(file)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveAttachment(file.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <Label className="text-base font-medium">Project Links</Label>
              <div className="flex gap-3">
                <div className="grid gap-3 flex-1 md:grid-cols-2">
                  <Input
                    placeholder="Link Name (e.g., Figma Design)"
                    value={newLinkName}
                    onChange={(e) => setNewLinkName(e.target.value)}
                  />
                  <Input
                    placeholder="URL (e.g., https://...)"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    className={cn(newLinkUrl && !isLinkUrlValid && "border-destructive focus-visible:ring-destructive")}
                  />
                </div>
                <Button onClick={handleAddLink} disabled={!newLinkName || !newLinkUrl || !isLinkUrlValid}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Link
                </Button>
              </div>

              {links.length > 0 && (
                <div className="space-y-2">
                  {links.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Globe className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{link.title}</p>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary hover:underline flex items-center gap-1"
                          >
                            <LinkIcon className="h-3 w-3" />
                            {link.url}
                          </a>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveLink(link.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Task Import */}
        {/* <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-primary" />
              Task Import
            </CardTitle>
            <CardDescription>
              Upload an Excel or document file to automatically extract and create tasks for your Kanban board
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!taskDocument ? (
              <div
                onClick={handleTaskDocumentUpload}
                className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">Upload task list document</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports Excel (.xlsx, .xls) and CSV files
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{taskDocument.name}</p>
                      <p className="text-xs text-muted-foreground">{taskDocument.size}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setTaskDocument(null);
                      setExtractedTasks([]);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {isProcessing ? (
                  <div className="text-center py-8">
                    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-muted-foreground">Processing document and extracting tasks...</p>
                  </div>
                ) : extractedTasks.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{extractedTasks.length} tasks extracted</p>
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                        Ready for Kanban
                      </Badge>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {extractedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox className="mt-1" defaultChecked />
                            <div>
                              <p className="font-medium text-sm">{task.title}</p>
                              <p className="text-xs text-muted-foreground">{task.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn("text-xs capitalize", getPriorityColor(task.priority))}
                            >
                              {task.priority}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveTask(task.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card> */}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" onClick={() => navigate("/projects")}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateProject}
            disabled={
              !projectName.trim()
              || !projectType.trim()
              || !projectDescription.trim()
              || !startDate
              || !expectedEndDate
              || isCreating
              || !currentOrganization
              || selectedDepartments.length === 0
            }
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Project'
            )}
          </Button>
        </div>

        {/* File Preview Dialog */}
        <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
          <DialogContent className={cn(previewFile?.file?.type === 'application/pdf' ? "max-w-4xl" : "max-w-2xl")}>
            <DialogHeader>
              <DialogTitle className="truncate pr-6">{previewFile?.name}</DialogTitle>
              <DialogDescription>{previewFile?.size}</DialogDescription>
            </DialogHeader>
            {previewFile && previewUrls[previewFile.id] && previewFile.file?.type.startsWith('image/') ? (
              <img
                src={previewUrls[previewFile.id]}
                alt={previewFile.name}
                className="max-h-[70vh] w-full object-contain rounded-lg bg-muted/30"
              />
            ) : previewFile && previewUrls[previewFile.id] && previewFile.file?.type === 'application/pdf' ? (
              <iframe
                src={previewUrls[previewFile.id]}
                title={previewFile.name}
                className="h-[75vh] w-full rounded-lg border"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                <FileText className="h-16 w-16" />
                <p className="text-sm">Preview not available for this file type</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmation.isOpen} onOpenChange={(open) => {
          if (!open) setDeleteConfirmation({ isOpen: false, type: null, id: null });
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this {deleteConfirmation.type}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmation({ isOpen: false, type: null, id: null })}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default NewProject;
