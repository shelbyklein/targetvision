#!/bin/bash

# TargetVision Docker Setup Script
# This script helps set up the Docker environment for TargetVision

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    print_info "Docker is installed ✓"
}

# Check if Docker Compose is installed
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    print_info "Docker Compose is installed ✓"
}

# Create .env file from template if it doesn't exist
setup_env_file() {
    if [ ! -f .env ]; then
        if [ -f .env.template ]; then
            cp .env.template .env
            print_info "Created .env file from template"
            print_warn "Please edit .env file and add your API keys and configuration"
            
            # Prompt for essential configuration
            read -p "Would you like to configure essential settings now? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                configure_env
            fi
        else
            print_error ".env.template file not found"
            exit 1
        fi
    else
        print_info ".env file already exists ✓"
    fi
}

# Configure essential environment variables
configure_env() {
    print_info "Configuring essential settings..."
    
    # Database password
    read -sp "Enter a secure database password: " db_pass
    echo
    sed -i.bak "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$db_pass/" .env
    
    # SmugMug API credentials
    read -p "Enter your SmugMug API Key (or press Enter to skip): " smugmug_key
    if [ ! -z "$smugmug_key" ]; then
        sed -i.bak "s/SMUGMUG_API_KEY=.*/SMUGMUG_API_KEY=$smugmug_key/" .env
        
        read -sp "Enter your SmugMug API Secret: " smugmug_secret
        echo
        sed -i.bak "s/SMUGMUG_API_SECRET=.*/SMUGMUG_API_SECRET=$smugmug_secret/" .env
    fi
    
    # AI API keys
    read -p "Enter your Anthropic API Key (or press Enter to skip): " anthropic_key
    if [ ! -z "$anthropic_key" ]; then
        sed -i.bak "s/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$anthropic_key/" .env
    fi
    
    read -p "Enter your OpenAI API Key (or press Enter to skip): " openai_key
    if [ ! -z "$openai_key" ]; then
        sed -i.bak "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=$openai_key/" .env
    fi
    
    # Clean up backup files
    rm -f .env.bak
    
    print_info "Configuration complete ✓"
}

# Build Docker images
build_images() {
    print_info "Building Docker images..."
    
    if [ "$1" == "dev" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml build
    elif [ "$1" == "prod" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
    else
        docker-compose build
    fi
    
    print_info "Docker images built successfully ✓"
}

# Start services
start_services() {
    local env=$1
    print_info "Starting services in $env mode..."
    
    if [ "$env" == "dev" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
    elif [ "$env" == "prod" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    else
        docker-compose up -d
    fi
    
    print_info "Services started successfully ✓"
    
    # Wait for services to be ready
    print_info "Waiting for services to be ready..."
    sleep 10
    
    # Check service health
    check_service_health
}

# Check service health
check_service_health() {
    print_info "Checking service health..."
    
    # Check backend health
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        print_info "Backend is healthy ✓"
    else
        print_warn "Backend is not responding yet"
    fi
    
    # Check frontend
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        print_info "Frontend is healthy ✓"
    else
        print_warn "Frontend is not responding yet"
    fi
    
    # Check database
    if docker-compose exec -T database pg_isready -U targetvision > /dev/null 2>&1; then
        print_info "Database is ready ✓"
    else
        print_warn "Database is not ready yet"
    fi
}

# Stop services
stop_services() {
    print_info "Stopping services..."
    docker-compose down
    print_info "Services stopped ✓"
}

# Clean up everything
clean_all() {
    print_warn "This will remove all containers, images, and volumes!"
    read -p "Are you sure? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v --rmi all
        print_info "Clean up complete ✓"
    else
        print_info "Clean up cancelled"
    fi
}

# Show logs
show_logs() {
    local service=$1
    if [ -z "$service" ]; then
        docker-compose logs -f
    else
        docker-compose logs -f $service
    fi
}

# Main menu
main_menu() {
    echo
    echo "TargetVision Docker Setup"
    echo "========================="
    echo
    echo "1) Initial setup (create .env and build images)"
    echo "2) Start services (development)"
    echo "3) Start services (production)"
    echo "4) Stop services"
    echo "5) View logs"
    echo "6) Check service health"
    echo "7) Rebuild images"
    echo "8) Clean everything (removes all data!)"
    echo "9) Exit"
    echo
    read -p "Select an option: " option
    
    case $option in
        1)
            setup_env_file
            build_images
            ;;
        2)
            start_services dev
            ;;
        3)
            start_services prod
            ;;
        4)
            stop_services
            ;;
        5)
            echo "Which service? (backend/frontend/database/redis or press Enter for all):"
            read service
            show_logs $service
            ;;
        6)
            check_service_health
            ;;
        7)
            echo "Build for (dev/prod/default):"
            read env
            build_images $env
            ;;
        8)
            clean_all
            ;;
        9)
            exit 0
            ;;
        *)
            print_error "Invalid option"
            ;;
    esac
    
    # Show menu again
    main_menu
}

# Main script
print_info "Starting TargetVision Docker Setup..."

# Check prerequisites
check_docker
check_docker_compose

# If no arguments, show menu
if [ $# -eq 0 ]; then
    main_menu
else
    # Handle command line arguments
    case $1 in
        setup)
            setup_env_file
            build_images
            ;;
        start)
            start_services ${2:-dev}
            ;;
        stop)
            stop_services
            ;;
        logs)
            show_logs $2
            ;;
        health)
            check_service_health
            ;;
        build)
            build_images ${2:-dev}
            ;;
        clean)
            clean_all
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Usage: $0 [setup|start|stop|logs|health|build|clean]"
            exit 1
            ;;
    esac
fi