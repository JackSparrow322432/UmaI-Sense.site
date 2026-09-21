import { Response } from 'express';
import OpenAI from 'openai';
import { AuthRequest } from '../types';
import Child from '../models/Child';
import DocumentModel from '../models/Document';
import { uploadImage } from '../utils/upload';

// ─── OpenAI client (only initialised when key is present) ────────────────────

const getOpenAI = (): OpenAI | null => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
};

// ─── Access helper — same rule as children.controller: parent or linked trainer ──

const getChildWithAccess = async (childId: string, userId?: string) => {
  const child = await Child.findById(childId);
  if (!child) return null;
  const hasAccess =
    child.parentId.toString() === userId ||
    child.trainers.some((t) => t.toString() === userId);
  return hasAccess ? child : null;
};

// ─── AI explanation ───────────────────────────────────────────────────────────

const explainDocumentImage = async (fileUrl: string): Promise<{ status: 'done' | 'failed'; text: string }> => {
  const client = getOpenAI();
  if (!client) {
    return {
      status: 'failed',
      text: 'Автоматическое распознавание документа сейчас недоступно (не настроен ИИ-сервис). Файл сохранён, вы можете открыть его и прочитать вручную.',
    };
  }

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 900,
      messages: [
        {
          role: 'system',
          content:
            'Ты помощник, который читает изображения документов (медицинские справки, заключения специалистов, рецепты, выписки и т.п.), связанных с ребёнком с особенностями развития, и подробно объясняет их содержание родителю простым, понятным языком. Отвечай только на русском языке, обычным печатным связным текстом, разбитым на абзацы. Не используй markdown, звёздочки, списки с маркерами и заголовки — только простой читаемый текст.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Прочитай этот документ на изображении и подробно объясни его содержание: что это за документ, какие ключевые данные, диагнозы, рекомендации или выводы в нём указаны, и что это может означать для ребёнка и его развития. Если текст на изображении плохо читается или это не документ, честно об этом напиши.',
            },
            { type: 'image_url', image_url: { url: fileUrl } },
          ],
        },
      ],
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty AI response');
    return { status: 'done', text };
  } catch (err) {
    console.error('[Documents] AI explain error:', err);
    return {
      status: 'failed',
      text: 'Не удалось автоматически распознать документ. Файл сохранён, попробуйте загрузить более чёткое фото.',
    };
  }
};

// ─── GET /api/documents/:childId ───────────────────────────────────────────────

export const listDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await getChildWithAccess(req.params['childId'] as string, req.user?.id);
    if (!child) {
      res.status(403).json({ message: 'Доступ запрещён' });
      return;
    }
    const documents = await DocumentModel.find({ childId: child._id })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'name role');
    res.json(documents);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// ─── POST /api/documents/:childId  (multipart, field name "file") ─────────────

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await getChildWithAccess(req.params['childId'] as string, req.user?.id);
    if (!child) {
      res.status(403).json({ message: 'Доступ запрещён' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: 'Файл не загружен' });
      return;
    }

    const fileUrl = await uploadImage(req.file);

    const document = await DocumentModel.create({
      childId: child._id,
      uploadedBy: req.user?.id,
      fileUrl,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      aiStatus: 'pending',
    });

    // Читаем изображение и составляем разъяснение сразу же (синхронно, чтобы
    // не полагаться на фоновые задачи, недоступные в серверлесс-окружении).
    const { status, text } = await explainDocumentImage(fileUrl);
    document.aiStatus = status;
    document.aiExplanation = text;
    await document.save();

    res.status(201).json(document);
  } catch (err) {
    console.error('[Documents] upload error:', err);
    res.status(500).json({ message: 'Ошибка загрузки документа' });
  }
};

// ─── DELETE /api/documents/:childId/:documentId ────────────────────────────────

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const child = await getChildWithAccess(req.params['childId'] as string, req.user?.id);
    if (!child) {
      res.status(403).json({ message: 'Доступ запрещён' });
      return;
    }
    const document = await DocumentModel.findOne({ _id: req.params['documentId'], childId: child._id });
    if (!document) {
      res.status(404).json({ message: 'Документ не найден' });
      return;
    }
    const isOwner = document.uploadedBy.toString() === req.user?.id;
    const isParent = child.parentId.toString() === req.user?.id;
    if (!isOwner && !isParent) {
      res.status(403).json({ message: 'Доступ запрещён' });
      return;
    }
    await document.deleteOne();
    res.json({ message: 'Документ удалён' });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
