#!/bin/bash

# Snippet Vault Release Test Script
# This script helps test the release process locally before pushing tags

set -e

echo "🚀 Snippet Vault Release Test Script"
echo "===================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must be run from the project root directory"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo "❌ Error: Node.js 22 or later is required (found: $(node --version))"
    echo "   Please upgrade Node.js: https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js version: $(node --version)"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📋 Current version: $CURRENT_VERSION"

# Check git status
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Warning: You have uncommitted changes"
    echo "   It's recommended to commit all changes before testing release"
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "🔍 Running tests..."
npm test

echo ""
echo "📥 Downloading models..."
npm run download-models

echo ""
echo "🔨 Building application..."
npm run build

echo ""
echo "📦 Testing package creation..."

# Determine platform
PLATFORM=$(uname -s)
case $PLATFORM in
    Darwin)
        echo "🍎 Building for macOS (Universal)..."
        npm run package:mac
        echo "✅ macOS package created successfully"
        ;;
    Linux)
        echo "🐧 Building for Linux..."
        npm run package:linux
        echo "✅ Linux package created successfully"
        ;;
    MINGW*|CYGWIN*|MSYS*)
        echo "🪟 Building for Windows..."
        npm run package:win
        echo "✅ Windows package created successfully"
        ;;
    *)
        echo "❓ Unknown platform: $PLATFORM"
        echo "   Attempting generic package..."
        npm run package
        ;;
esac

echo ""
echo "🎯 Testing installer creation..."
case $PLATFORM in
    Darwin)
        npm run make:mac
        echo "✅ macOS installer (.zip) created"
        ;;
    Linux)
        npm run make:linux
        echo "✅ Linux installer (.deb) created"
        ;;
    MINGW*|CYGWIN*|MSYS*)
        npm run make:win
        echo "✅ Windows installer (.exe) created"
        ;;
    *)
        npm run make
        ;;
esac

echo ""
echo "📂 Build output:"
find out -name "*.app" -o -name "*.exe" -o -name "*.deb" -o -name "*.zip" | head -10

echo ""
echo "✅ Release test completed successfully!"
echo ""
echo "Next steps for actual release:"
echo "1. Commit any remaining changes"
echo "2. Run one of:"
echo "   npm run release:patch  (for bug fixes)"
echo "   npm run release:minor  (for new features)"  
echo "   npm run release:major  (for breaking changes)"
echo "3. Wait for GitHub Actions to complete the build"
echo "4. Verify release at: https://github.com/rolandnyamo/snippet-vault/releases"
echo ""
echo "Or create manual tag:"
echo "   git tag v$(node -p "require('./package.json').version")"
echo "   git push origin v$(node -p "require('./package.json').version")"
