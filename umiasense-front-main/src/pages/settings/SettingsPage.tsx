import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authApi, uploadApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import FileDropzone from '../../components/common/FileDropzone';
import { UPLOAD_RULES } from '../../utils/uploadRules';
import MyConsents from '../../components/legal/MyConsents';

export default function SettingsPage() {
  const { user, setUser, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const [name,          setName]          = useState(user?.name ?? '');
  const [photo,         setPhoto]         = useState(user?.photo ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto,setUploadingPhoto]= useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount,   setDeletingAccount]   = useState(false);

  const handlePhotoChange = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const { data } = await uploadApi.image(file, 'avatar');
      setPhoto(data.url);
      toast.success('Фото загружено — не забудьте сохранить профиль');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка загрузки фото');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast.error('Имя должно содержать минимум 2 символа');
      return;
    }
    setSavingProfile(true);
    try {
      const { data } = await authApi.updateProfile({ name: name.trim(), photo: photo || undefined });
      setUser(data);
      toast.success('Профиль обновлён');
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await authApi.deleteAccount();
      clearAuth();
      navigate('/login');
      toast.success('Аккаунт удалён');
    } catch {
      toast.error('Ошибка удаления аккаунта');
      setDeletingAccount(false);
    }
  };

  const profileChanged = name.trim() !== (user?.name ?? '') || photo !== (user?.photo ?? '');

  const inputClass = 'w-full border border-gray-200 bg-white rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#E07628] transition-colors placeholder:text-gray-400';

  return (
    <div className="space-y-5 pb-20 max-w-lg">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Настройки</h1>
        <p className="text-sm text-gray-400 mt-0.5">{user?.email}</p>
      </div>

      {/* ── Profile section ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-900">Профиль</p>
        </div>
        <div className="p-5 space-y-4">

          {/* Avatar — рамка загрузки с подсказкой о форматах и разрешении */}
          <div>
            <p className="text-sm font-medium text-gray-800">{user?.name || 'Без имени'}</p>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">{user?.role === 'parent' ? 'Родитель' : user?.role === 'admin' ? 'Администратор' : 'Тренер'}</p>
            <FileDropzone
              rule={UPLOAD_RULES.avatar}
              variant="avatar"
              title={photo ? 'Изменить фото профиля' : 'Загрузить фото профиля'}
              preview={photo}
              uploading={uploadingPhoto}
              onFile={handlePhotoChange}
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Имя</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше имя"
              className={inputClass}
            />
          </div>

          {/* Save */}
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile || !profileChanged}
            className="w-full bg-[#E07628] hover:bg-[#c96a21] text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-40"
          >
            {savingProfile ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>

      {/* ── Account actions ─────────────────────────────────────────────────── */}
      {/* Мои согласия на обработку персональных данных */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-medium text-gray-900">Мои согласия</p>
          <p className="text-xs text-gray-400 mt-0.5">Какие согласия вы дали, когда, и на какой редакции политики</p>
        </div>
        <div className="p-5">
          <MyConsents />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <span className="text-sm text-gray-700">Выйти из аккаунта</span>
        </button>

        {/* Delete account */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-red-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </div>
          <div>
            <p className="text-sm text-red-500">Удалить аккаунт</p>
            <p className="text-xs text-gray-400 mt-0.5">Все данные будут удалены безвозвратно</p>
          </div>
        </button>
      </div>

      {/* ── App info ─────────────────────────────────────────────────────────── */}
      <div className="text-center">
        <p className="text-xs text-gray-300">UmaiSense · v1.0</p>
      </div>

      {/* ── Delete confirm overlay ───────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-xl overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-6">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 text-center">Удалить аккаунт?</h3>
              <p className="text-sm text-gray-500 text-center mt-2 leading-relaxed">
                Все ваши данные, профили детей и записи будут удалены навсегда. Это действие нельзя отменить.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg py-2.5 text-sm font-medium transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {deletingAccount ? 'Удаление...' : 'Удалить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
