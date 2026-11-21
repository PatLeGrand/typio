"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CircleAlert, CircleCheck, Dices, RotateCcw, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { BlobPreview } from "@/components/race/BlobPreview";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  BLOB_ACCESSORIES,
  BLOB_COLORS,
  BLOB_COLOR_HEX,
  BLOB_EXPRESSIONS,
  BLOB_GLASSES,
  BLOB_HATS,
  DEFAULT_BLOB_STYLE,
  blobStyleEquals,
  randomBlobStyle,
  type BlobStyle,
} from "@/race/blobStyle";
import { ChoiceRadio } from "./ChoiceRadio";
import { formatBlobPreviewLabel, formatBlobStyleSummary } from "./blobPreviewLabel";
import { updateBlobStyle, type BlobStyleErrorCode } from "./blobStyleActions";

type BlobCustomizerProps = {
  initialStyle: BlobStyle;
  isDemo?: boolean;
  labels: Dictionary["profile"]["blob"];
  showHeader?: boolean;
  onSaved?: (style: BlobStyle) => void;
};

export function BlobCustomizer({ initialStyle, isDemo = false, labels, showHeader = true, onSaved }: BlobCustomizerProps) {
  const [savedStyle, setSavedStyle] = useState<BlobStyle>(initialStyle);
  const [style, setStyle] = useState<BlobStyle>(initialStyle);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [errorCode, setErrorCode] = useState<BlobStyleErrorCode | null>(null);

  const hasChanges = !blobStyleEquals(style, savedStyle);
  const isDefault = blobStyleEquals(style, DEFAULT_BLOB_STYLE);
  const previewLabel = formatBlobPreviewLabel(labels.preview, style, labels);

  const updateSelection = (patch: Partial<BlobStyle>) => {
    setStyle((current) => ({ ...current, ...patch }));
    setSaved(false);
    setErrorCode(null);
  };

  const handleRandomize = () => {
    setStyle((current) => {
      let next = randomBlobStyle();
      if (blobStyleEquals(next, current)) {
        next = randomBlobStyle();
      }
      return next;
    });
    setSaved(false);
    setErrorCode(null);
  };

  const handleResetToDefault = () => {
    setStyle(DEFAULT_BLOB_STYLE);
    setSaved(false);
    setErrorCode(null);
  };

  const handleCancel = () => {
    setStyle(savedStyle);
    setSaved(false);
    setErrorCode(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isDemo || !hasChanges || isPending) return;

    const formData = new FormData();
    formData.set("color", style.color);
    formData.set("expression", style.expression);
    formData.set("glasses", style.glasses);
    formData.set("hat", style.hat);
    formData.set("accessory", style.accessory);

    setSaved(false);
    setErrorCode(null);
    startTransition(async () => {
      try {
        const result = await updateBlobStyle(formData);
        if (result.ok) {
          setSavedStyle(result.style);
          setStyle(result.style);
          setSaved(true);
          onSaved?.(result.style);
        } else {
          setErrorCode(result.code);
        }
      } catch {
        setErrorCode("UNKNOWN");
      }
    });
  };

  return (
    <Card className="p-6 md:p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6" aria-label={labels.title}>
        {showHeader && (
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent-soft text-accent-text rounded-[10px]">
              <Sparkles aria-hidden="true" className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-foreground">{labels.title}</h2>
              <p className="text-sm text-muted">{labels.description}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 lg:sticky lg:top-6 flex flex-col items-center justify-center gap-4 rounded-card border border-border bg-island-mint p-6">
            <div className="relative flex flex-col items-center">
              <BlobPreview style={style} size={156} label={previewLabel} className="relative z-10" />
              <div
                aria-hidden="true"
                className="-mt-3 h-3 w-24 rounded-full bg-foreground/15"
              />
            </div>
            <p className="text-center text-xs font-medium text-muted">
              {formatBlobStyleSummary(style, labels)}
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={isDemo || isPending}
              onClick={handleRandomize}
              className="w-full"
            >
              <Dices aria-hidden="true" className="w-4 h-4 shrink-0" />
              {labels.randomize}
            </Button>
          </div>

          <div className="lg:col-span-8 flex flex-col gap-6">
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-foreground mb-2">{labels.colorLegend}</legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {BLOB_COLORS.map((color) => (
                  <label
                    key={color}
                    className="group relative inline-flex min-h-13 cursor-pointer items-center justify-start gap-2.5 rounded-field border border-border bg-surface px-3.5 py-2.5 text-sm font-semibold text-foreground hover:bg-accent-soft has-checked:border-accent has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent has-disabled:cursor-not-allowed has-disabled:text-muted"
                  >
                    <input
                      type="radio"
                      name="color"
                      value={color}
                      checked={style.color === color}
                      disabled={isDemo || isPending}
                      onChange={() => updateSelection({ color })}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className="size-5 shrink-0 rounded-full border-2 border-foreground/30"
                      style={{ backgroundColor: BLOB_COLOR_HEX[color] }}
                    />
                    <span className="truncate">{labels.colors[color]}</span>
                    <CircleCheck aria-hidden="true" className="ml-auto hidden size-4 shrink-0 group-has-checked:block" />
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-foreground mb-2">{labels.expressionLegend}</legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BLOB_EXPRESSIONS.map((expression) => (
                  <ChoiceRadio
                    key={expression}
                    name="expression"
                    value={expression}
                    label={labels.expressions[expression]}
                    checked={style.expression === expression}
                    disabled={isDemo || isPending}
                    onChange={() => updateSelection({ expression })}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-foreground mb-2">{labels.glassesLegend}</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BLOB_GLASSES.map((glasses) => (
                  <ChoiceRadio
                    key={glasses}
                    name="glasses"
                    value={glasses}
                    label={labels.glasses[glasses]}
                    checked={style.glasses === glasses}
                    disabled={isDemo || isPending}
                    onChange={() => updateSelection({ glasses })}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-foreground mb-2">{labels.hatLegend}</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BLOB_HATS.map((hat) => (
                  <ChoiceRadio
                    key={hat}
                    name="hat"
                    value={hat}
                    label={labels.hats[hat]}
                    checked={style.hat === hat}
                    disabled={isDemo || isPending}
                    onChange={() => updateSelection({ hat })}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-foreground mb-2">{labels.accessoryLegend}</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BLOB_ACCESSORIES.map((accessory) => (
                  <ChoiceRadio
                    key={accessory}
                    name="accessory"
                    value={accessory}
                    label={labels.accessories[accessory]}
                    checked={style.accessory === accessory}
                    disabled={isDemo || isPending}
                    onChange={() => updateSelection({ accessory })}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border pt-5">
          <div className="flex items-center gap-2 text-sm font-medium min-h-6" aria-live="polite" aria-atomic="true">
            {errorCode !== null ? (
              <span className="inline-flex items-center gap-2 text-danger">
                <CircleAlert aria-hidden="true" className="w-4 h-4 shrink-0" />
                {labels.errors[errorCode]}
              </span>
            ) : saved ? (
              <span className="inline-flex items-center gap-2 text-success">
                <CircleCheck aria-hidden="true" className="w-4 h-4 shrink-0" />
                {labels.saved}
              </span>
            ) : !hasChanges ? (
              <span className="text-muted">{labels.noChanges}</span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isDemo || isPending || isDefault}
              onClick={handleResetToDefault}
            >
              <RotateCcw aria-hidden="true" className="w-4 h-4 shrink-0" />
              {labels.reset}
            </Button>
            {hasChanges && (
              <Button type="button" variant="secondary" disabled={isPending} onClick={handleCancel}>
                {labels.cancel}
              </Button>
            )}
            <Button type="submit" disabled={isDemo || !hasChanges || isPending}>
              <Save aria-hidden="true" className="w-4 h-4 shrink-0" />
              {isPending ? labels.saving : labels.save}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
