import React from "react";

interface SegmentedTabsProps<T extends string> {
  value: T;
  options: ReadonlyArray<{ id: T; label: string }>;
  onChange: (value: T) => void;
}

export function SegmentedTabs<T extends string>({ value, options, onChange }: SegmentedTabsProps<T>): JSX.Element {
  return (
    <div className="tabs" role="tablist" aria-label="Primary tabs">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`tab ${value === option.id ? "active" : ""}`}
          role="tab"
          aria-selected={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
