import React, { useEffect, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import {
  Plus,
  GripVertical,
  Trash2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Image as ImageIcon,
  Video,
  FileAudio,
  Type,
  MoreHorizontal,
  Upload,
  Loader2,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { assistantService } from '@/services/assistant.service';
import { resolveFileUrl } from '@/utils/fileUrl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandInput
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type BlockType = 'text' | 'h1' | 'h2' | 'h3' | 'bullet' | 'number' | 'check' | 'image' | 'video' | 'audio';

export interface EditorBlock {
  id: string;
  type: BlockType;
  content: string;
  caption?: string;
  checked?: boolean; // For checklist items
}

interface SlashBlockEditorProps {
  initialBlocks?: EditorBlock[];
  onChange?: (blocks: EditorBlock[]) => void;
  readOnly?: boolean;
}

const BLOCK_TYPES: { type: BlockType; label: string; icon: LucideIcon }[] = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'h1', label: 'Heading 1', icon: Heading1 },
  { type: 'h2', label: 'Heading 2', icon: Heading2 },
  { type: 'h3', label: 'Heading 3', icon: Heading3 },
  { type: 'bullet', label: 'Bullet List', icon: List },
  { type: 'number', label: 'Numbered List', icon: ListOrdered },
  { type: 'check', label: 'Checklist', icon: CheckSquare },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'video', label: 'Video', icon: Video },
  { type: 'audio', label: 'Audio', icon: FileAudio },
];

const withFallbackBlock = (blocks?: EditorBlock[]): EditorBlock[] =>
  blocks && blocks.length > 0
    ? blocks
    : [{ id: 'block-' + Date.now(), type: 'text', content: '' }];

