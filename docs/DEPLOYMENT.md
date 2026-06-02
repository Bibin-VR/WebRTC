# Deployment Guide

## Overview
This guide covers deploying the WebRTC platform to production environments. Supported deployment methods:
1. Docker containers on VPS
2. Kubernetes cluster
3. Cloud providers (AWS, Google Cloud, DigitalOcean)

## Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Code reviewed and merged to main
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] SSL/TLS certificates obtained
- [ ] Domain configured
- [ ] Backup strategy in place
- [ ] Monitoring/logging configured

## Production Environment Setup

### Environment Variables

Create `.env.production`:
```
# Database
DATABASE_URL=postgresql://user:password@db-host:5432/webrtc_prod
DATABASE_POOL_SIZE=20

# Security
JWT_SECRET=<generate-strong-secret-32-chars-minimum>
JWT_EXPIRY_HOURS=1
REFRESH_TOKEN_EXPIRY_DAYS=7

# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
ENVIRONMENT=production
LOG_LEVEL=info

# CORS & Security
CORS_ORIGIN=https://webrtc-platform.com
ALLOWED_ORIGINS=webrtc-platform.com,www.webrtc-platform.com
SECURE_COOKIES=true
HSTS_MAX_AGE=31536000

# Optional Services
REDIS_URL=redis://redis-host:6379
SENTRY_DSN=https://your-sentry-dsn
```

## Docker Deployment

### Build Images

#### Backend
```bash
cd backend

# Build Rust binary
cargo build --release

# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM rust:1.70 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/webrtc_backend /usr/local/bin/
EXPOSE 8080
CMD ["webrtc_backend"]
EOF

# Build image
docker build -t webrtc-backend:latest .
docker tag webrtc-backend:latest webrtc-backend:v1.0.0
```

#### Frontend
```bash
cd frontend

# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
RUN npm install -g serve
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
EOF

# Build image
docker build -t webrtc-frontend:latest .
docker tag webrtc-frontend:latest webrtc-frontend:v1.0.0
```

### Docker Compose Production

Create `docker-compose.prod.yml`:
```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    container_name: webrtc_db_prod
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: webrtc_prod
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    networks:
      - webrtc_prod_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: webrtc-backend:latest
    container_name: webrtc_api_prod
    restart: always
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/webrtc_prod
      JWT_SECRET: ${JWT_SECRET}
      ENVIRONMENT: production
    ports:
      - "8080:8080"
    networks:
      - webrtc_prod_network

  frontend:
    image: webrtc-frontend:latest
    container_name: webrtc_web_prod
    restart: always
    ports:
      - "3000:3000"
    networks:
      - webrtc_prod_network

  nginx:
    image: nginx:alpine
    container_name: webrtc_nginx_prod
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
      - frontend
    networks:
      - webrtc_prod_network

volumes:
  postgres_prod_data:
    driver: local

networks:
  webrtc_prod_network:
    driver: bridge
```

### Nginx Configuration

Create `nginx.conf`:
```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:8080;
    }

    upstream frontend {
        server frontend:3000;
    }

    server {
        listen 80;
        server_name webrtc-platform.com www.webrtc-platform.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name webrtc-platform.com www.webrtc-platform.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # API proxy
        location /api/ {
            proxy_pass http://backend/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_buffering off;
        }

        # WebSocket
        location /ws {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 86400;
        }

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}
```

### Deploy Steps

```bash
# 1. SSH into server
ssh user@server.com

# 2. Clone repository
git clone https://github.com/your-org/webrtc-platform.git
cd webrtc-platform

# 3. Set production environment
cp .env.production.example .env.production
# Edit .env.production with actual values

# 4. Generate SSL certificates (Let's Encrypt)
sudo certbot certonly --standalone -d webrtc-platform.com -d www.webrtc-platform.com

# 5. Copy certificates
sudo cp /etc/letsencrypt/live/webrtc-platform.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/webrtc-platform.com/privkey.pem ./ssl/key.pem
sudo chown $USER:$USER ./ssl/*

# 6. Start services
docker-compose -f docker-compose.prod.yml up -d

# 7. Run migrations
docker-compose -f docker-compose.prod.yml exec backend cargo sqlx migrate run

# 8. Verify deployment
docker-compose -f docker-compose.prod.yml ps
curl https://webrtc-platform.com/health
```

