import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    ArrowLeft,
    AlertTriangle,
    CalendarIcon,
    FileText,
    Loader2,
    Smile,
    Paperclip,
    Link as LinkIcon,
    Plus,
    X,
    Upload,
    Building2,
    Users,
    Wrench,
    Smartphone,
    Settings,
    Zap,
    Cpu,
    FlaskConical,
    Factory,
    BookOpen,
    Flag,
    Target,
    Pencil,
    Trash2,
    Check,
    Globe,
    ChevronDown,
    ChevronUp,
    Palette,
    Eye,
    EyeOff,
    GripVertical,
    LayoutGrid
} from "lucide-react";
import { format, isBefore, startOfMonth } from "date-fns";
import { cn, isValidPhoneNumber } from "@/lib/utils";
import { PhoneInput } from "@/components/ui/phone-input";
import { toast } from "sonner";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectModules } from "@/hooks/useProjectDetail";
import { useProjectMilestones } from "@/hooks/useMilestones";
import { useUpdateProject, useUpdateProjectStage, useProject, useDeleteProject } from "@/hooks/useProjects";
import { useOrganizationMembers, useProjectMembers } from "@/hooks/useProjectTeam";
import { useProjectPermissions } from "@/hooks/useProjectPermissions";
import { useProjectAttachments, useDeleteAttachment } from "@/hooks/useProjectAttachments";
import { useProjectLinks, useCreateProjectLink, useUpdateProjectLink, useDeleteProjectLink } from "@/hooks/useProjectLinks";
import { projectStorageService } from "@/services/projectStorage.service";
import { resolveFileUrl } from "@/utils/fileUrl";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import { modulesService } from "@/services/modules.service";
import { milestonesService } from "@/services/milestones.service";
import { projectMembersService } from "@/services/projectMembers.service";
import { chatService } from "@/services/chat.service";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { logger } from '@/services/monitoring/logger';
import type { ProjectRole, ProjectTabConfig } from "@/types";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_PROJECT_TAB_CONFIG, PROJECT_TAB_DEFINITIONS, resolveProjectTabConfig } from "./projectTabsConfig";

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

const projectStagesList = [
    { value: "concept", label: "Concept" },
    { value: "design", label: "Design" },
    { value: "development", label: "Development" },
    { value: "testing", label: "Testing" },
    { value: "production", label: "Production" },
];

const departmentsList = [
    { id: "design", name: "Design", icon: Palette },
    { id: "hardware", name: "Hardware", icon: Wrench },
    { id: "software", name: "Software", icon: Smartphone },
    { id: "mechanical", name: "Mechanical", icon: Settings },
    { id: "electrical", name: "Electrical", icon: Zap },
    { id: "firmware", name: "Firmware", icon: Cpu },
    { id: "testing", name: "Testing & QA", icon: FlaskConical },
    { id: "manufacturing", name: "Manufacturing", icon: Factory },
    { id: "documentation", name: "Documentation", icon: BookOpen },
];

interface ProjectLink {
    id: string;
    title: string;
    /** @deprecated use title */
    name?: string;
    url: string;
}

interface TeamMemberAssignment {
    memberId: string;
    role: ProjectRole;
    name?: string;
    avatar?: string;
}

interface Department {
    id: string;
    name: string;
    icon: React.ElementType;
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
const projectStages = [
    { value: "concept", label: "Concept" },
    { value: "design", label: "Design" },
    { value: "development", label: "Development" },
    { value: "testing", label: "Testing" },
    { value: "production", label: "Production" },
];

const projectEmojis = [
    "📁", "📂", "🚀", "💡", "⚡", "🎯", "🔧", "⚙️", "🛠️", "💻",
    "📱", "🖥️", "🔌", "🔋", "📡", "🛰️", "🤖", "🧠", "🔬", "🧪",
    "📊", "📈", "📉", "🎨", "🎬", "🎮", "🏗️", "🏭", "🌐", "🔐",
    "✨", "🌟", "⭐", "💎", "🏆", "🎖️", "🥇", "🎁", "📦", "🗃️"
];

/** Normalizes a loosely-typed TeamMember.role (or missing role) to a ProjectRole. */
const toProjectRole = (role: string | undefined | null): ProjectRole => {
    const normalized = (role || "").toLowerCase();
    if (normalized === "admin" || normalized === "maintainer") return normalized;
    return "member";
};

const EditProject = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { id } = useParams();
    const { user } = useAuth();
    const { currentOrganization } = useOrganization();
    const updateProjectMutation = useUpdateProject();
    const updateProjectStageMutation = useUpdateProjectStage();
    const deleteProjectMutation = useDeleteProject();
    const { data: orgMembers = [] } = useOrganizationMembers(currentOrganization?.id);
    const { data: projectMembers = [] } = useProjectMembers(id);
    const {
        canManageMembers,
        canManageProjectSettings,
        isProjectMaintainerPlus,
    } = useProjectPermissions(id);

    // Fetch project data
    const { data: project, isLoading, error } = useProject(id);
    // Modules and milestones are not included in the project payload — they live behind their own endpoints.
    const { data: projectModulesData = [] } = useProjectModules(id);
    const { data: projectMilestonesData = [] } = useProjectMilestones(id || '');
    const { data: projectAttachments = [] } = useProjectAttachments(id);
    const { data: projectLinks = [] } = useProjectLinks(id);

    // Mutations
    const deleteAttachmentMutation = useDeleteAttachment();
    const createLinkMutation = useCreateProjectLink();
    const updateLinkMutation = useUpdateProjectLink();
    const deleteLinkMutation = useDeleteProjectLink();

    // Form state
    const [projectName, setProjectName] = useState("");
    const [projectDescription, setProjectDescription] = useState("");
    const [projectType, setProjectType] = useState("");
    const [projectStage, setProjectStage] = useState("");
    const [projectEmoji, setProjectEmoji] = useState("📁");
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [startDate, setStartDate] = useState<Date>();
    const [targetDate, setTargetDate] = useState<Date>();
    const [isStartDateOpen, setIsStartDateOpen] = useState(false);
    const [isTargetDateOpen, setIsTargetDateOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

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
    const [selectedMember, setSelectedMember] = useState("");
    const [selectedMemberRole, setSelectedMemberRole] = useState<ProjectRole>("member");
    const [memberRoleUpdatingId, setMemberRoleUpdatingId] = useState<string | null>(null);

    // Departments
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
    const [customDepartments, setCustomDepartments] = useState<Department[]>([]);
    const [newDeptName, setNewDeptName] = useState("");
    const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);

    // Tabs: per-project order + visibility of the project detail page's section tabs
    const [tabConfig, setTabConfig] = useState<ProjectTabConfig[]>(DEFAULT_PROJECT_TAB_CONFIG);

    // Modules
    const [modules, setModules] = useState<ProjectModule[]>([]);
    const [newModuleName, setNewModuleName] = useState("");
    const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
    const [editingModuleName, setEditingModuleName] = useState("");

    // Milestones
    const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
    const [newMilestoneName, setNewMilestoneName] = useState("");
    const [newMilestoneStart, setNewMilestoneStart] = useState<Date>();
    const [newMilestoneEnd, setNewMilestoneEnd] = useState<Date>();
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

