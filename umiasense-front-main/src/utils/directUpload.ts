/**
 * Загрузка файла напрямую в хранилище по подписи от сервера (XHR — чтобы показывать прогресс).
 * Заголовок Authorization НЕ отправляется: подпись уже выдал сервер.
 *  • PUT  — S3 (одноразовая ссылка, тело — сам файл)
 *  • POST — Cloudinary (подписанные поля формы + файл)
 */
export type UploadTarget =
  | { method: 'PUT'; url: string; headers: Record<string, string> }
  | { method: 'POST'; url: string; fields: Record<string, string> };

export const uploadDirect = (
  target: UploadTarget,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.url);
    let body: Document | XMLHttpRequestBodyInit;
    if (target.method === 'PUT') {
      Object.entries(target.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      body = file;
    } else {
      const form = new FormData();
      Object.entries(target.fields).forEach(([k, v]) => form.append(k, v));
      form.append('file', file);
      body = form;
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(body);
  });
