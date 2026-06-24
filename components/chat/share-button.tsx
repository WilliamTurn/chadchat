"use client";

import { Check, Copy, Globe, Loader2, Lock, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { VisibilityType } from "./visibility-selector";

export function ShareButton({
  chatId,
  selectedVisibilityType,
  hasMessages,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  hasMessages: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId,
    initialVisibilityType: selectedVisibilityType,
  });

  const isPublic = visibilityType === "public";

  // Built client-side so it always points at the deployment the visitor is on.
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/share/${chatId}`
      : "";

  async function makePublic() {
    setPending(true);
    try {
      await setVisibilityType("public");
      toast.success("Public link created.");
    } catch {
      toast.error("Couldn't create the link. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function makePrivate() {
    setPending(true);
    try {
      await setVisibilityType("private");
      toast.success("Chat is private again. The link no longer works.");
    } catch {
      toast.error("Couldn't update the chat. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className="ml-1 gap-1.5 rounded-lg border-border/50 text-muted-foreground shadow-none transition-colors hover:text-foreground"
          data-testid="share-button"
          size="sm"
          variant="outline"
        >
          <Share2 className="size-3.5" />
          <span className="md:not-sr-only sr-only">Share</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this chat</DialogTitle>
          <DialogDescription>
            {isPublic
              ? "Anyone with this link can read this conversation. They won't be able to reply or see your other chats."
              : "Create a public link so anyone can read this conversation. No account needed to view it."}
          </DialogDescription>
        </DialogHeader>

        {hasMessages ? (
          <div className="flex flex-col gap-4">
            {isPublic ? (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Public share link"
                    className="text-sm"
                    readOnly
                    value={shareUrl}
                  />
                  <Button
                    className="shrink-0 gap-1.5"
                    onClick={copyLink}
                    type="button"
                  >
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <button
                  className="flex w-fit items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground disabled:opacity-50"
                  disabled={pending}
                  onClick={makePrivate}
                  type="button"
                >
                  {pending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Lock className="size-3.5" />
                  )}
                  Make private
                </button>
              </>
            ) : (
              <Button
                className="w-full gap-2"
                disabled={pending}
                onClick={makePublic}
                type="button"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Globe className="size-4" />
                )}
                Create public link
              </Button>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Send Chad a message first — you can share the conversation once it
            has something in it.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
