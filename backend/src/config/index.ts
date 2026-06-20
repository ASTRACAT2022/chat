export const config = {
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    expiration: process.env.JWT_EXPIRATION || '7d',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  },
  providers: {
    openrouter: {
      baseUrl: 'https://openrouter.ai/api/v1',
    },
    openai: {
      baseUrl: 'https://api.openai.com/v1',
    },
    anthropic: {
      baseUrl: 'https://api.anthropic.com/v1',
    },
    google: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    },
  },
};
