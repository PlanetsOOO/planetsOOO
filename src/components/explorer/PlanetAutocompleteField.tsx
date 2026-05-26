"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  filterNavTargets,
  getNavTargetName,
  resolveNavTargetQuery,
  type NavTargetId,
} from "@/data/navigationTargets";

interface PlanetAutocompleteFieldProps {
  label: string;
  value: NavTargetId | null;
  onChange: (id: NavTargetId | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PlanetAutocompleteField({
  label,
  value,
  onChange,
  placeholder = "Search…",
  disabled = false,
}: PlanetAutocompleteFieldProps) {
  const listId = useId();
  const [query, setQuery] = useState(
    () => (value ? getNavTargetName(value) : ""),
  );
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => filterNavTargets(query), [query]);

  const select = (id: NavTargetId) => {
    onChange(id);
    setQuery(getNavTargetName(id));
    setOpen(false);
    inputRef.current?.blur();
  };

  const clear = () => {
    onChange(null);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && suggestions[highlight]) {
        select(suggestions[highlight].id);
      } else {
        const target = resolveNavTargetQuery(query);
        if (target) select(target.id);
      }
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
        {label}
      </label>
      <div className="flex gap-1">
        <input
          ref={inputRef}
          type="search"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            onChange(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          className="flex-1 rounded-md border border-white/12 bg-white/5 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/40 focus:ring-1 focus:ring-sky-500/30 disabled:opacity-40"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={clear}
            className="px-1.5 text-zinc-500 hover:text-zinc-300 text-xs"
            aria-label={`Clear ${label}`}
          >
            ×
          </button>
        )}
      </div>

      {open && !disabled && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 max-h-28 overflow-y-auto rounded-md border border-white/10 bg-black/90 shadow-lg z-20"
        >
          {suggestions.map((target, i) => (
            <li key={target.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(target.id)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-2 py-1 text-xs transition-colors ${
                  i === highlight
                    ? "bg-sky-500/20 text-sky-100"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                {target.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
