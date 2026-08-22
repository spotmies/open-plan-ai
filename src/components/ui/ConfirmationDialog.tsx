import { useEffect, useRef } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "destructive";
    /** Optional third action (e.g. "Update Task") shown above the confirm button — lets the user save instead of discard/cancel. */
    extraActionText?: string;
    onExtraAction?: () => void;
}

export function ConfirmationDialog({
    open,
    onOpenChange,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default",
    extraActionText,
    onExtraAction,
}: ConfirmationDialogProps) {
    // Enter-to-confirm and the action button's onClick can both fire for a
    // single user activation (e.g. Enter while the action button has focus).
    // Guard so onConfirm only ever runs once per time the dialog is opened.
    const hasConfirmedRef = useRef(false);

    useEffect(() => {
        if (open) hasConfirmedRef.current = false;
    }, [open]);

    const confirmOnce = () => {
        if (hasConfirmedRef.current) return;
        hasConfirmedRef.current = true;
        onConfirm();
    };

    const extraActionOnce = () => {
        if (hasConfirmedRef.current) return;
        hasConfirmedRef.current = true;
        onExtraAction?.();
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent
                className="sm:max-w-[420px]"
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        confirmOnce();
                        onOpenChange(false);
                    }
                }}
            >
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {extraActionText && onExtraAction ? (
                    // Mobile: "Keep Editing" + extra action share a row, "Discard/Confirm" moves to its own row below.
                    // Desktop: falls back to a single row, right-aligned, extra action last (primary position).
                    <AlertDialogFooter className="flex-col sm:flex-row sm:justify-end gap-2 sm:space-x-0">
                        <div className="flex gap-2 sm:contents">
                            <AlertDialogCancel className="flex-1 sm:flex-none sm:order-1 mt-0">{cancelText}</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => {
                                    e.preventDefault();
                                    extraActionOnce();
                                    onOpenChange(false);
                                }}
                                className="flex-1 sm:flex-none sm:order-3"
                            >
                                {extraActionText}
                            </AlertDialogAction>
                        </div>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                confirmOnce();
                                onOpenChange(false);
                            }}
                            className={cn(
                                "w-full sm:w-auto sm:order-2",
                                variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            )}
                        >
                            {confirmText}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                ) : (
                    <AlertDialogFooter>
                        <AlertDialogCancel>{cancelText}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                confirmOnce();
                                onOpenChange(false);
                            }}
                            className={variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                        >
                            {confirmText}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                )}
            </AlertDialogContent>
        </AlertDialog>
    );
}
