"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { isRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from "@/realtime/roomCode";
import { roomPath } from "@/realtime/roomRoute";

type HomeJoinCodeFormProps = {
  labels: Dictionary["home"]["joinByCode"];
  locale: Locale;
};

export function HomeJoinCodeForm({ labels, locale }: HomeJoinCodeFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!isRoomCode(code)) {
      setInvalid(true);
      return;
    }
    startTransition(() => router.push(roomPath(locale, code)));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <TextField
          label={labels.label}
          name="code"
          value={code}
          onChange={(event) => {
            setCode(normalizeRoomCode(event.target.value).slice(0, ROOM_CODE_LENGTH));
            setInvalid(false);
          }}
          placeholder={labels.placeholder}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={isPending}
          error={invalid ? labels.invalidCode : undefined}
        />
      </div>
      <Button type="submit" variant="secondary" disabled={isPending} className="min-h-14 sm:mt-[29px]">
        {labels.button}
      </Button>
    </form>
  );
}
