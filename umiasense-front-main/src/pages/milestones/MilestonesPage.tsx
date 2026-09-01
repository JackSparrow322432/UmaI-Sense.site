import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { milestonesApi, childrenApi } from '../../api';
import type { Milestone, ChildMilestone, Child, MilestoneDirection, MilestoneStatus } from '../../types';
import { useAuthStore } from '../../store/authStore';

// ─── Direction config ─────────────────────────────────────────────────────────

type DirectionFilter = MilestoneDirection | 'all';

const DIRECTIONS: { key: DirectionFilter; label: string; color: string; bg: string }[] = [
  { key: 'all',       label: 'Все',                color: '#6B7280', bg: '#F3F4F6' },
  { key: 'cognitive', label: 'Когнитивное',        color: '#60A5FA', bg: '#EFF6FF' },
  { key: 'motor',     label: 'Моторика',           color: '#E07628', bg: '#FFF3EA' },
  { key: 'social',    label: 'Социальное',         color: '#2DD4A1', bg: '#EDFAF5' },
  { key: 'speech',    label: 'Речь',               color: '#A78BFA', bg: '#F5F3FF' },
  { key: 'selfcare',  label: 'Самообслуживание',   color: '#F59B56', bg: '#FFF7ED' },
];

const DIR_MAP = Object.fromEntries(DIRECTIONS.map((d) => [d.key, d]));

// ─── Age group display ────────────────────────────────────────────────────────

const AGE_LABEL: Record<string, string> = {
  '2-3': '2–3 года',
  '3-4': '3–4 года',
  '4-5': '4–5 лет',
  '5-6': '5–6 лет',
  '6-7': '6–7 лет',
  '7-8': '7–8 лет',
};

const AGE_ORDER = ['2-3', '3-4', '4-5', '5-6', '6-7', '7-8'];

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CYCLE: MilestoneStatus[] = ['not_yet', 'in_progress', 'achieved'];

