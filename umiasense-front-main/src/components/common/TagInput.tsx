import { useState } from 'react';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function TagInput({ value, onChange, placeholder, disabled }: TagInputProps) {
  const [input, setInput] = useState('');

  const add = (raw: string) => {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(input);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap gap-2 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#E07628]/30 focus-within:border-[#E07628] min-h-[46px] transition">
      {value.map((tag, i) => (
        <span
          key={i}
          className="flex items-center gap-1 bg-[#FFF3EA] text-[#E07628] text-sm rounded-lg px-2.5 py-0.5 font-medium"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="ml-0.5 text-[#E07628]/60 hover:text-red-500 transition leading-none"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => input && add(input)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] outline-none text-sm bg-transparent text-gray-700 placeholder-gray-400"
        />
      )}
      {disabled && value.length === 0 && (
        <span className="text-sm text-gray-400">Не указано</span>
      )}
    </div>
  );
}