    // Inline milestone editing (edit-in-place on the list item)
    const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
    const [editingMilestoneName, setEditingMilestoneName] = useState("");
    const [editingMilestoneStart, setEditingMilestoneStart] = useState<Date>();
    const [editingMilestoneEnd, setEditingMilestoneEnd] = useState<Date>();
    const [isEditMilestoneStartOpen, setIsEditMilestoneStartOpen] = useState(false);
    const [isEditMilestoneEndOpen, setIsEditMilestoneEndOpen] = useState(false);
    const [editMilestoneStartCalendarMonth, setEditMilestoneStartCalendarMonth] = useState<Date>(() =>
        startOfMonth(new Date())
    );
    const [editMilestoneEndCalendarMonth, setEditMilestoneEndCalendarMonth] = useState<Date>(() =>
        startOfMonth(new Date())
    );

    useLayoutEffect(() => {
        if (isEditMilestoneStartOpen) {
            setEditMilestoneStartCalendarMonth(
                startOfMonth(editingMilestoneStart ?? startDate ?? new Date())
            );
        }
    }, [isEditMilestoneStartOpen, editingMilestoneStart, startDate]);

    useLayoutEffect(() => {
        if (isEditMilestoneEndOpen) {
            setEditMilestoneEndCalendarMonth(
                startOfMonth(editingMilestoneEnd ?? editingMilestoneStart ?? startDate ?? new Date())
            );
        }
    }, [isEditMilestoneEndOpen, editingMilestoneEnd, editingMilestoneStart, startDate]);

    // Links state
    const [newLinkName, setNewLinkName] = useState("");
    const [newLinkUrl, setNewLinkUrl] = useState("");
    const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
    const [editingLinkName, setEditingLinkName] = useState("");
    const [editingLinkUrl, setEditingLinkUrl] = useState("");

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
    const [deleteInProgress, setDeleteInProgress] = useState(false);
    const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
    const [deleteProjectConfirmText, setDeleteProjectConfirmText] = useState("");
    const [chatRemovalPrompt, setChatRemovalPrompt] = useState<{
        open: boolean;
        memberIds: string[];
    }>({
        open: false,
        memberIds: [],
    });
    const [hiddenAttachmentIds, setHiddenAttachmentIds] = useState<Set<string>>(new Set());
    const visibleProjectAttachments = useMemo(
        () => projectAttachments.filter((attachment: any) => !hiddenAttachmentIds.has(attachment.id)),
        [projectAttachments, hiddenAttachmentIds]
    );

    const confirmDelete = async () => {
        const { type, id } = deleteConfirmation;
        if (!type || id == null || id === '') return;

        setDeleteInProgress(true);
        try {
        if (type === 'module') {
            const exists = modules.some(m => m.id === id);
            if (!exists) {
                toast.error('Module not found');
                setDeleteConfirmation({ isOpen: false, type: null, id: null });
                return;
            }
            setModules(modules.filter(m => m.id !== id));
            if (editingModuleId === id) {
                setEditingModuleId(null);
                setEditingModuleName("");
            }
        } else if (type === 'milestone') {
            const exists = milestones.some(m => m.id === id);
            if (!exists) {
                toast.error('Milestone not found');
                setDeleteConfirmation({ isOpen: false, type: null, id: null });
                return;
            }
            setMilestones(milestones.filter(m => m.id !== id));
            if (editingMilestoneId === id) {
                setEditingMilestoneId(null);
                setEditingMilestoneName("");
                setEditingMilestoneStart(undefined);
                setEditingMilestoneEnd(undefined);
            }
        } else if (type === 'attachment') {
            try {
                await deleteAttachmentMutation.mutateAsync(id);
                setHiddenAttachmentIds((prev) => {
                    const next = new Set(prev);
                    next.add(id);
                    return next;
                });
            } catch (err) {
                toast.error('Failed to delete attachment');
            }
        } else if (type === 'link') {
            const projectId = project?.id; // Assuming `id` from useParams is the projectId
            if (projectId) {
                try {
                    await deleteLinkMutation.mutateAsync({ linkId: id, projectId: projectId });
                } catch (err) {
                    toast.error('Failed to delete link');
                }
            }
        }

        setDeleteConfirmation({ isOpen: false, type: null, id: null });
        } finally {
            setDeleteInProgress(false);
        }
    };

