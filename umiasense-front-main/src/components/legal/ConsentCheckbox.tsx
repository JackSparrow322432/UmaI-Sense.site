import { Link } from 'react-router-dom';

/** Чекбокс отдельного согласия со ссылкой на раздел Политики/Соглашения */
interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
  children: React.ReactNode;
  link: { to: string; label: string };
}

export default function ConsentCheckbox({ checked, onChange, required = false, children, link }: Props) {
  return (
    <label className="flex items-start gap-2.5 text-xs text-gray-600 leading-relaxed cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-[#E07628] shrink-0"
        aria-required={required}
      />
      <span>
        {children}{' '}
        <Link to={link.to} target="_blank" className="text-[#E07628] underline">{link.label}</Link>
        {required ? <span className="text-[#E07628]"> *</span> : <span className="text-gray-400"> (необязательно)</span>}
      </span>
    </label>
  );
}
