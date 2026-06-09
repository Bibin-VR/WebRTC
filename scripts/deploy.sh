#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${GREEN}WebRTC Platform Deployment Script${NC}"
echo "=================================="

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"

    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker is not installed${NC}"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}Docker Compose is not installed${NC}"
        exit 1
    fi

    if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
        echo -e "${RED}.env.production file not found${NC}"
        echo "Please create .env.production based on .env.production.example"
        exit 1
    fi

    echo -e "${GREEN}✓ All prerequisites met${NC}"
}

# Pull latest images
pull_images() {
    echo -e "${YELLOW}Pulling latest Docker images...${NC}"
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" pull
    echo -e "${GREEN}✓ Images pulled${NC}"
}

# Run database migrations
run_migrations() {
    echo -e "${YELLOW}Running database migrations...${NC}"
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" run --rm backend ./webrtc-backend --migrate
    echo -e "${GREEN}✓ Migrations completed${NC}"
}

# Start services
start_services() {
    echo -e "${YELLOW}Starting services...${NC}"
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" up -d

    # Wait for services to be healthy
    echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
    sleep 10

    for service in postgres redis backend frontend nginx; do
        if docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T "$service" true &> /dev/null; then
            echo -e "${GREEN}✓ $service is healthy${NC}"
        else
            echo -e "${RED}✗ $service failed to start${NC}"
            docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" logs "$service"
            exit 1
        fi
    done
}

# Health check
health_check() {
    echo -e "${YELLOW}Running health checks...${NC}"

    if curl -sf http://localhost/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API is healthy${NC}"
    else
        echo -e "${RED}✗ API health check failed${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ All health checks passed${NC}"
}

# Main execution
main() {
    check_prerequisites
    pull_images

    read -p "Run database migrations? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_migrations
    fi

    start_services
    health_check

    echo ""
    echo -e "${GREEN}=================================="
    echo "Deployment completed successfully!"
    echo "=================================="
    echo -e "API: https://$(grep DOMAIN "$PROJECT_ROOT/.env.production" | cut -d '=' -f 2)/api"
    echo -e "Web: https://$(grep DOMAIN "$PROJECT_ROOT/.env.production" | cut -d '=' -f 2)"
    echo -e "${NC}"
}

main "$@"