    // File upload state
    const [isUploading, setIsUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [previewFile, setPreviewFile] = useState<any>(null);

    // Member management (add/remove/change role) is Admin-only.
    const canManageProjectMembers = canManageMembers;

    const isProjectOwner = useMemo(() => {
        if (!project?.createdBy || !user?.id) return false;
        return project.createdBy === user.id;
    }, [project?.createdBy, user?.id]);

    // This page conflates "rename/settings" and "stage" edits into a single
    // form gated by one early-return (see the `!canEditProject` guard below).
    // Splitting them would require restructuring the page into two
    // independently-gated sections; instead we gate page access with the
    // broader isProjectMaintainerPlus (Maintainers can change stage/status)
    // and disable the Admin-only fields (name, type, departments, members,
    // dates, optional details) individually via canManageProjectSettings.
    const canEditProject = isProjectMaintainerPlus;

    const handleAddModule = () => {
        if (newModuleName.trim()) {
            setModules([...modules, { id: Math.random().toString(36).substr(2, 9), name: newModuleName.trim() }]);
            setNewModuleName("");
        }
    };

    const handleEditModule = (module: ProjectModule) => {
        setEditingModuleId(module.id);
        setEditingModuleName(module.name);
    };

    const handleSaveModuleEdit = () => {
        if (editingModuleName.trim() && editingModuleId) {
            setModules(modules.map(m => m.id === editingModuleId ? { ...m, name: editingModuleName.trim() } : m));
        }
        setEditingModuleId(null);
        setEditingModuleName("");
    };

    const handleCancelModuleEdit = () => {
        setEditingModuleId(null);
        setEditingModuleName("");
    };

    const handleRemoveModule = (id: string) => {
        setDeleteConfirmation({ isOpen: true, type: 'module', id });
    };

    const handleAddMilestone = () => {
        if (newMilestoneName.trim() && newMilestoneStart && newMilestoneEnd) {
            setMilestones([
                ...milestones,
                {
                    id: Math.random().toString(36).substr(2, 9),
                    name: newMilestoneName.trim(),
                    startDate: newMilestoneStart,
                    endDate: newMilestoneEnd
                }
            ]);
            setNewMilestoneName("");
            setNewMilestoneStart(undefined);
            setNewMilestoneEnd(undefined);
        }
    };

    const handleEditMilestone = (milestone: ProjectMilestone) => {
        setEditingMilestoneId(milestone.id);
        setEditingMilestoneName(milestone.name);
        setEditingMilestoneStart(milestone.startDate);
        setEditingMilestoneEnd(milestone.endDate);
    };

    const handleSaveMilestoneEdit = () => {
        if (!editingMilestoneId) return;
        if (editingMilestoneName.trim() && editingMilestoneStart && editingMilestoneEnd) {
            setMilestones(milestones.map(m => m.id === editingMilestoneId ? {
                ...m,
                name: editingMilestoneName.trim(),
                startDate: editingMilestoneStart,
                endDate: editingMilestoneEnd
            } : m));
            setEditingMilestoneId(null);
            setEditingMilestoneName("");
            setEditingMilestoneStart(undefined);
            setEditingMilestoneEnd(undefined);
        }
    };

    const handleCancelMilestoneEdit = () => {
        setEditingMilestoneId(null);
        setEditingMilestoneName("");
        setEditingMilestoneStart(undefined);
        setEditingMilestoneEnd(undefined);
    };

    const handleRemoveMilestone = (id: string) => {
        setDeleteConfirmation({ isOpen: true, type: 'milestone', id });
    };

    const handleAddTeamMember = () => {
        if (!canManageProjectMembers) {
            toast.error('Only a project Admin can add or remove members');
            return;
        }

        if (selectedMember) {
            const exists = assignedMembers.find(m => m.memberId === selectedMember);
            if (!exists) {
                const memberObj = orgMembers.find(m => m.id === selectedMember);
                setAssignedMembers([...assignedMembers, {
                    memberId: selectedMember,
                    role: selectedMemberRole,
                    name: memberObj?.name,
                    avatar: memberObj?.avatar
                }]);
                setSelectedMember("");
                setSelectedMemberRole("member");
            } else {
                toast.error("Member already assigned");
            }
        }
    };

    const handleUpdateAssignedMemberRole = async (memberId: string, role: ProjectRole) => {
        if (!canManageProjectMembers) return;

        // For members already persisted in the DB, call the update-role endpoint
        // directly and invalidate the project-members query. For members only
        // staged locally (not yet saved via handleSave), just update local state.
        const isPersisted = projectMembers.some((m) => m.id === memberId);
        setAssignedMembers((prev) => prev.map((m) => (m.memberId === memberId ? { ...m, role } : m)));

        if (isPersisted && id) {
            setMemberRoleUpdatingId(memberId);
            try {
                await projectMembersService.updateRole(id, memberId, role);
                await queryClient.invalidateQueries({ queryKey: ['project-members', id] });
                toast.success('Member role updated');
            } catch (err) {
                logger.error('[handleUpdateAssignedMemberRole] Failed to update role', { projectId: id, memberId, error: err });
                toast.error('Failed to update member role');
            } finally {
                setMemberRoleUpdatingId(null);
            }
        }
    };

    const handleRemoveTeamMember = (memberId: string) => {
        if (!canManageProjectMembers) {
            toast.error('Only a project Admin can add or remove members');
            return;
        }

        setAssignedMembers(assignedMembers.filter(m => m.memberId !== memberId));
    };

    const handleDepartmentToggle = (departmentId: string) => {
        setSelectedDepartments(prev =>
            prev.includes(departmentId)
                ? prev.filter(d => d !== departmentId)
                : [...prev, departmentId]
        );
    };

    const handleTabVisibilityToggle = (tabId: ProjectTabConfig['id']) => {
        setTabConfig(prev =>
            prev.map(t => t.id === tabId ? { ...t, visible: !t.visible } : t)
        );
    };

    const handleTabDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const reordered = Array.from(tabConfig);
        const [moved] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, moved);
        setTabConfig(reordered.map((t, index) => ({ ...t, order: index })));
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

    // Initialize form with project data
    useEffect(() => {
        if (project) {
            setProjectName(project.name || "");
            setProjectDescription(project.description || "");
            setProjectType(project.type || "");
            setProjectStage(project.stage || "concept");
            setProjectEmoji(project.icon || "📁");
            if (project.startDate) {
                setStartDate(new Date(project.startDate));
            }
            if (project.targetDate) {
                setTargetDate(new Date(project.targetDate));
            }

            // Populating optional details
            setClientName(project.clientName || "");
            setClientOrganization(project.clientOrganization || "");
            setClientContact(project.clientContact || "");
            setNotes(project.notes || "");

            // Populating departments
            if (project.departments) {
                setSelectedDepartments(project.departments);
                // Identifying custom departments
                const customDepts = project.departments.filter(dId => !departmentsList.find(d => d.id === dId));
                if (customDepts.length > 0) {
                    setCustomDepartments(customDepts.map(dId => ({
                        id: dId,
                        name: dId.startsWith('custom-') ? dId.split('-')[1] : dId, // Fallback naming
                        icon: Building2
                    })));
                }
            }

            // Populating tab order/visibility
            setTabConfig(resolveProjectTabConfig(project.tabConfig));

        }
    }, [project]);

    // Populate modules from the dedicated project-modules endpoint (the project payload doesn't include them)
    useEffect(() => {
        setModules(projectModulesData.map(m => ({
            id: m.id,
            name: m.name,
        })));
    }, [projectModulesData]);

    // Populate milestones from the dedicated project-milestones endpoint (the project payload doesn't include them)
    useEffect(() => {
        setMilestones(projectMilestonesData.map(m => ({
            id: m.id,
            name: m.name,
            startDate: undefined,
            endDate: m.due_date ? new Date(m.due_date) : undefined,
        })));
    }, [projectMilestonesData]);

    // Populate team members from the dedicated project members endpoint
    useEffect(() => {
        if (projectMembers.length > 0) {
            setAssignedMembers(projectMembers.map(m => ({
                memberId: m.id,
                role: toProjectRole(m.role),
                name: m.name,
                avatar: m.avatar,
            })));
        }
    }, [projectMembers]);

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getAttachmentMimeType = (attachment: any): string => {
        const mime = attachment?.mimeType || attachment?.mime_type;
        if (mime) return mime;
        const name: string = attachment?.file_name || attachment?.fileName || '';
        const ext = name.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') return 'application/pdf';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return `image/${ext}`;
        return '';
    };
    const isImageAttachment = (attachment: any) => getAttachmentMimeType(attachment).startsWith('image/');

