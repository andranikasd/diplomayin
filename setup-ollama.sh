#!/bin/bash

# Armenian OSINT Analytics - Ollama Setup Script
# This script sets up the complete environment with Ollama for local LLM

set -e

echo "🚀 Armenian OSINT Analytics - Ollama Setup"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"

# Start services
echo ""
echo "📦 Starting services with Docker Compose..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Wait for Ollama to be ready
echo ""
echo "🤖 Checking Ollama service..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama is ready"
        break
    fi
    attempt=$((attempt + 1))
    echo "   Waiting for Ollama... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Ollama failed to start"
    exit 1
fi

# Pull the Llama2 model (or another model)
echo ""
echo "📥 Pulling Llama2 model (this may take a few minutes)..."
docker exec armenian-osint-ollama ollama pull llama2

echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 Services running:"
echo "   • Main App:    http://localhost:3000"
echo "   • PostgreSQL:  localhost:5432"
echo "   • Redis:       localhost:6379"
echo "   • Ollama:      http://localhost:11434"
echo ""
echo "🎉 You can now access the application at: http://localhost:3000"
echo ""
echo "💡 To view logs:"
echo "   docker-compose logs -f app"
echo ""
echo "🛑 To stop all services:"
echo "   docker-compose down"
echo ""
