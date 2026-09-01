import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { childrenApi } from '../../api';
import type { Child } from '../../types';
import { useAuthStore } from '../../store/authStore';

import BasicInfoSection from './sections/BasicInfoSection';
import FearsSection from './sections/FearsSection';
import InterestsSection from './sections/InterestsSection';
import SensorySection from './sections/SensorySection';
import BehavioralSection from './sections/BehavioralSection';
import GoalsSection from './sections/GoalsSection';
import TrainersSection from './sections/TrainersSection';

const TABS = [
  { id: 'basic',      label: '📋 Основное' },
  { id: 'fears',      label: '😨 Страхи' },
  { id: 'interests',  label: '⭐ Интересы' },
  { id: 'sensory',    label: '👃 Сенсорика' },
  { id: 'behavioral', label: '🧠 Поведение' },
  { id: 'goals',      label: '🎯 Цели' },
  { id: 'trainers',   label: '👥 Специалисты' },
];

const MODULES = [
  { to: 'emotions',        icon: '😊', label: 'Эмоции' },
  { to: 'activities',      icon: '🎯', label: 'Активности' },
  { to: 'diary',           icon: '📓', label: 'Дневник' },
  { to: 'milestones',      icon: '📈', label: 'Развитие' },
  { to: 'recommendations', icon: '✨', label: 'ИИ Советы', parentOnly: true },
];

export default function ChildProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [child, setChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('basic');

  const isParent = user?.role === 'parent';

  const fetchChild = async () => {
    if (!id) return;
    try {
      const { data } = await childrenApi.getOne(id);
      setChild(data);
    } catch {
      toast.error('Не удалось загрузить профиль');
      navigate(`/children/${id}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChild(); }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!child) return null;

  const visibleModules = MODULES.filter((m) => !m.parentOnly || isParent);

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(`/children/${id}`)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition">
        ← Все дети
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[#FFF3EA] flex items-center justify-center text-2xl font-bold text-[#E07628] overflow-hidden flex-shrink-0">
          {child.photo
            ? <img src={child.photo} className="w-full h-full object-cover" alt="" />
            : child.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{child.name}</h1>
          <p className="text-sm text-gray-400">
            {new Date(child.dateOfBirth).toLocaleDateString('ru-RU')}
            {child.diagnosis && ` · ${child.diagnosis}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {visibleModules.map((m) => (
          <Link
            key={m.to}
            to={`/children/${id}/${m.to}`}
            className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:shadow-md hover:border-[#E07628]/30 transition text-center"
          >
            <span className="text-2xl">{m.icon}</span>
            <span className="text-xs font-medium text-gray-600 leading-tight">{m.label}</span>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#E07628] text-[#E07628]'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === 'basic'      && <BasicInfoSection  child={child} canEdit={isParent} onRefresh={fetchChild} />}
          {activeTab === 'fears'      && <FearsSection      child={child} canEdit={isParent} onRefresh={fetchChild} />}
          {activeTab === 'interests'  && <InterestsSection  child={child} canEdit={isParent} onRefresh={fetchChild} />}
          {activeTab === 'sensory'    && <SensorySection    child={child} canEdit={isParent} onRefresh={fetchChild} />}
          {activeTab === 'behavioral' && <BehavioralSection child={child} canEdit={isParent} onRefresh={fetchChild} />}
          {activeTab === 'goals'      && <GoalsSection      child={child} canEdit={isParent} onRefresh={fetchChild} />}
          {activeTab === 'trainers'   && <TrainersSection   child={child} canEdit={isParent} onRefresh={fetchChild} />}
        </div>
      </div>
    </div>
  );
}
