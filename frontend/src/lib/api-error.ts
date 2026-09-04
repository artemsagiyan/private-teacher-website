export function apiErrorMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { message?: unknown } } })
    ?.response;
  const message = response?.data?.message;
  if (Array.isArray(message)) {
    return message.filter((part) => typeof part === 'string').join('. ');
  }
  if (typeof message === 'string' && message.trim()) return message;
  if (!response) {
    return 'Сервер недоступен. Запустите backend на порту 3001.';
  }
  return fallback;
}
