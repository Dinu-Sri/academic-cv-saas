#!/bin/bash

# Academic CV SaaS - Quick Start Script
# This script helps you get started with development

set -e

echo "=========================================="
echo "Academic CV SaaS - Quick Start"
echo "=========================================="
echo ""

# Check if running in project directory
if [ ! -f "requirements.txt" ]; then
    echo "Error: Please run this script from the project root directory"
    exit 1
fi

# Check Python version
echo "Checking Python version..."
python_version=$(python3 --version | cut -d' ' -f2)
required_version="3.11"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "Error: Python 3.11 or higher is required"
    echo "Current version: $python_version"
    exit 1
fi
echo "✓ Python version OK: $python_version"
echo ""

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment already exists"
fi
echo ""

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate
echo "✓ Virtual environment activated"
echo ""

# Install dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt
echo "✓ Dependencies installed"
echo ""

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "✓ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file with your configuration!"
    echo ""
else
    echo "✓ .env file already exists"
    echo ""
fi

# Check if Docker is installed
if command -v docker &> /dev/null; then
    echo "✓ Docker is installed"
    
    # Ask if user wants to start services
    read -p "Start Docker services (PostgreSQL, Redis)? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Starting Docker services..."
        docker-compose up -d postgres redis
        echo "✓ Docker services started"
        
        # Wait for services to be ready
        echo "Waiting for services to be ready..."
        sleep 5
    fi
else
    echo "⚠️  Docker not found. Please install Docker to use containerized services."
fi
echo ""

# Initialize Reflex
echo "Initializing Reflex..."
reflex init
echo "✓ Reflex initialized"
echo ""

# Run database migrations
echo "Running database migrations..."
alembic upgrade head
echo "✓ Database migrations complete"
echo ""

# Create admin user
read -p "Create admin user? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    python scripts/create_admin.py
fi
echo ""

# Load templates
read -p "Load default CV templates? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    python scripts/load_templates.py
fi
echo ""

echo "=========================================="
echo "Setup Complete! 🎉"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Edit .env file with your configuration"
echo "2. Start development server:"
echo "   $ reflex run"
echo ""
echo "3. Start Celery worker (in another terminal):"
echo "   $ celery -A app.tasks.celery_app worker --loglevel=info"
echo ""
echo "4. Access the application:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:8000"
echo "   - Flower (Celery monitoring): http://localhost:5555"
echo ""
echo "For deployment instructions, see DEPLOYMENT.md"
echo "For development guide, see DEVELOPMENT_GUIDE.md"
echo ""
echo "=========================================="
