module.exports = {
  apps: [{
    name:         'sureedge-scanner',
    script:       'dist/index.js',
    instances:    1,
    autorestart:  true,
    watch:        false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV:           'production',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID:   process.env.TELEGRAM_CHAT_ID,
      ODDS_API_KEY:       process.env.ODDS_API_KEY,
      CRON_SECRET:        'sureedge-cron-2026',
      SUREEDGE_URL:       'https://sureedge-ai.vercel.app',
    },
    error_file:   'logs/err.log',
    out_file:     'logs/out.log',
    log_file:     'logs/combined.log',
    time:         true,
  }],
};
