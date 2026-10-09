import type { AxiosResponse } from 'axios';

/** Сохранить файл из ответа axios (responseType: 'blob'); имя берётся из Content-Disposition */
export const saveBlobResponse = (res: AxiosResponse<Blob>, fallbackName: string): void => {
  const cd = String(res.headers['content-disposition'] ?? '');
  const m = cd.match(/filename\*=UTF-8''([^;]+)/i);
  const fileName = m ? decodeURIComponent(m[1]) : fallbackName;
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
