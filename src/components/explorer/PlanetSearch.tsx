"use client";

import { useMemo, useRef, useState } from "react";
import {
  filterNavTargets,
  resolveNavTargetQuery,
  type NavTargetId,
} from "@/data/navigationTargets";
import { useExplorer } from "@/context/ExplorerContext";

export function PlanetSearch() {
  const { navigateToTarget } = useExplorer();
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => filterNavTargets(query), [query]);
  const showList = open && query.trim().length > 0;

  const goTo = (id: NavTargetId) => {
    navigateToTarget(id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const submit = () => {
    const target = resolveNavTargetQuery(query);
    if (target) goTo(target.id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!query.trim()) return;
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
      if (showList && suggestions[highlight]) {
        goTo(suggestions[highlight].id);
      } else {
        submit();
      }
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative mb-3 pb-3 border-b border-white/10">
      <label htmlFor="planet-search" className="sr-only">
        Search bodies
      </label>
      <input
        ref={inputRef}
        id="planet-search"
        type="search"
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setHighlight(0);
          setOpen(next.trim().length > 0);
        }}
        onFocus={() => {
          if (query.trim().length > 0) setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search planet or Moon…"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList && suggestions.length > 0}
        aria-controls="planet-search-list"
        aria-autocomplete="list"
        className="w-full rounded-md border border-white/12 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/40 focus:ring-1 focus:ring-sky-500/30"
      />

      {showList && suggestions.length > 0 && (
        <ul
          id="planet-search-list"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 max-h-36 overflow-y-auto rounded-md border border-white/10 bg-black/90 shadow-lg z-10"
        >
          {suggestions.map((target, i) => (
            <li key={target.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goTo(target.id)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-2.5 py-1.5 text-xs transition-colors ${
                  i === highlight
                    ? "bg-sky-500/20 text-sky-100"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                {target.name}
                {target.kind === "moon" && (
                  <span className="ml-1.5 text-zinc-600 normal-case tracking-normal">
                    moon
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showList && suggestions.length === 0 && (
        <p className="absolute left-0 right-0 top-full mt-1 px-2 py-1.5 text-[10px] text-zinc-600 bg-black/90 rounded-md border border-white/10">
          No matching body
        </p>
      )}
    </div>
  );
}
