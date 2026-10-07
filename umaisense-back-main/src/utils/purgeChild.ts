import { Types } from 'mongoose';
import Child from '../models/Child';
import DocumentModel from '../models/Document';
import Emotion from '../models/Emotion';
import Activity from '../models/Activity';
import DiaryEntry from '../models/DiaryEntry';
import Recommendation from '../models/Recommendation';
import TaskRating from '../models/TaskRating';
import { ChildMilestone } from '../models/Milestone';
import EnrollmentRequest from '../models/EnrollmentRequest';
import Assignment from '../models/Assignment';
import Session from '../models/Session';
import { isProviderAvailable, removeStored, StorageProvider } from './documentStorage';
import { todayStr } from './schedule';

/**
 * Полное удаление данных ребёнка (по запросу родителя или при удалении аккаунта):
 * медицинские документы (вместе с файлами в хранилище), наблюдения, рекомендации, прогресс.
 * Заявки обезличиваются (удаляются телефон и комментарий), записи к тренерам и будущие
 * занятия отменяются — чтобы у тренеров не остались «висящие» занятия.
 * Журнал доступа и согласия сохраняются: это доказательства законной обработки.
 */
export const purgeChildData = async (childId: Types.ObjectId | string): Promise<void> => {
  const id = new Types.ObjectId(String(childId));

  const docs = await DocumentModel.find({ childId: id }).select('storageKey storageProvider');
  for (const d of docs) {
    const p: StorageProvider = d.storageProvider === 'cloudinary' ? 'cloudinary' : 's3';
    if (d.storageKey && isProviderAvailable(p)) {
      await removeStored(p, d.storageKey).catch((err) =>
        console.error('[purge] file delete failed:', d.storageKey, err)
      );
    }
  }

  await Promise.all([
    DocumentModel.deleteMany({ childId: id }),
    Emotion.deleteMany({ childId: id }),
    Activity.deleteMany({ childId: id }),
    DiaryEntry.deleteMany({ childId: id }),
    Recommendation.deleteMany({ childId: id }),
    TaskRating.deleteMany({ childId: id }),
    ChildMilestone.deleteMany({ childId: id }),
    EnrollmentRequest.updateMany(
      { childId: id },
      { $set: { status: 'cancelled', cancelledBy: 'parent' }, $unset: { contactPhone: 1, comment: 1 } }
    ),
    Assignment.updateMany(
      { childId: id, status: 'active' },
      { status: 'cancelled', cancelReason: 'Профиль ребёнка удалён', cancelledAt: new Date() }
    ),
    Session.updateMany(
      { childId: id, status: 'scheduled', date: { $gte: todayStr() } },
      { status: 'cancelled', cancelReason: 'Профиль ребёнка удалён' }
    ),
  ]);

  await Child.deleteOne({ _id: id });
};
