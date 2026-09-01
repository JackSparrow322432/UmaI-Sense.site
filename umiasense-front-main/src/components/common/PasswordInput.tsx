import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from '../auth/icons';

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  error?: boolean;
}

export default function PasswordInput({
  value, onChange, placeholder = '••••••••', required, autoFocus, error,
}: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className={`w-full border rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:ring-2 transition bg-gray-50 focus:bg-white ${
          error
            ? 'border-red-300 focus:ring-red-100 focus:border-red-400'
            : 'border-gray-200 focus:ring-[#E07628]/20 focus:border-[#E07628]'
        }`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
        tabIndex={-1}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
