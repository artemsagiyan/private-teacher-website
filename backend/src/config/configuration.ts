function requireInProd(name: string, fallback?: string) {
  const value = process.env[name] || fallback;
  if (process.env.NODE_ENV === 'production' && !process.env[name]) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

export default () => {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.SMTP_DISABLED !== 'true' &&
    (!process.env.SMTP_USER || !process.env.SMTP_PASS)
  ) {
    throw new Error(
      'Missing SMTP_USER/SMTP_PASS in production (or set SMTP_DISABLED=true)',
    );
  }

  return {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  enableSeed:
    process.env.ENABLE_SEED === 'true' ||
    (process.env.NODE_ENV || 'development') !== 'production',
  smtpDisabled: process.env.SMTP_DISABLED === 'true',
  adminBootstrap: {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  },
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT, 10) || 5433,
    user: process.env.DATABASE_USER || 'postgres',
    password: requireInProd('DATABASE_PASSWORD', 'postgres'),
    name: process.env.DATABASE_NAME || 'tutor_platform',
  },
  jwt: {
    secret: requireInProd('JWT_SECRET', 'dev-secret'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: requireInProd('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ||
      'http://localhost:3001/api/auth/google/callback',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'noreply@tutor-platform.com',
  },
  livekit: {
    apiKey: requireInProd('LIVEKIT_API_KEY', 'devkey'),
    apiSecret: requireInProd(
      'LIVEKIT_API_SECRET',
      'devsecret1234567890abcdef',
    ),
    url: process.env.LIVEKIT_URL || 'ws://localhost:7880',
    roomEmptyTimeoutSeconds:
      parseInt(process.env.LESSON_EMPTY_TIMEOUT_SECONDS, 10) || 1800,
    joinEarlyMinutes: parseInt(process.env.LESSON_JOIN_EARLY_MINUTES, 10) || 30,
    joinLateMinutes: parseInt(process.env.LESSON_JOIN_LATE_MINUTES, 10) || 120,
  },
  storage: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT, 10) || 9010,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: requireInProd('MINIO_ACCESS_KEY', 'tutor'),
    secretKey: requireInProd('MINIO_SECRET_KEY', 'tutor-secret'),
    bucket: process.env.MINIO_BUCKET || 'tutor-files',
    region: process.env.MINIO_REGION || 'us-east-1',
    egressEndpoint:
      process.env.MINIO_EGRESS_ENDPOINT || 'http://localhost:9010',
  },
  transcription: {
    url: process.env.TRANSCRIBER_URL || 'http://localhost:8000',
    language: process.env.TRANSCRIBER_LANGUAGE || 'ru',
  },
  ollama: {
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'qwen3:8b',
  },
};
};
