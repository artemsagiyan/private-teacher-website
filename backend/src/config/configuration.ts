export default () => ({
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    name: process.env.DATABASE_NAME || 'tutor_platform',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'noreply@tutor-platform.com',
  },
  livekit: {
    apiKey: process.env.LIVEKIT_API_KEY || 'devkey',
    apiSecret: process.env.LIVEKIT_API_SECRET || 'devsecret1234567890abcdef',
    url: process.env.LIVEKIT_URL || 'ws://localhost:7880',
    roomEmptyTimeoutSeconds: parseInt(process.env.LESSON_EMPTY_TIMEOUT_SECONDS, 10) || 1800,
    joinEarlyMinutes: parseInt(process.env.LESSON_JOIN_EARLY_MINUTES, 10) || 30,
    joinLateMinutes: parseInt(process.env.LESSON_JOIN_LATE_MINUTES, 10) || 120,
  },
  storage: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT, 10) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'tutor',
    secretKey: process.env.MINIO_SECRET_KEY || 'tutor-secret',
    bucket: process.env.MINIO_BUCKET || 'tutor-files',
    region: process.env.MINIO_REGION || 'us-east-1',
    egressEndpoint:
      process.env.MINIO_EGRESS_ENDPOINT || 'http://localhost:9000',
  },
  transcription: {
    url: process.env.TRANSCRIBER_URL || 'http://localhost:8000',
    language: process.env.TRANSCRIBER_LANGUAGE || 'ru',
  },
  ollama: {
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'qwen3:8b',
  },
});
