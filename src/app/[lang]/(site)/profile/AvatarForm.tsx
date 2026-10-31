"use client";

import { useState, useTransition, type FormEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TextField } from "@/components/TextField";
import type { Dictionary } from "@/i18n/dictionaries";
import { MAX_AVATAR_BYTES, type AvatarErrorCode, type AvatarResult } from "@/profile/avatar";
import { removeAvatar, uploadAvatar } from "./avatarActions";

export function AvatarForm({ userId, displayName, version, labels }: {
  userId: string;
  displayName: string;
  version: number | null;
  labels: Dictionary["profile"]["avatar"];
}) {
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
      <form onSubmit={submit} className="flex flex-col gap-4" aria-label={labels.title}>
        <h2 className="text-xl font-bold text-foreground">{labels.title}</h2>
        {currentVersion === null ? (
          <span aria-hidden="true" className="flex size-20 items-center justify-center rounded-full border border-border bg-background text-2xl text-foreground">
            {Array.from(displayName)[0]?.toLocaleUpperCase()}
          </span>
        ) : (
          <Image src={`/api/avatars/${userId}?v=${currentVersion}`} alt={labels.preview}
            width={80} height={80} unoptimized className="rounded-full object-cover" />
        )}
        <TextField type="file" name="avatar" label={labels.file} accept="image/jpeg,image/png,image/webp"
          disabled={pending} onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            setSaved(false);
            setError(selected && selected.size > MAX_AVATAR_BYTES ? "TOO_LARGE" : null);
          }} />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending || !file || file.size > MAX_AVATAR_BYTES}>{labels.upload}</Button>
          <Button type="button" variant="secondary" disabled={pending || currentVersion === null}
            onClick={() => run(removeAvatar)}>{labels.remove}</Button>
        </div>
        <p aria-live="polite" aria-atomic="true" className={error ? "text-danger" : "text-foreground"}>
          {error ? labels.errors[error] : saved ? labels.saved : ""}
        </p>
      </form>
    </Card>
  );
}
