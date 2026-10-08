/**
 * Общие реквизиты для юридических страниц (/privacy, /agreement).
 *
 * ТЕКСТ ПОДЛЕЖИТ ПРОВЕРКЕ ЮРИСТОМ РК ПЕРЕД ПУБЛИКАЦИЕЙ.
 * Заполните реквизиты оператора и провайдеров. При любом изменении текста поднимите
 * LEGAL_VERSION здесь и CONSENT_VERSION на сервере (umaisense-back-main/src/utils/consent.ts
 * и переменная окружения CONSENT_VERSION) — пользователи увидят окно с обновлённой политикой.
 */

export const LEGAL_VERSION = '2026-10-08';

export const OPERATOR = {
  name: 'ТОО «UmaiSense»',
  bin: '{{ЗАПОЛНИТЬ: БИН}}',
  address: '{{ЗАПОЛНИТЬ: юридический адрес}}',
  email: '{{ЗАПОЛНИТЬ: privacy@umaisense.kz}}',
  phone: '{{ЗАПОЛНИТЬ: телефон}}',
};

export const PROVIDERS = {
  hosting: '{{ЗАПОЛНИТЬ: провайдер серверов и хранилища в РК}}',
  email: '{{ЗАПОЛНИТЬ: сервис отправки писем}}',
  aiExternal: 'OpenAI, L.L.C. (США)',
  aiLocal: '{{ЗАПОЛНИТЬ: провайдер ИИ-модели в РК, если используется}}',
};
