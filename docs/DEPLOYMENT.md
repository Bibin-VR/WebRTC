# WebRTC Platform - Production Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Local Deployment](#local-deployment)
4. [VPS/Cloud Deployment](#vpscloud-deployment)
5. [Docker Deployment](#docker-deployment)
6. [Kubernetes Deployment](#kubernetes-deployment)
7. [SSL/TLS Setup](#ssltls-setup)
8. [Backup & Recovery](#backup--recovery)
9. [Monitoring](#monitoring)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- Docker & Docker Compose 1.29+
- Nginx 1.20+
- PostgreSQL 13+ (or Docker container)
- Redis 6.0+ (or Docker container)
- 2+ GB RAM minimum (4GB+ recommended)
- 20GB+ disk space for databases and backups

### Security Requirements
- Valid SSL/TLS certificate (Let's Encrypt recommended)
- UFW/firewall configured
- Fail2Ban for brute-force protection
- SSH key authentication (no password login)

## Pre-Deployment Checklist

- [ ] SSL/TLS certificate obtained and validated
- [ ] Domain DNS configured to point to server IP
- [ ] Database backups tested and verified
- [ ] Environment variables configured in `.env.production`
- [ ] Firewall rules configured (22, 80, 443)
- [ ] Docker images built and tested locally
- [ ] Health checks verified in staging
- [ ] Monitoring and alerting configured
- [ ] Team notified of deployment schedule

## Local Deployment

### Development Environment
```bash
# Start development stack
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Access services
# Frontend: http://localhost:3000
# Backend API: http://localhost:8080
# WebSocket: ws://localhost:8080/ws
```

### Test Environment
```bash
# Create test environment
cp .env.production.example .env.test
nano .env.test  # Configure for test database

# Start test stack
docker-compose -f docker-compose.prod.yml --env-file .env.test up -d

# Run integration tests
npm run test:integration
cargo test --release
```

## VPS/Cloud Deployment

### 1. Server Setup (Ubuntu 22.04)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx
sudo apt install nginx -y

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y

# Create deployment user
sudo adduser deploy
sudo usermod -aG docker deploy
sudo visudo  # Add: deploy ALL=(ALL) NOPASSWD: /usr/bin/docker-compose
```

### 2. Configure Domain & SSL

```bash
# Point domain DNS to server IP (A record)
# Wait 24-48 hours for DNS propagation

# Verify DNS resolution
nslookup yourdomain.com

# Generate SSL certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Generate Diffie-Hellman parameter
sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048

# Copy SSL files to project
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/key.pem
sudo cp /etc/ssl/certs/dhparam.pem ./dhparam.pem
sudo chown deploy:deploy ./ssl/* ./dhparam.pem
```

### 3. Deploy Application

```bash
# Clone repository
git clone https://github.com/your-org/webrtc-platform.git
cd webrtc-platform

# Setup environment
cp .env.production.example .env.production
nano .env.production  # Edit with production values

# Make scripts executable
chmod +x scripts/*.sh

# Run deployment
./scripts/deploy.sh

# Verify deployment
curl https://yourdomain.com/health
```

### 4. Setup Auto-SSL Renewal

```bash
# Create renewal script
sudo tee /etc/letsencrypt/renewal-hooks/post/webrtc.sh > /dev/null <<'EOF'
#!/bin/bash
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /path/to/webrtc/ssl/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /path/to/webrtc/ssl/key.pem
docker-compose -f /path/to/webrtc/docker-compose.prod.yml restart nginx
EOF

sudo chmod +x /etc/letsencrypt/renewal-hooks/post/webrtc.sh

# Test renewal
sudo certbot renew --dry-run

# Enable auto-renewal cron job (runs twice daily)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## Docker Deployment

### Build Images

```bash
# Build backend image
cd backend
docker build -t webrtc-backend:v1.0.0 .
docker tag webrtc-backend:v1.0.0 ghcr.io/your-org/webrtc-backend:latest

# Build frontend image
cd ../frontend
docker build -t webrtc-frontend:v1.0.0 .
docker tag webrtc-frontend:v1.0.0 ghcr.io/your-org/webrtc-frontend:latest

# Push to registry
docker push ghcr.io/your-org/webrtc-backend:latest
docker push ghcr.io/your-org/webrtc-frontend:latest
```

### Deploy Stack

```bash
# Start production stack
docker-compose -f docker-compose.prod.yml up -d

# Verify services
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs

# Scale backend for load
docker-compose -f docker-compose.prod.yml up -d --scale backend=3
```

## Kubernetes Deployment

### Create Namespace & Secrets

```bash
# Create namespace
kubectl create namespace webrtc-platform

# Create secrets
kubectl -n webrtc-platform create secret generic webrtc-secrets \
  --from-literal=db-password=your-secure-password \
  --from-literal=jwt-secret=your-jwt-secret \
  --from-literal=redis-password=your-redis-password

# Create ConfigMap
kubectl -n webrtc-platform create configmap webrtc-config \
  --from-literal=environment=production \
  --from-literal=log-level=info
```

### Deploy Services

```bash
# Apply manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/redis-statefulset.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
kubectl apply -f k8s/ingress.yaml

# Wait for all pods
kubectl -n webrtc-platform wait --for=condition=ready pod --all --timeout=300s

# Verify deployment
kubectl -n webrtc-platform get all
```

## SSL/TLS Setup

### Let's Encrypt with Certbot

```bash
# Install SSL certificate
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email

# Copy to deployment directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/key.pem
sudo chown deploy:deploy ./ssl/*
```

### Self-Signed Certificate (Testing Only)

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 \
  -keyout ./ssl/key.pem \
  -out ./ssl/cert.pem \
  -days 365 -nodes
```

## Backup & Recovery

### Automated Backups

```bash
# Run backup script manually
./scripts/backup.sh

# Setup automated daily backups (cron)
(crontab -l 2>/dev/null; echo "0 2 * * * cd /path/to/webrtc && ./scripts/backup.sh") | crontab -

# Verify backup
ls -lh ./backups/
```

### Recovery from Backup

```bash
# List available backups
ls -lh ./backups/postgres_*.sql.gz

# Restore from backup
./scripts/rollback.sh ./backups/postgres_YYYYMMDD_HHMMSS.sql.gz

# Verify restoration
docker-compose -f docker-compose.prod.yml exec postgres psql -U webrtc -c "SELECT * FROM users LIMIT 1;"
```

### Backup Storage

```bash
# Archive backups to S3
aws s3 sync ./backups/ s3://your-bucket/webrtc-backups/

# Download backup from S3
aws s3 cp s3://your-bucket/webrtc-backups/postgres_YYYYMMDD_HHMMSS.sql.gz ./backups/
```

## Monitoring

### Health Checks

```bash
# API health check
curl https://yourdomain.com/health

# WebSocket connectivity
wscat -c wss://yourdomain.com/ws

# Database connection
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U webrtc

# Redis connection
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
```

### Logging

```bash
# View backend logs
docker-compose -f docker-compose.prod.yml logs -f backend --tail 100

# View Nginx logs
docker-compose -f docker-compose.prod.yml logs -f nginx --tail 100

# Export logs for analysis
docker-compose -f docker-compose.prod.yml logs backend > backend.log 2>&1
```

### Metrics & Monitoring

#### Prometheus Integration
```bash
# Add to docker-compose.prod.yml
prometheus:
  image: prom/prometheus:latest
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
    - ./metrics:/prometheus
  ports:
    - "9090:9090"
```

#### Resource Monitoring
```bash
# Monitor Docker containers
docker stats

# Monitor system resources
top
htop

# Check disk usage
df -h
du -sh ./backups/
```

## Troubleshooting

### Services Not Starting

```bash
# Check service logs
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs postgres

# Restart services
docker-compose -f docker-compose.prod.yml restart backend

# Rebuild images if needed
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Database Connection Issues

```bash
# Check database is running
docker-compose -f docker-compose.prod.yml ps postgres

# Test connection
docker-compose -f docker-compose.prod.yml exec postgres psql -U webrtc -c "SELECT version();"

# Check database size
docker-compose -f docker-compose.prod.yml exec postgres psql -U webrtc -c "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) FROM pg_database ORDER BY pg_database_size(pg_database.datname) DESC;"
```

### WebSocket Connection Issues

```bash
# Check WebSocket connectivity
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  https://yourdomain.com/ws

# Monitor WebSocket connections
docker-compose -f docker-compose.prod.yml logs backend | grep -i websocket
```

### SSL/TLS Issues

```bash
# Verify certificate
openssl s_client -connect yourdomain.com:443

# Check certificate expiration
echo | openssl s_client -connect yourdomain.com:443 -servername yourdomain.com 2>/dev/null | openssl x509 -noout -dates

# Test SSL configuration
nmap --script ssl-enum-ciphers -p 443 yourdomain.com
```

### Performance Issues

```bash
# Check CPU usage
docker stats --no-stream

# Check memory usage
free -h

# Check disk I/O
iostat -x 1

# Optimize queries with EXPLAIN
docker-compose -f docker-compose.prod.yml exec postgres psql -U webrtc -c "EXPLAIN ANALYZE SELECT * FROM users WHERE id = '...';"
```

## Production Checklist

- [ ] SSL/TLS certificates installed and valid
- [ ] Automated backups running and verified
- [ ] Health checks passing for all services
- [ ] Monitoring and alerting configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Database indexed for common queries
- [ ] Connection pooling configured
- [ ] Log rotation enabled
- [ ] Fail2Ban protecting SSH and APIs
- [ ] Firewall rules reviewed and tested
- [ ] Team trained on deployment procedures
- [ ] Incident response plan documented
- [ ] Regular backup restoration tests scheduled

## Support

For issues and questions:
1. Check logs: `docker-compose logs -f`
2. Review [TROUBLESHOOTING](#troubleshooting) section
3. Consult [ARCHITECTURE.md](ARCHITECTURE.md)
4. Open GitHub issue with logs and error messages
