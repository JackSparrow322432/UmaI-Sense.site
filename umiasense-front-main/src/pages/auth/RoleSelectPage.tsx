import { useNavigate } from 'react-router-dom';

export default function RoleSelectPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FF] px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <h2 className="text-2xl font-bold">Кто вы?</h2>
        <div className="grid gap-3">
          <button
            onClick={() => navigate('/login', { state: { role: 'parent' } })}
            className="bg-[#E07628] text-white rounded-2xl py-4 font-semibold text-lg hover:bg-[#C4641A] transition"
          >
            👨‍👩‍👧 Родитель
          </button>
          <button
            onClick={() => navigate('/login', { state: { role: 'trainer' } })}
            className="bg-[#2DD4A1] text-white rounded-2xl py-4 font-semibold text-lg hover:opacity-90 transition"
          >
            🧑‍🏫 Тренер
          </button>
        </div>
      </div>
    </div>
  );
}