export function SlashBlockEditor({ initialBlocks, onChange, readOnly = false }: SlashBlockEditorProps) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => withFallbackBlock(initialBlocks));
  const [, setFocusedBlockId] = useState<string | null>(null);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [activeBlockIdForMenu, setActiveBlockIdForMenu] = useState<string | null>(null);
  // Blocks with a file upload in flight — the dropzone shows a spinner
  // instead of the "Choose File" controls until the real, persisted URL
  // comes back (see handleFileSelect/handleFileDrop below).
  const [uploadingBlockIds, setUploadingBlockIds] = useState<Set<string>>(new Set());

  // The editor keeps its own copy of the blocks, so a caller that swaps
  // `initialBlocks` out from under it (seeding the editor from the plain
  // description when Advanced Editor is switched on, or reloading the record)
  // would otherwise be ignored. Adopt any array that isn't the one we last
  // emitted — comparing by reference, so echoes of our own onChange (the
  // caller storing the array we just handed it) never clobber what's typed.
  const lastEmittedRef = useRef<EditorBlock[] | undefined>(initialBlocks);
  useEffect(() => {
    if (initialBlocks === lastEmittedRef.current) return;
    lastEmittedRef.current = initialBlocks;
    setBlocks(withFallbackBlock(initialBlocks));
  }, [initialBlocks]);

  // Focus a specific block by ID
  const focusBlock = (id: string) => {
    setFocusedBlockId(id);
    // Needed to wait for render
    setTimeout(() => {
      const element = document.getElementById(`editor-block-${id}`);
      if (element) {
        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
          element.focus();
          // Set cursor to end
          element.setSelectionRange(element.value.length, element.value.length);
        }
      }
    }, 10);
  };

  const updateBlocks = (newBlocks: EditorBlock[]) => {
    lastEmittedRef.current = newBlocks;
    setBlocks(newBlocks);
    onChange?.(newBlocks);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const items = Array.from(blocks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    updateBlocks(items);
  };

  const addBlock = (afterId: string, type: BlockType = 'text') => {
    const newBlock: EditorBlock = {
      id: `block-${Date.now()}-${Math.random()}`,
      type,
      content: '',
      checked: type === 'check' ? false : undefined
    };

    const index = blocks.findIndex(b => b.id === afterId);
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    updateBlocks(newBlocks);
    focusBlock(newBlock.id);
  };

  const updateBlock = (id: string, updates: Partial<EditorBlock>) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, ...updates } : b);
    updateBlocks(newBlocks);
  };

  const deleteBlock = (id: string) => {
    if (blocks.length <= 1) return; // Prevent deleting last block
    const index = blocks.findIndex(b => b.id === id);
    const newBlocks = blocks.filter(b => b.id !== id);
    updateBlocks(newBlocks);

    if (activeBlockIdForMenu === id) {
      setActiveBlockIdForMenu(null);
      setSlashMenuOpen(false);
    }

    // Focus previous block
    if (index > 0) {
      focusBlock(newBlocks[index - 1].id);
    } else if (newBlocks.length > 0) {
      focusBlock(newBlocks[0].id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, block: EditorBlock) => {
    if (readOnly) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      // If menu is open, let it handle Enter (handled by command list usually, but here we might need to close it if not handled)
      if (slashMenuOpen) return;

      // Auto-continue list logic
      if (['bullet', 'number', 'check'].includes(block.type)) {
        if (block.content.trim() === '') {
          // Empty list item -> convert to text to exit list mode
          updateBlock(block.id, { type: 'text', checked: undefined });
          return;
        } else {
          // Continue list
          addBlock(block.id, block.type);
          return;
        }
      }

      addBlock(block.id, 'text');
    }

    if (e.key === 'Backspace' && block.content === '') {
      e.preventDefault();
      deleteBlock(block.id);
    }

    if (e.key === '/') {
      // Just let it type, usage of slash is detected in onChange
    }
  };

  const handleContentChange = (id: string, content: string) => {
    updateBlock(id, { content });

    // Check for slash command
    if (content === '/') {
      setActiveBlockIdForMenu(id);
      setSlashMenuOpen(true);
    } else if (slashMenuOpen) {
      setSlashMenuOpen(false);
    }
  };

  const handleBlockTypeSelect = (type: BlockType) => {
    if (activeBlockIdForMenu) {
      updateBlock(activeBlockIdForMenu, { type, content: '' }); // Clear the slash
      setSlashMenuOpen(false);
      setActiveBlockIdForMenu(null);
      focusBlock(activeBlockIdForMenu);
    }
  };

  // Actually uploads the file to server storage and stores the returned
  // serve: key — never URL.createObjectURL(file), which produces a blob:
  // URL that only ever resolves inside the tab that created it. That blob
  // survived in `content` well enough to render for the uploader in the
  // same session, which is exactly what made it look like it worked; saved
  // to the record and reopened by anyone else (or the same user later), the
  // blob: URL is meaningless and the block just shows a broken image.
  const uploadBlockFile = async (id: string, file: File) => {
    setUploadingBlockIds((prev) => new Set(prev).add(id));
    try {
      const uploaded = await assistantService.uploadAttachment(file);
      updateBlock(id, { content: uploaded.fileUrl });
    } catch {
      toast.error('Failed to upload file');
    } finally {
      setUploadingBlockIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleFileSelect = (id: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadBlockFile(id, file);
  };

  const handleFileDrop = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadBlockFile(id, file);
  };

  // Recalculates a block textarea's height from its actual content, not just
  // on the keystroke that grew it. Passed as `ref` (an inline function, so
  // React re-invokes it on every render) rather than a useEffect, because a
  // row whose content arrived via initialBlocks on load, a slash-command
  // insert, or a paste never fires the textarea's own `input` DOM event —
  // the onInput handlers below only catch live typing. Without this, such a
  // row stayed stuck at its one-line height while wrapped content overflowed
  // into the textarea's native scrollbar, whose tiny step buttons show up
  // right next to the block's icon/checkbox and read as a rendering glitch.
  const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const renderBlockContent = (block: EditorBlock, blockIndex: number) => {
    switch (block.type) {
      case 'text':
        return (
          <Textarea
            ref={autoResizeTextarea}
            id={`editor-block-${block.id}`}
            value={block.content}
            onChange={(e) => handleContentChange(block.id, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, block)}
            className="min-h-[24px] h-auto resize-none border-none shadow-none focus-visible:ring-0 p-0 text-base overflow-hidden bg-transparent"
            placeholder="Type '/' for commands"
            readOnly={readOnly}
            rows={1}
            onInput={(e) => {
              // Auto-resize
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
            }}
          />
        );
      case 'h1':
        return (
          <Input
            id={`editor-block-${block.id}`}
            value={block.content}
            onChange={(e) => handleContentChange(block.id, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, block)}
            className="text-3xl font-bold border-none shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent"
            placeholder="Heading 1"
            readOnly={readOnly}
          />
        );
      case 'h2':
        return (
          <Input
            id={`editor-block-${block.id}`}
            value={block.content}
            onChange={(e) => handleContentChange(block.id, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, block)}
            className="text-2xl font-semibold border-none shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent"
            placeholder="Heading 2"
            readOnly={readOnly}
          />
        );
      case 'h3':
        return (
          <Input
            id={`editor-block-${block.id}`}
            value={block.content}
            onChange={(e) => handleContentChange(block.id, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, block)}
            className="text-xl font-medium border-none shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent"
            placeholder="Heading 3"
            readOnly={readOnly}
          />
        );
      case 'bullet':
        return (
          <div className="flex gap-2 items-start w-full">
            <span className="text-2xl leading-[1.5rem]">•</span>
            <Textarea
              ref={autoResizeTextarea}
              id={`editor-block-${block.id}`}
              value={block.content}
              onChange={(e) => handleContentChange(block.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, block)}
              className="min-h-[24px] flex-1 resize-none border-none shadow-none focus-visible:ring-0 p-0 text-base overflow-hidden bg-transparent"
              placeholder="List item"
              readOnly={readOnly}
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
          </div>
        );
      case 'number': {
        let num = 1;
        for (let i = blockIndex - 1; i >= 0; i--) {
          if (blocks[i].type === 'number') {
            num++;
          } else {
            break;
          }
        }
        return (
          <div className="flex gap-2 items-start w-full">
            <span className="font-medium mt-0.5">{num}.</span>
            <Textarea
              ref={autoResizeTextarea}
              id={`editor-block-${block.id}`}
              value={block.content}
              onChange={(e) => handleContentChange(block.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, block)}
              className="min-h-[24px] flex-1 resize-none border-none shadow-none focus-visible:ring-0 p-0 text-base overflow-hidden bg-transparent"
              placeholder="Numbered item"
              readOnly={readOnly}
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
          </div>
        );
      }
      case 'check':
        return (
          <div className="flex gap-2 items-start w-full group">
            <div
              className={cn(
                "w-5 h-5 border rounded mt-0.5 flex items-center justify-center cursor-pointer transition-colors",
                block.checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground hover:border-primary"
              )}
              onClick={() => !readOnly && updateBlock(block.id, { checked: !block.checked })}
            >
              {block.checked && <CheckSquare className="w-3 h-3" />}
            </div>
            <Textarea
              ref={autoResizeTextarea}
              id={`editor-block-${block.id}`}
              value={block.content}
              onChange={(e) => handleContentChange(block.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, block)}
              className={cn(
                "min-h-[24px] flex-1 resize-none border-none shadow-none focus-visible:ring-0 p-0 text-base overflow-hidden bg-transparent transition-all",
                block.checked && "line-through text-muted-foreground"
              )}
              placeholder="To-do item"
              readOnly={readOnly}
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
          </div>
        );
      case 'image':
      case 'video':
      case 'audio': {
        const isUploading = uploadingBlockIds.has(block.id);
        // block.content is a serve: key for anything actually uploaded (see
        // uploadBlockFile) or a plain http(s) URL for the "paste URL"
        // fallback below — resolveFileUrl handles both, passing http(s)
        // straight through and only translating the serve: form.
        const mediaSrc = resolveFileUrl(block.content) ?? block.content;
        return (
          <div
            className={cn(
              "w-full p-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 group relative transition-colors",
              !block.content ? "bg-muted/20 hover:bg-muted/30" : "border-transparent p-0"
            )}
            onDrop={(e) => {
              e.stopPropagation();
              handleFileDrop(block.id)(e);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {isUploading ? (
              <div className="text-sm text-muted-foreground flex flex-col items-center gap-2 py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
                Uploading...
              </div>
            ) : block.content ? (
              <div className="w-full relative group/media">
                {block.type === 'image' && <img src={mediaSrc} alt="Content" className="max-h-[400px] w-auto h-auto rounded mx-auto" />}
                {block.type === 'video' && <video src={mediaSrc} controls className="max-h-[400px] w-full rounded" />}
                {block.type === 'audio' && <audio src={mediaSrc} controls className="w-full" />}

                {!readOnly && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover/media:opacity-100 transition-opacity"
                    onClick={() => updateBlock(block.id, { content: '' })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <>
                {block.type === 'image' && <ImageIcon className="h-8 w-8 text-muted-foreground" />}
                {block.type === 'video' && <Video className="h-8 w-8 text-muted-foreground" />}
                {block.type === 'audio' && <FileAudio className="h-8 w-8 text-muted-foreground" />}
                <div className="text-sm text-muted-foreground flex flex-col items-center gap-1">
                  <span className="font-medium">Drag & Drop or Click to Upload</span>
                  <span className="text-xs opacity-70">or paste URL below</span>
                </div>

                {!readOnly && (
                  <div className="flex flex-col gap-2 items-center w-full max-w-sm">
                    <label className="cursor-pointer">
                      <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-2 pointer-events-none">
                        <Upload className="h-3 w-3" />
                        Choose File
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileSelect(block.id)}
                        accept={block.type === 'image' ? "image/*" : block.type === 'video' ? "video/*" : "audio/*"}
                      />
                    </label>

                    <div className="relative w-full">
                      <Input
                        placeholder={`Paste ${block.type} URL...`}
                        className="text-sm h-8 w-full"
                        onBlur={(e) => updateBlock(block.id, { content: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateBlock(block.id, { content: e.currentTarget.value });
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="editor-blocks" type="BLOCK">
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="w-full space-y-2 relative"
          >
            {blocks.map((block, index) => (
              <Draggable
                key={block.id}
                draggableId={block.id}
                index={index}
                isDragDisabled={readOnly}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    style={provided.draggableProps.style}
                    className={cn(
                      // pl-12 (48px) reserves a real gutter (no cancelling
                      // -ml-8, which used to erase it back to 0 and spill the
                      // handle over the checkbox and past whatever padding
                      // the consumer container happened to have) for the
                      // absolutely-positioned drag handle + options menu
                      // below. That group is two 20px icon buttons (p-1
                      // around a 12px icon) plus a 4px gap between them —
                      // 44px total — so anything less than that (32px was
                      // tried first) still let the second icon spill onto
                      // the checkbox even though the first one now fit.
                      "relative group pl-12 flex items-start transition-opacity",
                      snapshot.isDragging && "opacity-50 z-50"
                    )}
                  >
                    {!readOnly && (
                      <div className="absolute left-0 top-1 h-6 flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                        {/* Drag Handle */}
                        <div
                          {...provided.dragHandleProps}
                          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
                        >
                          <GripVertical className="h-3 w-3 text-muted-foreground" />
                        </div>

                        {/* Options Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <div className="cursor-pointer p-1 hover:bg-muted rounded">
                              <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => deleteBlock(block.id)} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}

                    <div className="flex-1 min-w-0 relative">
                      {renderBlockContent(block, index)}

                      {activeBlockIdForMenu === block.id && (
                        <div className="absolute left-0 bottom-0 w-full h-0 z-50">
                          <Popover open={slashMenuOpen} onOpenChange={setSlashMenuOpen}>
                            <PopoverTrigger asChild>
                              <div className="w-px h-0 absolute left-0 top-0" />
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[250px]" align="start" side="bottom" sideOffset={4}>
                              <Command>
                                <CommandInput placeholder="Filter commands..." autoFocus />
                                <CommandList>
                                  <CommandGroup heading="Basic Blocks">
                                    {BLOCK_TYPES.map((type) => (
                                      <CommandItem
                                        key={type.type}
                                        value={type.label}
                                        onSelect={() => handleBlockTypeSelect(type.type)}
                                        className="cursor-pointer"
                                      >
                                        <type.icon className="mr-2 h-4 w-4" />
                                        {type.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {!readOnly && (
              <div
                className="text-sm text-muted-foreground opacity-30 hover:opacity-100 cursor-pointer py-2 pl-2 flex items-center gap-2 transition-opacity"
                onClick={() => addBlock(blocks.length > 0 ? blocks[blocks.length - 1].id : "", 'text')}
              >
                <Plus className="h-4 w-4" />
                Click to add block or type '/' for commands
              </div>
            )}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