    const handleFileUpload = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0 || !id) return;

        setIsUploading(true);
        const errors: string[] = [];

        try {
            for (const file of Array.from(files)) {
                if (file.size > 50 * 1024 * 1024) {
                    errors.push(`${file.name}: File too large (max 50MB)`);
                    continue;
                }

                try {
                    await projectStorageService.upload(id, file);
                } catch (err) {
                    errors.push(`${file.name}: Upload failed`);
                }
            }

            queryClient.invalidateQueries({ queryKey: ['project-attachments', id] });

            if (errors.length > 0) {
                toast.error('Some files failed to upload', { description: errors.join('\n') });
            } else {
                toast.success('Files uploaded successfully');
            }
        } finally {
            setIsUploading(false);
        }
    }, [id, queryClient]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFileUpload(e.dataTransfer.files);
    }, [handleFileUpload]);

    const handleAddLink = async () => {
        if (!newLinkName || !newLinkUrl || !id) return;

        try {
            await createLinkMutation.mutateAsync({
                project_id: id,
                title: newLinkName,
                url: newLinkUrl,
            });
            setNewLinkName("");
            setNewLinkUrl("");
            toast.success('Link added successfully');
        } catch (err) {
            toast.error('Failed to add link');
        }
    };

    const handleEditLink = (link: any) => {
        setEditingLinkId(link.id);
        setEditingLinkName(link.title || link.name || "");
        setEditingLinkUrl(link.url || "");
    };

    const handleCancelLinkEdit = () => {
        setEditingLinkId(null);
        setEditingLinkName("");
        setEditingLinkUrl("");
    };

    const handleSaveLinkEdit = async () => {
        if (!editingLinkName || !editingLinkUrl || !editingLinkId || !id) return;

        try {
            await updateLinkMutation.mutateAsync({
                linkId: editingLinkId,
                projectId: id,
                input: { title: editingLinkName, url: editingLinkUrl },
            });
            handleCancelLinkEdit();
        } catch (err) {
            toast.error('Failed to update link');
        }
    };

    const handleDeleteAttachment = (attachmentId: string) => {
        setDeleteConfirmation({ isOpen: true, type: 'attachment', id: attachmentId });
    };

    const handleDeleteLink = (linkId: string) => {
        setDeleteConfirmation({ isOpen: true, type: 'link', id: linkId });
    };

    const handleDeleteProject = async () => {
        if (!project?.id) return;
        if (!isProjectOwner) {
            toast.error("Only the project owner can delete this project.");
            return;
        }
        if (deleteProjectConfirmText.trim() !== project.name) {
            toast.error("Project name does not match.");
            return;
        }

        try {
            await deleteProjectMutation.mutateAsync(project.id);
            toast.success("Project deleted successfully");
            setDeleteProjectDialogOpen(false);
            setDeleteProjectConfirmText("");
            navigate("/projects");
        } catch (error) {
            logger.error("Error deleting project:", error);
            const errorMessage = error instanceof Error ? error.message : "";
            if (errorMessage.toLowerCase().includes("access denied")) {
                toast.error("Only the project owner can delete this project.");
            } else {
                toast.error("Failed to delete project");
            }
        }
    };

    const executeSave = async (removeFromChatToo: boolean) => {
        if (!id || !project) return;

        if (newMilestoneName.trim() || newMilestoneStart || newMilestoneEnd) {
            toast.error("You have an unsaved milestone. Please click 'Add Milestone' or clear the inputs.");
            return;
        }
        if (editingMilestoneId) {
            toast.error("You have an unsaved milestone edit. Please save or cancel it first.");
            return;
        }
        if (newModuleName.trim()) {
            toast.error("You have an unsaved module. Please click 'Add Module' or clear the input.");
            return;
        }
        if (editingModuleId) {
            toast.error("You have an unsaved module edit. Please save or cancel it first.");
            return;
        }
        if (newLinkName.trim() || newLinkUrl.trim()) {
            toast.error("You have an unsaved project link. Please click 'Add Link' or clear the inputs.");
            return;
        }

        setIsSaving(true);
        try {
            // A Maintainer (not Admin) can only change Stage on this page — the
            // general update endpoint is Admin-only, so route stage-only saves
            // through the dedicated Maintainer-accessible stage endpoint instead.
            if (!canManageProjectSettings && isProjectMaintainerPlus) {
                await updateProjectStageMutation.mutateAsync({ id, stage: projectStage });
            } else {
                await updateProjectMutation.mutateAsync({
                    id,
                    updates: {
                        name: projectName,
                        description: projectDescription,
                        type: projectType,
                        stage: projectStage as any,
                        icon: projectEmoji,
                        startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
                        targetDate: targetDate ? format(targetDate, 'yyyy-MM-dd') : undefined,
                        clientName: clientName || undefined,
                        clientOrganization: clientOrganization || undefined,
                        clientContact: clientContact || undefined,
                        notes: notes || undefined,
                        departments: selectedDepartments,
                        tabConfig,
                    },
                });
            }

            // Sync team members (authorization must be enforced server-side)
            const isValidUuidLike = (value: unknown): value is string => {
                if (typeof value !== 'string') return false;
                return (
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
                    /^[0-9a-f]{32}$/i.test(value)
                );
            };

            // Guard against invalid/empty IDs reaching the backend mutation calls.
            if (!isValidUuidLike(project.id)) {
                toast.error('Invalid project id');
                return;
            }

            const currentInDbIds = projectMembers.map((m) => m.id).filter(isValidUuidLike);
            const assignedIds = assignedMembers.map((m) => m.memberId).filter(isValidUuidLike);

            // Members to add
            const newMembers = assignedMembers.filter(
                (m) => isValidUuidLike(m.memberId) && !currentInDbIds.includes(m.memberId)
            );
            // Members to remove
            const removedMemberIds = currentInDbIds.filter((memberId) => !assignedIds.includes(memberId));

            if (newMembers.length > 0) {
                try {
                    const memberData = newMembers.map(m => ({
                        userId: m.memberId,
                        role: m.role,
                    }));
                    await projectMembersService.addMembers(project.id, memberData);
                } catch (memberError) {
                    logger.error('[executeSave] Error adding team members', {
                        projectId: id,
                        userIds: newMembers.map(m => m.memberId),
                        error: memberError,
                    });
                    const message = memberError instanceof Error ? memberError.message : 'Failed to add project members';
                    toast.warning(`Project updated, but failed to add ${newMembers.length} member(s)`, { description: message });
                }
            }

            if (removedMemberIds.length > 0) {
                try {
                    if (!removeFromChatToo) {
                        await chatService.retainProjectChatMembershipAfterRemoval(project.id, removedMemberIds);
                    }

                    await projectMembersService.removeMembers(project.id, removedMemberIds);

                    if (removeFromChatToo) {
                        try {
                            await chatService.forceRemoveProjectChatMembers(project.id, removedMemberIds);
                        } catch (chatError) {
                            logger.error('[executeSave] Chat member removal failed', {
                                projectId: id,
                                userIds: removedMemberIds,
                                error: chatError,
                            });
                            const message = chatError instanceof Error ? chatError.message : 'Failed to remove members from project chat';
                            toast.warning(
                                `Removed ${removedMemberIds.length} member(s) from project, but could not update project chat`,
                                { description: message }
                            );
                        }
                    }
                } catch (memberError) {
                    logger.error('[executeSave] Error removing team members', {
                        projectId: id,
                        userIds: removedMemberIds,
                        error: memberError,
                    });
                    const message = memberError instanceof Error ? memberError.message : 'Failed to remove project members';
                    toast.warning(`Project updated, but failed to remove ${removedMemberIds.length} member(s)`, { description: message });
                }
            }

            // Sync Modules
            try {
                const initialModules = projectModulesData || [];
                const initialModuleIds = initialModules.map(m => m.id);
                const currentModuleIds = modules.map(m => m.id);

                // Modules to add
                const modulesToAdd = modules.filter(m => !initialModuleIds.includes(m.id));
                // Modules to remove
                const moduleIdsToRemove = initialModuleIds.filter(id => !currentModuleIds.includes(id));
                // Modules to update
                const modulesToUpdate = modules.filter(m => {
                    const initial = initialModules.find(im => im.id === m.id);
                    return initial && initial.name !== m.name;
                });

                if (modulesToAdd.length > 0) {
                    await modulesService.createMany(modulesToAdd.map(m => ({
                        project_id: id,
                        name: m.name,
                        module_type: 'software' as any,
                    })));
                }

                if (modulesToUpdate.length > 0) {
                    if (modulesService.updateMany) {
                        await modulesService.updateMany(modulesToUpdate.map(m => ({ id: m.id, name: m.name })));
                    } else {
                        await Promise.all(modulesToUpdate.map(m =>
                            modulesService.update(m.id, { name: m.name })
                        ));
                    }
                }

                if (moduleIdsToRemove.length > 0) {
                    await modulesService.deleteMany(moduleIdsToRemove);
                }
            } catch (moduleError) {
                logger.error('Error syncing modules:', moduleError);
                toast.warning('Project updated but module changes failed to sync');
            }

            // Sync Milestones
            try {
                const initialMilestones = projectMilestonesData || [];
                const initialMilestoneIds = initialMilestones.map(m => m.id);
                const currentMilestoneIds = milestones.map(m => m.id);

                // Milestones to add
                const milestonesToAdd = milestones.filter(m => !initialMilestoneIds.includes(m.id));
                // Milestones to remove
                const milestoneIdsToRemove = initialMilestoneIds.filter(id => !currentMilestoneIds.includes(id));
                // Milestones to update
                const milestonesToUpdate = milestones.filter(m => {
                    const initial = initialMilestones.find(im => im.id === m.id);
                    if (!initial) return false;
                    const initialDate = initial.due_date ? format(new Date(initial.due_date), 'yyyy-MM-dd') : null;
                    const currentDate = m.endDate ? format(m.endDate, 'yyyy-MM-dd') : null;
                    return initial.name !== m.name || initialDate !== currentDate;
                });

                if (milestonesToAdd.length > 0) {
                    await milestonesService.createMany(milestonesToAdd.map(m => ({
                        project_id: id,
                        name: m.name,
                        due_date: m.endDate ? format(m.endDate, 'yyyy-MM-dd') : null,
                    })));
                }

                if (milestonesToUpdate.length > 0) {
                    await milestonesService.updateMany(milestonesToUpdate.map(m => ({
                        id: m.id,
                        name: m.name,
                        due_date: m.endDate ? format(m.endDate, 'yyyy-MM-dd') : null,
                    })));
                }

                if (milestoneIdsToRemove.length > 0) {
                    await milestonesService.deleteMany(milestoneIdsToRemove);
                }
            } catch (milestoneError) {
                logger.error('Error syncing milestones:', milestoneError);
                toast.warning('Project updated but milestone changes failed to sync');
            }

            // Invalidate queries to ensure project detail page reflects all changes
            await queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id) });
            await queryClient.invalidateQueries({ queryKey: queryKeys.modules.list(id) });
            await queryClient.invalidateQueries({ queryKey: queryKeys.milestones.all });

            toast.success('Project updated successfully!');
            navigate(`/projects/${id}`);
        } catch (error) {
            logger.error('Error updating project:', error);
            toast.error('Failed to update project');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (!id || !project) return;

        if (!projectName.trim()) {
            toast.error('Project name is required');
            return;
        }

        if (!startDate) {
            toast.error('Start date is required');
            return;
        }

        if (!targetDate) {
            toast.error('Target date is required');
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

        const currentInDbIds = projectMembers.map((m) => m.id);
        const assignedIds = assignedMembers.map(m => m.memberId);
        const removedMemberIds = currentInDbIds.filter(memberId => !assignedIds.includes(memberId));

        if (canManageProjectMembers && removedMemberIds.length > 0) {
            setChatRemovalPrompt({
                open: true,
                memberIds: removedMemberIds,
            });
            return;
        }

        await executeSave(false);
    };

    if (isLoading) {
        return (
            <>
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10" />
                        <Skeleton className="h-8 w-48" />
                    </div>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-4 w-64" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <div className="grid grid-cols-2 gap-4">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </>
        );
    }

    if (error || !project) {
        return (
            <>
                <div className="flex flex-col items-center justify-center h-[60vh]">
                    <h2 className="text-xl font-medium">Project not found</h2>
                    <p className="text-muted-foreground mt-2">
                        The project you are trying to edit does not exist.
                    </p>
                    <Button className="mt-4" onClick={() => navigate('/projects')}>
                        Back to Projects
                    </Button>
                </div>
            </>
        );
    }

    if (!canEditProject) {
        return (
            <>
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground" />
                    <h2 className="text-xl font-medium">Access Denied</h2>
                    <p className="text-muted-foreground text-center max-w-sm">
                        You don't have permission to edit this project. Only a project Admin or Maintainer can make changes.
                    </p>
                    <Button onClick={() => navigate(`/projects/${id}`)}>
                        Back to Project
                    </Button>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/projects/${id}`)}
                            className="shrink-0"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-2xl font-semibold text-foreground truncate">Edit Project</h1>
                            <p className="text-muted-foreground text-sm truncate">{project.name}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <Button variant="outline" onClick={() => navigate(`/projects/${id}`)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || selectedDepartments.length === 0}>
                            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </div>

                {/* Basic Details */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Basic Details
                        </CardTitle>
                        <CardDescription>Update the project information</CardDescription>
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
                                                disabled={!canManageProjectSettings}
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
                                        disabled={!canManageProjectSettings}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="projectType">Project Type <span className="text-destructive">*</span></Label>
                                <Select value={projectType} onValueChange={setProjectType} disabled={!canManageProjectSettings}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projectTypes.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="projectStage">Project Stage <span className="text-destructive">*</span></Label>
                                {/* Stage is editable by Maintainer+ (not settings-gated) — page access itself is already gated by isProjectMaintainerPlus */}
                                <Select value={projectStage} onValueChange={setProjectStage}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select stage" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projectStages.map((stage) => (
                                            <SelectItem key={stage.value} value={stage.value}>
                                                {stage.label}
                                            </SelectItem>
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
                                    placeholder="Describe your project..."
                                    value={projectDescription}
                                    maxLength={1000}
                                    onChange={(e) => setProjectDescription(e.target.value)}
                                    rows={4}
                                    disabled={!canManageProjectSettings}
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
                                            disabled={!canManageProjectSettings}
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
                                                setIsStartDateOpen(false);
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <Label>Target Date <span className="text-destructive">*</span></Label>
                                <Popover open={isTargetDateOpen} onOpenChange={setIsTargetDateOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !targetDate && "text-muted-foreground"
                                            )}
                                            disabled={!canManageProjectSettings}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {targetDate ? format(targetDate, "PPP") : "Select target date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={targetDate}
                                            onSelect={(date) => {
                                                setTargetDate(date);
                                                setIsTargetDateOpen(false);
                                            }}
                                            disabled={(date) => (startDate ? isBefore(date, startDate) : false)}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Optional Details Toggle */}
                <div className="flex justify-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowOptionalDetails(!showOptionalDetails)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                    >
                        {showOptionalDetails ? (
                            <>
                                <ChevronUp className="h-4 w-4 mr-2" />
                                Hide Optional Details
                            </>
                        ) : (
                            <>
                                <ChevronDown className="h-4 w-4 mr-2" />
                                Show Optional Details (Client, Notes)
                            </>
                        )}
                    </Button>
                </div>

                {/* Optional Details */}
                {showOptionalDetails && (
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-primary" />
                                Optional Details
                            </CardTitle>
                            <CardDescription>Client information and project notes</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="clientName">Client Name</Label>
                                    <Input
                                        id="clientName"
                                        placeholder="e.g. John Doe"
                                        value={clientName}
                                        maxLength={100}
                                        onChange={(e) => setClientName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="clientOrg">Client Organization</Label>
                                    <Input
                                        id="clientOrg"
                                        placeholder="e.g. Acme Corp"
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
                            <div className="space-y-2">
                                <Label htmlFor="notes">Internal Project Notes</Label>
                                <div className="space-y-1">
                                    <Textarea
                                        id="notes"
                                        placeholder="Any additional information..."
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
                        </CardContent>
                    </Card>
                )}

                {/* Departments Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            Project Departments <span className="text-destructive">*</span>
                        </CardTitle>
                        <CardDescription>Select which departments are involved in this project</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {departmentsList.map((dept) => {
                                const Icon = dept.icon;
                                const isSelected = selectedDepartments.includes(dept.id);
                                return (
                                    <Button
                                        key={dept.id}
                                        variant={isSelected ? "default" : "outline"}
                                        className={cn(
                                            "h-auto py-3 px-4 flex flex-col items-center gap-2 transition-all",
                                            isSelected ? "ring-2 ring-primary ring-offset-2" : "hover:border-primary/50"
                                        )}
                                        onClick={() => handleDepartmentToggle(dept.id)}
                                    >
                                        <Icon className={cn("h-6 w-6", isSelected ? "text-primary-foreground" : "text-primary")} />
                                        <span className="text-xs font-medium">{dept.name}</span>
                                    </Button>
                                );
                            })}

                            {/* Custom Departments */}
                            {customDepartments.map((dept) => {
                                const Icon = dept.icon;
                                const isSelected = selectedDepartments.includes(dept.id);
                                return (
                                    <Button
                                        key={dept.id}
                                        variant={isSelected ? "default" : "outline"}
                                        className={cn(
                                            "h-auto py-3 px-4 flex flex-col items-center gap-2 transition-all group",
                                            isSelected ? "ring-2 ring-primary ring-offset-2" : "hover:border-primary/50"
                                        )}
                                        onClick={() => handleDepartmentToggle(dept.id)}
                                    >
                                        <Icon className={cn("h-6 w-6", isSelected ? "text-primary-foreground" : "text-primary")} />
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs font-medium truncate max-w-[80px]">{dept.name}</span>
                                            <X
                                                className="h-3 w-3 text-muted-foreground hover:text-destructive shrink-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCustomDepartments(customDepartments.filter(d => d.id !== dept.id));
                                                    setSelectedDepartments(selectedDepartments.filter(d => d !== dept.id));
                                                }}
                                            />
                                        </div>
                                    </Button>
                                );
                            })}

                            {/* Add Custom Department Button */}
                            <Dialog open={isAddDeptOpen} onOpenChange={setIsAddDeptOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-auto py-3 px-4 flex flex-col items-center gap-2 border-dashed hover:border-primary hover:bg-primary/5"
                                    >
                                        <Plus className="h-6 w-6 text-muted-foreground" />
                                        <span className="text-xs font-medium">Add Other</span>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add Custom Department</DialogTitle>
                                        <DialogDescription>
                                            Enter the name of the department you want to add to this project.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <Label htmlFor="newDeptName">Department Name</Label>
                                        <Input
                                            id="newDeptName"
                                            placeholder="e.g. Finance, Marketing..."
                                            value={newDeptName}
                                            onChange={(e) => setNewDeptName(e.target.value)}
                                            className="mt-2"
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddCustomDepartment()}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsAddDeptOpen(false)}>Cancel</Button>
                                        <Button onClick={handleAddCustomDepartment}>Add Department</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardContent>
                </Card>

                {/* Project Tabs Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <LayoutGrid className="h-5 w-5 text-primary" />
                            Project Tabs
                        </CardTitle>
                        <CardDescription>
                            Drag to reorder the tabs shown on this project, or hide the ones this project doesn't need
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <DragDropContext onDragEnd={handleTabDragEnd}>
                            <Droppable droppableId="project-tabs">
                                {(provided) => (
                                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                                        {tabConfig.map((tab, index) => {
                                            const def = PROJECT_TAB_DEFINITIONS[tab.id];
                                            const Icon = def.icon;
                                            return (
                                                <Draggable
                                                    key={tab.id}
                                                    draggableId={tab.id}
                                                    index={index}
                                                    isDragDisabled={!canManageProjectSettings}
                                                >
                                                    {(dragProvided, snapshot) => (
                                                        <div
                                                            ref={dragProvided.innerRef}
                                                            {...dragProvided.draggableProps}
                                                            className={cn(
                                                                "flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors",
                                                                snapshot.isDragging && "shadow-md border-primary/50",
                                                                !tab.visible && "opacity-60"
                                                            )}
                                                        >
                                                            <span
                                                                {...dragProvided.dragHandleProps}
                                                                className={cn(
                                                                    "text-muted-foreground shrink-0",
                                                                    canManageProjectSettings ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-50"
                                                                )}
                                                            >
                                                                <GripVertical className="h-4 w-4" />
                                                            </span>
                                                            <Icon className="h-4 w-4 text-primary shrink-0" />
                                                            <span className="flex-1 text-sm font-medium">{def.label}</span>
                                                            {tab.visible ? (
                                                                <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                                                            ) : (
                                                                <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
                                                            )}
                                                            <Switch
                                                                checked={tab.visible}
                                                                onCheckedChange={() => handleTabVisibilityToggle(tab.id)}
                                                                disabled={!canManageProjectSettings}
                                                            />
                                                        </div>
                                                    )}
                                                </Draggable>
                                            );
                                        })}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                        {tabConfig.every(t => !t.visible) && (
                            <p className="text-xs text-destructive mt-2">At least one tab should stay visible.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Team Members Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            Project Team
                        </CardTitle>
                        <CardDescription>
                            {canManageProjectMembers
                                ? 'Assign team members to this project and set their project role'
                                : 'Only a project Admin can manage team members and roles'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {canManageProjectMembers && (
                            <div className="flex flex-col md:flex-row gap-3">
                                <div className="flex-1 space-y-2">
                                    <Label>Member</Label>
                                    <Select value={selectedMember} onValueChange={setSelectedMember}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select member" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {orgMembers.map((member: any) => (
                                                <SelectItem key={member.id} value={member.id}>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarImage src={member.avatar} />
                                                            <AvatarFallback>{member.name?.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        {member.name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-full md:w-40 space-y-2">
                                    <Label>Project Role</Label>
                                    <Select value={selectedMemberRole} onValueChange={(v) => setSelectedMemberRole(v as ProjectRole)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="maintainer">Maintainer</SelectItem>
                                            <SelectItem value="member">Member</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    className="md:mt-8"
                                    onClick={handleAddTeamMember}
                                    disabled={!selectedMember}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add
                                </Button>
                            </div>
                        )}

                        {assignedMembers.length > 0 && (
                            <div className="space-y-3 pt-4 border-t">
                                <Label>Assigned Members</Label>
                                <div className="grid gap-3">
                                    {assignedMembers.map((assignment) => {
                                        const member = orgMembers.find((m: any) => m.id === assignment.memberId);
                                        const displayName = member?.name || assignment.name || "Unknown Member";
                                        const displayAvatar = member?.avatar || assignment.avatar;
                                        return (
                                            <div key={assignment.memberId} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={displayAvatar} />
                                                        <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm font-medium">{displayName}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {canManageProjectMembers ? (
                                                        <Select
                                                            value={assignment.role}
                                                            onValueChange={(v) => handleUpdateAssignedMemberRole(assignment.memberId, v as ProjectRole)}
                                                            disabled={memberRoleUpdatingId === assignment.memberId}
                                                        >
                                                            <SelectTrigger className="h-7 w-[110px] text-[11px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="admin">Admin</SelectItem>
                                                                <SelectItem value="maintainer">Maintainer</SelectItem>
                                                                <SelectItem value="member">Member</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        assignment.role && (
                                                            <Badge variant="secondary" className="text-[10px] h-4 capitalize">
                                                                {assignment.role}
                                                            </Badge>
                                                        )
                                                    )}
                                                    {canManageProjectMembers && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRemoveTeamMember(assignment.memberId)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Modules Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-primary" />
                            Project Modules
                        </CardTitle>
                        <CardDescription>Break down the project into logical modules</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Module name (e.g. PCB Design, UI Components)"
                                value={newModuleName}
                                onChange={(e) => setNewModuleName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddModule()}
                            />
                            <Button onClick={handleAddModule} disabled={!newModuleName.trim()}>
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                            </Button>
                        </div>

                        {modules.length > 0 && (
                            <ScrollArea className={modules.length > 5 ? "h-[280px] pr-2" : ""}>
                            <div className="grid gap-2 pt-2">
                                {modules.map((module) => {
                                    const isEditing = editingModuleId === module.id;
                                    return (
                                        <div key={module.id} className="flex items-center justify-between p-3 rounded-md border group">
                                            <div className="flex items-center gap-3 flex-1">
                                                <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center p-0 shrink-0">
                                                    {modules.indexOf(module) + 1}
                                                </Badge>
                                                {isEditing ? (
                                                    <Input
                                                        autoFocus
                                                        value={editingModuleName}
                                                        onChange={(e) => setEditingModuleName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveModuleEdit();
                                                            if (e.key === 'Escape') handleCancelModuleEdit();
                                                        }}
                                                        className="h-8"
                                                    />
                                                ) : (
                                                    <span className="text-sm font-medium">{module.name}</span>
                                                )}
                                            </div>
                                            <div className={`flex gap-1 ${isEditing ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                                                {isEditing ? (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSaveModuleEdit} disabled={!editingModuleName.trim()}>
                                                            <Check className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancelModuleEdit}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditModule(module)}>
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveModule(module.id)}>
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>

                {/* Milestones Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Flag className="h-5 w-5 text-primary" />
                            Project Milestones
                        </CardTitle>
                        <CardDescription>Key targets and schedule for this project</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <Input
                                placeholder="Milestone name (e.g. Design Freeze, Prototype V1)"
                                value={newMilestoneName}
                                onChange={(e) => setNewMilestoneName(e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Popover open={isMilestoneStartOpen} onOpenChange={setIsMilestoneStartOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !newMilestoneStart && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-3 w-3" />
                                            {newMilestoneStart ? format(newMilestoneStart, "PP") : "Start"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        {isMilestoneStartOpen && (
                                            <Calendar
                                                mode="single"
                                                month={milestoneStartCalendarMonth}
                                                onMonthChange={setMilestoneStartCalendarMonth}
                                                selected={newMilestoneStart}
                                                onSelect={(date) => {
                                                    setNewMilestoneStart(date);
                                                    setIsMilestoneStartOpen(false);
                                                }}
                                            />
                                        )}
                                    </PopoverContent>
                                </Popover>
                                <Popover open={isMilestoneEndOpen} onOpenChange={setIsMilestoneEndOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !newMilestoneEnd && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-3 w-3" />
                                            {newMilestoneEnd ? format(newMilestoneEnd, "PP") : "End"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        {isMilestoneEndOpen && (
                                            <Calendar
                                                mode="single"
                                                month={milestoneEndCalendarMonth}
                                                onMonthChange={setMilestoneEndCalendarMonth}
                                                selected={newMilestoneEnd}
                                                onSelect={(date) => {
                                                    setNewMilestoneEnd(date);
                                                    setIsMilestoneEndOpen(false);
                                                }}
                                                disabled={(date) =>
                                                    newMilestoneStart ? isBefore(date, newMilestoneStart) : false
                                                }
                                            />
                                        )}
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <Button className="w-full" variant="secondary" onClick={handleAddMilestone} disabled={!newMilestoneName.trim() || !newMilestoneStart || !newMilestoneEnd}>
                                Add Milestone
                            </Button>
                        </div>

                        {milestones.length > 0 && (
                            <div className="grid gap-3 pt-2">
                                {milestones.map((ms) => {
                                    const isEditing = editingMilestoneId === ms.id;
                                    if (isEditing) {
                                        return (
                                            <div key={ms.id} className="space-y-2 p-3 rounded-md border-l-4 border-l-primary bg-muted/30">
                                                <Input
                                                    autoFocus
                                                    value={editingMilestoneName}
                                                    onChange={(e) => setEditingMilestoneName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveMilestoneEdit();
                                                        if (e.key === 'Escape') handleCancelMilestoneEdit();
                                                    }}
                                                    className="h-8"
                                                />
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Popover open={isEditMilestoneStartOpen} onOpenChange={setIsEditMilestoneStartOpen}>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !editingMilestoneStart && "text-muted-foreground")}>
                                                                <CalendarIcon className="mr-2 h-3 w-3" />
                                                                {editingMilestoneStart ? format(editingMilestoneStart, "PP") : "Start"}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0">
                                                            {isEditMilestoneStartOpen && (
                                                                <Calendar
                                                                    mode="single"
                                                                    month={editMilestoneStartCalendarMonth}
                                                                    onMonthChange={setEditMilestoneStartCalendarMonth}
                                                                    selected={editingMilestoneStart}
                                                                    onSelect={(date) => {
                                                                        setEditingMilestoneStart(date);
                                                                        setIsEditMilestoneStartOpen(false);
                                                                    }}
                                                                />
                                                            )}
                                                        </PopoverContent>
                                                    </Popover>
                                                    <Popover open={isEditMilestoneEndOpen} onOpenChange={setIsEditMilestoneEndOpen}>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !editingMilestoneEnd && "text-muted-foreground")}>
                                                                <CalendarIcon className="mr-2 h-3 w-3" />
                                                                {editingMilestoneEnd ? format(editingMilestoneEnd, "PP") : "End"}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0">
                                                            {isEditMilestoneEndOpen && (
                                                                <Calendar
                                                                    mode="single"
                                                                    month={editMilestoneEndCalendarMonth}
                                                                    onMonthChange={setEditMilestoneEndCalendarMonth}
                                                                    selected={editingMilestoneEnd}
                                                                    onSelect={(date) => {
                                                                        setEditingMilestoneEnd(date);
                                                                        setIsEditMilestoneEndOpen(false);
                                                                    }}
                                                                    disabled={(date) =>
                                                                        editingMilestoneStart ? isBefore(date, editingMilestoneStart) : false
                                                                    }
                                                                />
                                                            )}
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSaveMilestoneEdit} disabled={!editingMilestoneName.trim() || !editingMilestoneStart || !editingMilestoneEnd}>
                                                        <Check className="h-3 w-3" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancelMilestoneEdit}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={ms.id} className="flex items-center justify-between p-3 rounded-md border-l-4 border-l-primary bg-muted/30">
                                            <div className="space-y-1">
                                                <p className="text-sm font-semibold">{ms.name}</p>
                                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                                    <div className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {ms.startDate ? format(ms.startDate, "PP") : ""}</div>
                                                    <div className="flex items-center gap-1"><Target className="h-3 w-3" /> {ms.endDate ? format(ms.endDate, "PP") : ""}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditMilestone(ms)}><Pencil className="h-3 w-3" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveMilestone(ms.id)}><Trash2 className="h-3 w-3" /></Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Attachments */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Paperclip className="h-5 w-5 text-primary" />
                            Attachments
                        </CardTitle>
                        <CardDescription>Manage project files and documents</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* File Upload Zone */}
                        <div
                            role="button"
                            tabIndex={0}
                            aria-label="Upload attachments"
                            className={cn(
                                "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                                isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                                isUploading && "opacity-50 pointer-events-none"
                            )}
                            onClick={() => fileInputRef.current?.click()}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    fileInputRef.current?.click();
                                }
                            }}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={(e) => handleFileUpload(e.target.files)}
                            />
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground mb-2">
                                Drag and drop files here, or{" "}
                                <button
                                    type="button"
                                    className="text-primary hover:underline"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    browse
                                </button>
                            </p>
                            <p className="text-xs text-muted-foreground">Max file size: 50MB</p>
                        </div>

                        {/* Existing Attachments */}
                        {visibleProjectAttachments.length > 0 && (
                            <div className="space-y-2">
                                <Label>Current Attachments</Label>
                                <div className="space-y-2">
                                    {visibleProjectAttachments.map((attachment: any) => {
                                        const previewUrl = resolveFileUrl(attachment.url || attachment.fileUrl) ?? (attachment.url || attachment.fileUrl);
                                        return (
                                        <div
                                            key={attachment.id}
                                            className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                                        >
                                            <div
                                                className="flex items-center gap-2 min-w-0 cursor-pointer"
                                                onClick={() => previewUrl && setPreviewFile(attachment)}
                                            >
                                                {previewUrl && isImageAttachment(attachment) ? (
                                                    <img
                                                        src={previewUrl}
                                                        alt={attachment.file_name || attachment.fileName}
                                                        className="h-8 w-8 rounded object-cover shrink-0"
                                                    />
                                                ) : (
                                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                                )}
                                                <span className="text-sm truncate hover:underline text-foreground" title={previewUrl ? "Click to preview" : undefined}>
                                                    {attachment.file_name || attachment.fileName}
                                                </span>
                                                <span className="text-xs text-muted-foreground shrink-0">
                                                    ({formatFileSize(attachment.file_size ?? attachment.fileSize ?? 0)})
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {previewUrl && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => setPreviewFile(attachment)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleDeleteAttachment(attachment.id)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Links */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <LinkIcon className="h-5 w-5 text-primary" />
                            Project Links
                        </CardTitle>
                        <CardDescription>Add external links related to this project</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Add New Link */}
                        <div className="flex gap-2">
                            <Input
                                placeholder="Link name"
                                value={newLinkName}
                                onChange={(e) => setNewLinkName(e.target.value)}
                                className="flex-1"
                            />
                            <Input
                                placeholder="URL"
                                value={newLinkUrl}
                                onChange={(e) => setNewLinkUrl(e.target.value)}
                                className="flex-1"
                            />
                            <Button onClick={handleAddLink} disabled={!newLinkName || !newLinkUrl}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Existing Links */}
                        {projectLinks.length > 0 && (
                            <div className="space-y-2">
                                {projectLinks.map((link: any) => {
                                    const isEditingLink = editingLinkId === link.id;
                                    return (
                                        <div
                                            key={link.id}
                                            className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50"
                                        >
                                            {isEditingLink ? (
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <Input
                                                        autoFocus
                                                        value={editingLinkName}
                                                        onChange={(e) => setEditingLinkName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveLinkEdit();
                                                            if (e.key === 'Escape') handleCancelLinkEdit();
                                                        }}
                                                        className="h-8 flex-1"
                                                        placeholder="Link name"
                                                    />
                                                    <Input
                                                        value={editingLinkUrl}
                                                        onChange={(e) => setEditingLinkUrl(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveLinkEdit();
                                                            if (e.key === 'Escape') handleCancelLinkEdit();
                                                        }}
                                                        className="h-8 flex-1"
                                                        placeholder="URL"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <span className="text-sm font-medium">{link.title || link.name}</span>
                                                    <a
                                                        href={link.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-primary hover:underline truncate max-w-[200px]"
                                                    >
                                                        {link.url}
                                                    </a>
                                                </div>
                                            )}
                                            <div className="flex gap-1 shrink-0">
                                                {isEditingLink ? (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={handleSaveLinkEdit}
                                                            disabled={!editingLinkName.trim() || !editingLinkUrl.trim()}
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={handleCancelLinkEdit}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => handleEditLink(link)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => handleDeleteLink(link.id)}
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
                    </CardContent>
                </Card>

                {/* File Preview Dialog */}
                {previewFile && (() => {
                    const rawUrl = previewFile.url || previewFile.fileUrl;
                    const url = resolveFileUrl(rawUrl) ?? rawUrl;
                    return (
                        <FilePreviewDialog
                            file={{
                                url,
                                fileName: previewFile.file_name || previewFile.fileName || 'Untitled file',
                                mimeType: getAttachmentMimeType(previewFile) || undefined,
                            }}
                            onClose={() => setPreviewFile(null)}
                        />
                    );
                })()}

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
                            <Button variant="outline" onClick={() => setDeleteConfirmation({ isOpen: false, type: null, id: null })} disabled={deleteInProgress}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={confirmDelete} disabled={deleteInProgress}>
                                {deleteInProgress ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Deleting...
                                    </>
                                ) : (
                                    'Delete'
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Project member removal chat prompt */}
                <Dialog
                    open={chatRemovalPrompt.open}
                    onOpenChange={(open) => {
                        if (!open && !isSaving) {
                            setChatRemovalPrompt({ open: false, memberIds: [] });
                        }
                    }}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Remove from group chat too?</DialogTitle>
                            <DialogDescription>
                                {chatRemovalPrompt.memberIds.length === 1
                                    ? 'This member will be removed from the project. Should they also be removed from the project group chat, or kept in that chat?'
                                    : 'These members will be removed from the project. Should they also be removed from the project group chat, or kept in that chat?'}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setChatRemovalPrompt({ open: false, memberIds: [] })}
                                disabled={isSaving}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={async () => {
                                    setChatRemovalPrompt({ open: false, memberIds: [] });
                                    await executeSave(false);
                                }}
                                disabled={isSaving}
                            >
                                No, keep in chat
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={async () => {
                                    setChatRemovalPrompt({ open: false, memberIds: [] });
                                    await executeSave(true);
                                }}
                                disabled={isSaving}
                            >
                                Yes, remove from chat
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
};

export default EditProject;
