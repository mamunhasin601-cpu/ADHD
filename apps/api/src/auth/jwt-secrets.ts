function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Переменная окружения ${name} не задана — сгенерируйте секрет и укажите его в .env`);
  }
  return value;
}

// Читаются один раз при загрузке модуля — приложение не запустится без реальных секретов
export const JWT_SECRET = requireEnv('JWT_SECRET');
export const JWT_REFRESH_SECRET = requireEnv('JWT_REFRESH_SECRET');
