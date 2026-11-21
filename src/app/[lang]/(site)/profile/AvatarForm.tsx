"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import Image from "next/image";
import { Camera, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { Dictionary } from "@/i18n/dictionaries";
import { MAX_AVATAR_BYTES, type AvatarErrorCode, type AvatarResult } from "@/profile/avatar";
import { removeAvatar, uploadAvatar } from "./avatarActions";

export function AvatarForm({ userId, displayName, version, labels }: {
  userId: string;
  displayName: string;
  version: number | null;
  labels: Dictionary["profile"]["avatar"];
}) {
  const inputId = useId();
  const [currentVersion, setCurrentVersion] = useState(version);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<AvatarErrorCode | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<AvatarResult>) => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) setError(result.code);
        else {
          setCurrentVersion(result.version);
          setSaved(true);
        }
      } catch {
        setError("UNKNOWN");
      }
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || pending) return;
    if (file.size > MAX_AVATAR_BYTES) {
      setError("TOO_LARGE");
      return;
    }
    const data = new FormData();
    data.set("avatar", file);
    run(() => uploadAvatar(data));
  };

  return (
    <Card className="p-6 md:p-8">
      <form onSubmit={submit} className="flex flex-col gap-6" aria-label={labels.title}>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent-soft text-accent-text rounded-[10px]">
            <Camera aria-hidden="true" className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground">{labels.title}</h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          {currentVersion === null ? (
            <span
              aria-hidden="true"
              className="flex size-20 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text font-bold text-2xl ring-2 ring-border ring-offset-2 ring-offset-surface"
            >
              {Array.from(displayName)[0]?.toLocaleUpperCase()}
            </span>
          ) : (
            <Image
              src={`/api/avatars/${userId}?v=${currentVersion}`}
              alt={labels.preview}
              width={80}
              height={80}
              unoptimized
              className="size-20 shrink-0 rounded-full object-cover ring-2 ring-border ring-offset-2 ring-offset-surface"
            />
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <label htmlFor={inputId} className="text-sm font-medium text-foreground">
              {labels.file}
            </label>
            <input
              id={inputId}
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp"
              disabled={pending}
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                setSaved(false);
                setError(selected && selected.size > MAX_AVATAR_BYTES ? "TOO_LARGE" : null);
              }}
              className="block w-full cursor-pointer rounded-card border border-dashed border-border bg-background/50 p-3 text-sm text-muted hover:border-accent-text/50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 file:mr-4 file:rounded-full file:border-0 file:bg-accent-soft file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent-text hover:file:bg-accent hover:file:text-accent-foreground file:cursor-pointer file:transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending || !file || file.size > MAX_AVATAR_BYTES}>
            <Upload aria-hidden="true" className="w-4 h-4 shrink-0" />
            {labels.upload}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending || currentVersion === null}
            onClick={() => run(removeAvatar)}
          >
            <Trash2 aria-hidden="true" className="w-4 h-4 shrink-0" />
            {labels.remove}
          </Button>
        </div>

        <p
          aria-live="polite"
          aria-atomic="true"
          className={`empty:hidden text-sm font-medium ${error ? "text-danger" : "text-success"}`}
        >
          {error ? labels.errors[error] : saved ? labels.saved : ""}
        </p>
      </form>
    </Card>
  );
}
