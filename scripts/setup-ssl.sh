#!/bin/bash
set -euo pipefail

DOMAIN=${1:-sureedge.ai}
EMAIL=${2:-}

if [ -z "$EMAIL" ]; then
    echo "Usage: bash scripts/setup-ssl.sh <domain> <email>"
    echo "Example: bash scripts/setup-ssl.sh sureedge.ai admin@sureedge.ai"
    exit 1
fi

echo "🔒 Setting up SSL for $DOMAIN..."

# Install certbot if needed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    apt-get update && apt-get install -y certbot
fi

# Stop nginx temporarily for standalone certificate
echo "⏸️  Stopping nginx for certificate acquisition..."
docker stop sureedge-proxy 2>/dev/null || true

# Get SSL certificate
echo "🔐 Requesting SSL certificate..."
certbot certonly --standalone \
    -d $DOMAIN \
    -d www.$DOMAIN \
    --non-interactive \
    --agree-tos \
    -m $EMAIL

# Update nginx config to use SSL
echo "📝 Updating nginx configuration..."
cat > /etc/nginx/conf.d/sureedge-ssl.conf << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://$DOMAIN\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location /api/auth/ {
        limit_req zone=auth burst=3 nodelay;
        proxy_pass http://nextjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /api/ {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://nextjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location / {
        proxy_pass http://nextjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Restart nginx
echo "▶️  Starting nginx..."
docker start sureedge-proxy 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ SSL configured for $DOMAIN"
echo "═══════════════════════════════════════════"
echo ""
echo "  🔒 HTTPS:        https://$DOMAIN"
echo "  🔄 HTTP → HTTPS:  Automatic redirect"
echo ""
echo "  📋 Auto-renewal: certbot renew runs automatically"
echo "     Add to crontab: 0 0 * * 0 certbot renew --quiet"
echo ""
