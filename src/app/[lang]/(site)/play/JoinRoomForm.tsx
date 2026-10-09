"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TextField } from "@/components/TextField";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ParticipantRole } from "@/realtime/protocol";
import { isRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from "@/realtime/roomCode";

type JoinRoomFormProps = {
  labels: Dictionary["room"]["play"]["join"];
  /** Message de `room.errors.INVALID_CODE`, affiché quand le code saisi est mal formé. */
  invalidCodeMessage: string;
  /** Déjà dans une salle : le formulaire est désactivé. */
  disabled: boolean;
  /** Reçoit un code valide, déjà normalisé. */
  onJoin: (code: string, role: ParticipantRole) => void;
};

const ROLES = ["runner", "spectator"] as const satisfies readonly ParticipantRole[];

/** « Rejoindre avec un code » (SALLE-4, SALLE-7) : code de 6 caractères et rôle. */
export function JoinRoomForm({ labels, invalidCodeMessage, disabled, onJoin }: JoinRoomFormProps) {
  const [code, setCode] = useState("");
  const [role, setRole] = useState<ParticipantRole>("runner");
  const [invalid, setInvalid] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!isRoomCode(code)) {
      setInvalid(true);
      return;
    }
    onJoin(code, role);
  }

  return (
    <Card className="border border-border p-6">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-foreground">{labels.title}</h2>
        <p className="text-muted-strong">{labels.description}</p>
        <TextField
          label={labels.codeLabel}
          name="code"
          value={code}
          onChange={(event) => {
            // Majuscules, sans espaces ni tirets, 6 caractères au plus : le code se colle tel qu'il a été dicté.
            setCode(normalizeRoomCode(event.target.value).slice(0, ROOM_CODE_LENGTH));
            setInvalid(false);
          }}
          placeholder={labels.codePlaceholder}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={disabled}
          error={invalid ? invalidCodeMessage : undefined}
        />
        <fieldset disabled={disabled} className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-foreground">{labels.roleLabel}</legend>
          {ROLES.map((value) => (
            <label key={value} className="flex items-center gap-2 text-foreground">
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
                className="size-4 accent-accent"
              />
              {labels[value]}
            </label>
          ))}
        </fieldset>
        <Button type="submit" disabled={disabled}>
          {labels.button}
        </Button>
      </form>
    </Card>
  );
}
