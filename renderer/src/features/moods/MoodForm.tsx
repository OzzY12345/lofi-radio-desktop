import React, { useMemo, useState } from "react";
import { MOOD_COLOR_ACCENTS } from "@shared/constants/color-accents";
import type { MoodDraft } from "@shared/types/mood";

type Accent = Exclude<MoodDraft["colorAccent"], undefined>;

interface MoodFormProps {
  initial?: MoodDraft;
  submitLabel: string;
  onSubmit: (draft: MoodDraft) => Promise<void>;
  onCancel?: () => void;
}

const emptyDraft: MoodDraft = {
  title: "",
  subtitle: "",
  energyLevel: 0.5,
  tags: [],
  icon: "",
  colorAccent: undefined
};

export function MoodForm({ initial, submitLabel, onSubmit, onCancel }: MoodFormProps): JSX.Element {
  const base = useMemo(() => initial ?? emptyDraft, [initial]);

  const [title, setTitle] = useState(base.title);
  const [subtitle, setSubtitle] = useState(base.subtitle);
  const [energyLevel, setEnergyLevel] = useState(base.energyLevel);
  const [tagsText, setTagsText] = useState(base.tags.join(", "));
  const [icon, setIcon] = useState(base.icon ?? "");
  const [colorAccent, setColorAccent] = useState<Accent | "">(base.colorAccent ?? "");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const tags = tagsText
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    await onSubmit({
      title,
      subtitle,
      energyLevel,
      tags,
      icon: icon || undefined,
      colorAccent: colorAccent || undefined
    });

    if (!initial) {
      setTitle("");
      setSubtitle("");
      setEnergyLevel(0.5);
      setTagsText("");
      setIcon("");
      setColorAccent("");
    }
  };

  return (
    <form className="mood-form" onSubmit={(event) => void handleSubmit(event)}>
      <input
        className="input"
        value={title}
        maxLength={42}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Mood title"
        required
      />
      <input
        className="input"
        value={subtitle}
        maxLength={72}
        onChange={(event) => setSubtitle(event.target.value)}
        placeholder="Subtitle"
      />
      <div className="grid-two">
        <input
          className="input"
          value={icon}
          maxLength={4}
          onChange={(event) => setIcon(event.target.value)}
          placeholder="Icon (emoji)"
        />
        <select
          className="input"
          value={colorAccent}
          onChange={(event) => {
            const value = event.target.value;
            if (!value) {
              setColorAccent("");
              return;
            }
            if (MOOD_COLOR_ACCENTS.includes(value as Accent)) {
              setColorAccent(value as Accent);
            }
          }}
        >
          <option value="">Accent (optional)</option>
          {MOOD_COLOR_ACCENTS.map((accent) => (
            <option key={accent} value={accent}>
              {accent}
            </option>
          ))}
        </select>
      </div>
      <input
        className="input"
        value={tagsText}
        onChange={(event) => setTagsText(event.target.value)}
        placeholder="Tags: focus, work, deep"
      />
      <div className="stack-gap-sm">
        <label className="label">Energy: {Math.round(energyLevel * 100)}%</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={energyLevel}
          onChange={(event) => setEnergyLevel(Number(event.target.value))}
        />
      </div>
      <div className="actions-row">
        <button className="btn primary" type="submit">
          {submitLabel}
        </button>
        {onCancel ? (
          <button className="btn ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