## Kubernetes Deployment

### Create Kubernetes Manifests

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: webrtc-platform

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: webrtc-config
  namespace: webrtc-platform
data:
  LOG_LEVEL: info
  ENVIRONMENT: production

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: webrtc-secrets
  namespace: webrtc-platform
type: Opaque
stringData:
  DATABASE_URL: postgresql://user:password@postgres:5432/webrtc
  JWT_SECRET: your-super-secret-key

---
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webrtc-backend
  namespace: webrtc-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: webrtc-backend
  template:
    metadata:
      labels:
        app: webrtc-backend
    spec:
      containers:
      - name: backend
        image: webrtc-backend:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: webrtc-secrets
              key: DATABASE_URL
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: webrtc-secrets
              key: JWT_SECRET
        envFrom:
        - configMapRef:
            name: webrtc-config
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
# k8s/backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: webrtc-backend
  namespace: webrtc-platform
spec:
  selector:
    app: webrtc-backend
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: webrtc-ingress
  namespace: webrtc-platform
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - webrtc-platform.com
    secretName: webrtc-tls
  rules:
  - host: webrtc-platform.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: webrtc-backend
            port:
              number: 80
```

### Deploy to Kubernetes

```bash
# 1. Create namespace
kubectl apply -f k8s/namespace.yaml

# 2. Create secrets
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml

# 3. Deploy backend
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml

# 4. Deploy ingress
kubectl apply -f k8s/ingress.yaml

# 5. Verify
kubectl get pods -n webrtc-platform
kubectl get ingress -n webrtc-platform
```

## Database Backups

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/webrtc"
DB_HOST="db"
DB_USER="postgres"
DB_NAME="webrtc_prod"
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Create backup
docker-compose exec -T db pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/backup_$BACKUP_DATE.sql.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/backup_$BACKUP_DATE.sql.gz"
```

Schedule with cron:
```bash
# Daily backup at 2 AM
0 2 * * * /path/to/backup.sh
```

## Monitoring & Logging

### Set Up Monitoring
- Use Prometheus for metrics
- Use Grafana for dashboards
- Use ELK stack for logging
- Monitor WebRTC connection stats
- Alert on error rates and latency

### Health Checks
```
GET /health → 200 OK
GET /ready  → 200 OK when ready for traffic
```

## Scaling Considerations

1. **Horizontal Scaling**: Run multiple backend instances behind load balancer
2. **Database**: Use connection pooling (pgBouncer), read replicas
3. **WebSocket**: Implement session affinity or Redis pub/sub for multi-node
4. **File Storage**: Use S3 or object storage for file transfers
5. **CDN**: Cache static assets on CDN

## Security Hardening

1. Enable WAF (Web Application Firewall)
2. Implement rate limiting at load balancer level
3. Use VPN for database connections
4. Enable encryption at rest for databases
5. Regular security audits and penetration testing
6. Keep dependencies updated
7. Monitor for vulnerabilities with tools like Snyk

## Rollback Procedure

```bash
# Get previous image version
docker images | grep webrtc-backend

# Roll back to previous version
docker tag webrtc-backend:v1.0.0 webrtc-backend:latest
docker-compose -f docker-compose.prod.yml up -d backend

# Verify rollback
docker-compose -f docker-compose.prod.yml logs backend
```

## Monitoring Checklist

- [ ] Server uptime monitoring
- [ ] Database performance monitoring
- [ ] Application error rate monitoring
- [ ] WebRTC connection success rate
- [ ] API response time monitoring
- [ ] Disk space monitoring
- [ ] Network bandwidth monitoring
- [ ] Security event logging
