# SureEdge AI Scanner — VPS Setup

## 1. Create DigitalOcean Droplet
- Plan: Basic $6/month (1GB RAM, 25GB SSD)
- OS: Ubuntu 24.04 LTS
- Region: Frankfurt (closest to EU bookmakers)

## 2. SSH into droplet
```bash
ssh root@YOUR_DROPLET_IP
```

## 3. Install Node.js and PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pm2 typescript ts-node
```

## 4. Upload scanner files
```bash
# From your local machine:
scp -r scanner/ root@YOUR_DROPLET_IP:/root/sureedge-scanner/
```

## 5. Set environment variables
```bash
export TELEGRAM_BOT_TOKEN="your_token"
export TELEGRAM_CHAT_ID="your_chat_id"
export ODDS_API_KEY="your_key"
export CRON_SECRET="sureedge-cron-2026"
export SUREEDGE_URL="https://sureedge-ai.vercel.app"

# Make permanent
echo 'export TELEGRAM_BOT_TOKEN="your_token"' >> ~/.bashrc
echo 'export TELEGRAM_CHAT_ID="your_chat_id"' >> ~/.bashrc
echo 'export ODDS_API_KEY="your_key"' >> ~/.bashrc
source ~/.bashrc
```

## 6. Build and start
```bash
cd /root/sureedge-scanner
npm install
npm run build
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Auto-start on reboot
```

## 7. Monitor
```bash
pm2 logs sureedge-scanner     # Live logs
pm2 monit                      # Dashboard
pm2 status                     # Status
```

## What this does
- Scans every 10 seconds across all sports
- Rotates through: NHL, MLB, Tennis, NBA, La Liga, Bundesliga, Serie A, Ligue 1, EPL, MMA
- Sends Telegram alerts for every genuine arb >= 0.5% on your funded books
- Never stops — PM2 restarts it if it crashes
- Costs $6/month (DigitalOcean basic droplet)

## Credit budget
- 10s scan × 6 per minute × 60 minutes = 360 credits/hour
- TOO FAST for free tier (500/month)
- Solution: Set SCAN_INTERVAL_MS=300000 (5 minutes) on free tier
- Or upgrade The Odds API to $19/month (10,000 credits) for 10-second scanning
