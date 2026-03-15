#!/bin/bash

# Armenian OSINT Analytics - Quick Setup (No AI)
# This script sets up the platform WITHOUT AI dependencies

set -e

echo "🚀 Armenian OSINT Analytics - Quick Setup"
echo "=========================================="
echo ""
echo "ℹ️  Running in NO-AI mode (pattern matching)"
echo "   To enable AI later, see QUICK_START.md"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"

# Start services
echo ""
echo "📦 Starting services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 15

# Check PostgreSQL
if docker exec armenian-osint-db pg_isready -U postgres > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
else
    echo "⚠️  PostgreSQL might still be starting..."
fi

# Check Redis
if docker exec armenian-osint-redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is ready"
else
    echo "⚠️  Redis might still be starting..."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 Services running:"
echo "   • Main App:    http://localhost:3000"
echo "   • PostgreSQL:  localhost:5432"
echo "   • Redis:       localhost:6379"
echo ""
echo "🎉 You can now access the application at: http://localhost:3000"
echo ""
echo "💡 Pattern matching is active. Try these queries:"
echo "   • 'Show all companies'"
echo "   • 'Top 10 companies by revenue'"
echo "   • 'Latest news'"
echo ""
echo "🤖 To enable AI (OpenAI), see: QUICK_START.md"
echo ""
echo "📝 To add test data:"
echo "   docker exec -it armenian-osint-db psql -U postgres -d armenian_osint"
echo ""
echo "🛑 To stop all services:"
echo "   docker-compose down"
echo ""
