interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function ModalShell({ title, onClose, children }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5 max-h-[78vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