const STATUS_CFG: Record<MilestoneStatus, { icon: string; label: string; color: string; bg: string; border: string }> = {
  achieved:    { icon: '✓', label: 'Достигнуто',    color: '#16A34A', bg: '#F0FDF4', border: '#86EFAC' },
  in_progress: { icon: '~', label: 'В процессе',    color: '#E07628', bg: '#FFF3EA', border: '#FCD19C' },
  not_yet:     { icon: '✗', label: 'Не достигнуто', color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const nextStatus = (current: MilestoneStatus): MilestoneStatus => {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
};

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ achieved, inProgress, total }: { achieved: number; inProgress: number; total: number }) {
  const pctAchieved   = total > 0 ? Math.round((achieved / total) * 100) : 0;
  const pctInProgress = total > 0 ? Math.round((inProgress / total) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-800">Прогресс по направлению</p>
        <p className="text-sm font-bold text-gray-900">{pctAchieved}%</p>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-green-400 transition-all duration-500"
          style={{ width: `${pctAchieved}%` }}
        />
        <div
          className="h-full bg-[#FCD19C] transition-all duration-500"
          style={{ width: `${pctInProgress}%` }}
        />
      </div>
      <div className="flex items-center gap-4 mt-2.5">
        {[
          { color: 'bg-green-400', label: `Достигнуто: ${achieved}` },
          { color: 'bg-[#FCD19C]', label: `В процессе: ${inProgress}` },
          { color: 'bg-gray-200',  label: `Не достигнуто: ${total - achieved - inProgress}` },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${s.color}`} />
            <span className="text-[10px] text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Milestone row ────────────────────────────────────────────────────────────

function MilestoneRow({
  milestone,
  status,
  canEdit,
  onToggle,
  updating,
}: {
  milestone: Milestone;
  status: MilestoneStatus;
  canEdit: boolean;
  onToggle: () => void;
  updating: boolean;
}) {
  const cfg = STATUS_CFG[status];

  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <button
        onClick={canEdit ? onToggle : undefined}
        disabled={!canEdit || updating}
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-bold border-2 transition-all active:scale-90"
        style={{
          backgroundColor: cfg.bg,
          color: cfg.color,
          borderColor: cfg.border,
          cursor: canEdit ? 'pointer' : 'default',
          opacity: updating ? 0.5 : 1,
        }}
        title={canEdit ? `Сейчас: ${cfg.label}. Нажмите для изменения` : cfg.label}
      >
        {updating ? (
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          cfg.icon
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 leading-snug">{milestone.skill}</p>
        {milestone.description && (
          <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{milestone.description}</p>
        )}
      </div>
    </div>
  );
}

// ─── Age group section ────────────────────────────────────────────────────────

function AgeGroupSection({
  ageGroup,
  milestones,
  statusMap,
  canEdit,
  onToggle,
  updatingId,
}: {
  ageGroup: string;
  milestones: Milestone[];
  statusMap: Record<string, MilestoneStatus>;
  canEdit: boolean;
  onToggle: (milestoneId: string, current: MilestoneStatus) => void;
  updatingId: string | null;
}) {
  const achieved = milestones.filter((m) => statusMap[m._id] === 'achieved').length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          {AGE_LABEL[ageGroup] ?? ageGroup}
        </h3>
        <span className="text-[11px] font-semibold text-gray-400">
          {achieved}/{milestones.length}
        </span>
      </div>
      <div className="divide-y divide-gray-50">
        {milestones.map((m) => (
          <MilestoneRow
            key={m._id}
            milestone={m}
            status={statusMap[m._id] ?? 'not_yet'}
            canEdit={canEdit}
            onToggle={() => onToggle(m._id, statusMap[m._id] ?? 'not_yet')}
            updating={updatingId === m._id}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MilestonesPage() {
  const { id: childId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [child,        setChild]        = useState<Child | null>(null);
  const [milestones,   setMilestones]   = useState<Milestone[]>([]);
  const [childMs,      setChildMs]      = useState<ChildMilestone[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [dirFilter,    setDirFilter]    = useState<DirectionFilter>('all');
  const [updatingId,   setUpdatingId]   = useState<string | null>(null);

  const isParent = user?.role === 'parent';

  const fetchData = async () => {
    if (!childId) return;
    try {
      const [cRes, mRes, cmRes] = await Promise.all([
        childrenApi.getOne(childId),
        milestonesApi.getAll(),
        milestonesApi.getForChild(childId),
      ]);
      setChild(cRes.data);
      setMilestones(mRes.data);
      setChildMs(cmRes.data);
    } catch {
      toast.error('Ошибка загрузки');
      navigate('/children');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [childId]);

  // milestoneId → status (from child records)
  const statusMap = useMemo((): Record<string, MilestoneStatus> => {
    const map: Record<string, MilestoneStatus> = {};
    childMs.forEach((cm) => {
      const mid = typeof cm.milestoneId === 'string'
        ? cm.milestoneId
        : (cm.milestoneId as any)?._id ?? String(cm.milestoneId);
      map[mid] = cm.status;
    });
    return map;
  }, [childMs]);

  // Filter milestones by direction
  const filtered = useMemo(() =>
    dirFilter === 'all' ? milestones : milestones.filter((m) => m.direction === dirFilter),
    [milestones, dirFilter]
  );

  // Group by age group, sorted
  const grouped = useMemo(() => {
    const map: Record<string, Milestone[]> = {};
    filtered.forEach((m) => {
      if (!map[m.ageGroup]) map[m.ageGroup] = [];
      map[m.ageGroup].push(m);
    });
    return AGE_ORDER.filter((ag) => map[ag]?.length).map((ag) => ({ ageGroup: ag, items: map[ag] }));
  }, [filtered]);

  // Progress stats for current direction filter
  const progressStats = useMemo(() => {
    const items = dirFilter === 'all' ? milestones : filtered;
    const achieved   = items.filter((m) => statusMap[m._id] === 'achieved').length;
    const inProgress = items.filter((m) => statusMap[m._id] === 'in_progress').length;
    return { achieved, inProgress, total: items.length };
  }, [filtered, milestones, statusMap, dirFilter]);

  const handleToggle = async (milestoneId: string, current: MilestoneStatus) => {
    if (!childId || !isParent) return;
    const newStatus = nextStatus(current);
    setUpdatingId(milestoneId);

    // Optimistic update
    setChildMs((prev) => {
      const existing = prev.find((cm) => {
        const mid = typeof cm.milestoneId === 'string'
          ? cm.milestoneId
          : (cm.milestoneId as any)?._id ?? String(cm.milestoneId);
        return mid === milestoneId;
      });
      if (existing) {
        return prev.map((cm) => {
          const mid = typeof cm.milestoneId === 'string'
            ? cm.milestoneId
            : (cm.milestoneId as any)?._id ?? String(cm.milestoneId);
          return mid === milestoneId ? { ...cm, status: newStatus } : cm;
        });
      }
      return [...prev, {
        _id: `tmp-${milestoneId}`,
        childId: childId!,
        milestoneId: milestoneId as any,
        status: newStatus,
        updatedBy: user!._id,
        updatedAt: new Date().toISOString(),
      }];
    });

    try {
      await milestonesApi.update(childId, milestoneId, newStatus);
    } catch {
      toast.error('Не удалось сохранить');
      // Revert
      setChildMs((prev) =>
        prev.map((cm) => {
          const mid = typeof cm.milestoneId === 'string'
            ? cm.milestoneId
            : (cm.milestoneId as any)?._id ?? String(cm.milestoneId);
          return mid === milestoneId ? { ...cm, status: current } : cm;
        })
      );
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-[#E07628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const dirCfg = dirFilter !== 'all' ? DIR_MAP[dirFilter] : null;

  return (
    <div className="space-y-5 pb-20">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/children/${childId}`)}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 transition flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900">Развитие</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {child?.name} · {progressStats.achieved} из {progressStats.total} достигнуто
          </p>
        </div>
      </div>

      {/* Direction filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {DIRECTIONS.map((dir) => {
          const active = dirFilter === dir.key;
          return (
            <button
              key={dir.key}
              onClick={() => setDirFilter(dir.key)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border-2 transition-all"
              style={active
                ? { borderColor: dir.color, backgroundColor: dir.bg, color: dir.color }
                : { borderColor: '#E5E7EB', color: '#6B7280', backgroundColor: '#FFFFFF' }}
            >
              {dir.label}
            </button>
          );
        })}
      </div>

      {/* Progress bar (shown when a direction is selected) */}
      {dirCfg && progressStats.total > 0 && (
        <ProgressBar
          achieved={progressStats.achieved}
          inProgress={progressStats.inProgress}
          total={progressStats.total}
        />
      )}

      {/* Overall summary when "All" is selected */}
      {dirFilter === 'all' && progressStats.total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: '✓', label: 'Достигнуто',    value: progressStats.achieved,                                                      color: '#16A34A', bg: '#F0FDF4' },
            { icon: '~', label: 'В процессе',    value: progressStats.inProgress,                                                    color: '#E07628', bg: '#FFF3EA' },
            { icon: '✗', label: 'Ещё впереди',   value: progressStats.total - progressStats.achieved - progressStats.inProgress,    color: '#9CA3AF', bg: '#F9FAFB' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold" style={{ backgroundColor: s.bg, color: s.color }}>
                {s.icon}
              </div>
              <span className="text-xl font-bold text-gray-900">{s.value}</span>
              <span className="text-[10px] text-gray-400 text-center leading-tight">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Status legend + edit hint */}
      <div className="flex items-center gap-3 flex-wrap">
        {Object.entries(STATUS_CFG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-lg flex items-center justify-center text-[11px] font-bold border-2"
              style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
              {cfg.icon}
            </span>
            <span className="text-[11px] text-gray-500">{cfg.label}</span>
          </div>
        ))}
        {isParent && (
          <span className="text-[11px] text-gray-400 ml-auto">нажмите чтобы изменить</span>
        )}
      </div>

      {/* Grouped milestones */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-gray-700 mb-1">Нет данных</p>
          <p className="text-xs text-gray-400">Попробуйте выбрать другое направление</p>
        </div>
      ) : (
        grouped.map(({ ageGroup, items }) => (
          <AgeGroupSection
            key={ageGroup}
            ageGroup={ageGroup}
            milestones={items}
            statusMap={statusMap}
            canEdit={isParent}
            onToggle={handleToggle}
            updatingId={updatingId}
          />
        ))
      )}
    </div>
  );
}
