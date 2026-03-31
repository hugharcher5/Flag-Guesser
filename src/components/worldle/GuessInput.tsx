'use client';

import { useState, useRef, useCallback } from 'react';
import { searchCountries, resolveCountry } from '@/lib/resolveCountry';
import type { Country } from '@/data/countries';

interface Props {
  /** Codes of countries already guessed — hidden from suggestions, blocked on submit. */
  usedCodes: Set<string>;
  onGuess: (country: Country) => void;
  disabled?: boolean;
}

export default function GuessInput({ usedCodes, onGuess, disabled = false }: Props) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<Country[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const clearDropdown = () => {
    setSuggestions([]);
    setActiveIdx(-1);
  };

  const handleChange = useCallback(
    (raw: string) => {
      setValue(raw);
      setError('');
      setActiveIdx(-1);
      const q = raw.trim();
      setSuggestions(q ? searchCountries(q, usedCodes) : []);
    },
    [usedCodes],
  );

  const commit = useCallback(
    (country: Country) => {
      if (usedCodes.has(country.code)) {
        setError(`You already guessed ${country.name}.`);
        return;
      }
      setValue('');
      clearDropdown();
      setError('');
      onGuess(country);
      // Return focus to input so the player can type the next guess immediately
      inputRef.current?.focus();
    },
    [usedCodes, onGuess],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const picked = activeIdx >= 0 ? suggestions[activeIdx] : null;
        if (picked) {
          commit(picked);
        } else if (suggestions.length === 1) {
          commit(suggestions[0]);
        } else {
          const resolved = resolveCountry(value);
          if (resolved) commit(resolved);
          else if (value.trim()) setError('Country not found — select from the list.');
        }
      } else if (e.key === 'Escape') {
        clearDropdown();
      }
    },
    [suggestions, activeIdx, value, commit],
  );

  const handleSubmitClick = useCallback(() => {
    const picked = activeIdx >= 0 ? suggestions[activeIdx] : null;
    if (picked) { commit(picked); return; }
    if (suggestions.length === 1) { commit(suggestions[0]); return; }
    const resolved = resolveCountry(value);
    if (resolved) commit(resolved);
    else if (value.trim()) setError('Country not found — select from the list.');
  }, [activeIdx, suggestions, value, commit]);

  return (
    <div className="relative w-full">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay so a mousedown on a suggestion fires before the dropdown closes
            setTimeout(clearDropdown, 150);
          }}
          disabled={disabled}
          placeholder="Type a country name…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
          className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-base
                     placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                     disabled:bg-gray-100 disabled:text-gray-400"
        />
        <button
          type="button"
          onClick={handleSubmitClick}
          disabled={disabled || !value.trim()}
          className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold text-base
                     hover:bg-blue-700 active:bg-blue-800 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
        >
          Guess
        </button>
      </div>

      {/* Autocomplete dropdown */}
      {suggestions.length > 0 && !disabled && (
        <ul className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((c, i) => (
            <li key={c.code}>
              <button
                type="button"
                // Use onMouseDown so the selection registers before onBlur fires
                onMouseDown={e => { e.preventDefault(); commit(c); }}
                className={`w-full text-left px-4 py-2.5 text-sm cursor-pointer touch-manipulation
                  ${i === activeIdx
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-800 hover:bg-gray-50'
                  }`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  );
}
