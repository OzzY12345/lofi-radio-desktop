import React, { useMemo, useState } from "react";
import type { Mood, MoodDraft, MoodUpdate } from "@shared/types/mood";
import { MoodForm } from "./MoodForm";

interface MoodsScreenProps {
  moods: Mood[];
  onCreate: (draft: MoodDraft) => Promise<void>;
  onUpdate: (id: string, patch: MoodUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (orderedIds: string[]) => Promise<void>;
  onImport: () => Promise<void>;
  onExport: () => Promise<void>;
}

const toDraft = (mood: Mood): MoodDraft => ({
  title: mood.title,
  subtitle: mood.subtitle,
  energyLevel: mood.energyLevel,
  tags: mood.tags,
  icon: mood.icon,
  colorAccent: mood.colorAccent
});

const moveItem = (list: Mood[], fromId: string, toId: string): Mood[] => {
  const next = [...list];
  const fromIndex = next.findIndex((item) => item.id === fromId);
  const toIndex = next.findIndex((item) => item.id === toId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return list;
  }

  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);

  return next;
};

export function MoodsScreen({
  moods,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
  onImport,
  onExport
}: MoodsScreenProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const filteredMoods = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return moods;
    }

    return moods.filter((mood) => {
      const inTitle = mood.title.toLowerCase().includes(q);
      const inTags = mood.tags.some((tag) => tag.toLowerCase().includes(q));
      return inTitle || inTags;
    });
  }, [moods, query]);

  const handleDrop = async (targetId: string): Promise<void> => {
    if (!draggingId) {
      return;
    }

    const reordered = moveItem(moods, draggingId, targetId);
    setDraggingId(null);

    if (reordered !== moods) {
      await onReorder(reordered.map((item) => item.id));
    }
  };

  return (
    <div className="panel stack-gap">
      <section className="actions-row">
        <button type="button" className="btn ghost" onClick={() => void onExport()}>
          Export JSON
        </button>
        <button type="button" className="btn ghost" onClick={() => void onImport()}>
          Import JSON
        </button>
      </section>

      <section className="stack-gap-sm">
        <div className="label">Add mood</div>
        <MoodForm submitLabel="Add mood" onSubmit={onCreate} />
      </section>

      <section className="stack-gap-sm">
        <div className="status-row">
          <label className="label" htmlFor="mood-search">
            Search
          </label>
          <span className="small muted">{filteredMoods.length} moods</span>
        </div>
        <input
          id="mood-search"
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find by title or tags"
        />
      </section>

      <section className="moods-list">
        {filteredMoods.map((mood) => {
          const isEditing = editingId === mood.id;

          return (
            <article
              key={mood.id}
              className="mood-card"
              draggable
              onDragStart={() => setDraggingId(mood.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => void handleDrop(mood.id)}
            >
              <header className="mood-card-header">
                <button className="drag-handle" type="button" aria-label="Drag mood" title="Drag to reorder">
                  ::
                </button>
                <div>
                  <div className="mood-title">
                    {mood.icon ? `${mood.icon} ` : ""}
                    {mood.title}
                  </div>
                  <div className="small muted">{mood.subtitle || "No subtitle"}</div>
                </div>
                <div className="actions-row">
                  <button className="btn tiny" type="button" onClick={() => setEditingId(isEditing ? null : mood.id)}>
                    {isEditing ? "Close" : "Edit"}
                  </button>
                  <button
                    className="btn tiny danger"
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete mood \"${mood.title}\"?`)) {
                        void onDelete(mood.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </header>

              <div className="tags-row">
                {mood.tags.map((tag) => (
                  <span key={`${mood.id}-${tag}`} className="tag">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="small muted">Energy: {Math.round(mood.energyLevel * 100)}%</div>

              {isEditing ? (
                <div className="edit-block">
                  <MoodForm
                    initial={toDraft(mood)}
                    submitLabel="Save"
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (draft) => {
                      await onUpdate(mood.id, draft);
                      setEditingId(null);
                    }}
                  />
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}