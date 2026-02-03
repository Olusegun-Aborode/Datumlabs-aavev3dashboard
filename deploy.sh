#!/bin/bash

# Aave Dashboard Deployment Script
# This script helps you deploy the dashboard to production

echo "🚀 Aave V3 Dashboard Deployment Helper"
echo "======================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the aave-dashboard directory"
    exit 1
fi

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Vercel CLI not found. Installing..."
    npm i -g vercel
fi

echo "✅ Vercel CLI is installed"
echo ""

# Menu
echo "Choose deployment option:"
echo "1) Deploy to Vercel (Production)"
echo "2) Deploy to Vercel (Preview)"
echo "3) Build locally (test before deploy)"
echo "4) Exit"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Deploying to production..."
        echo "This will deploy to Vercel with a production URL"
        echo ""
        vercel --prod
        ;;
    2)
        echo ""
        echo "🔍 Deploying preview..."
        echo "This will create a preview deployment for testing"
        echo ""
        vercel
        ;;
    3)
        echo ""
        echo "🔨 Building locally..."
        npm run build
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ Build successful!"
            echo ""
            read -p "Start production server locally? (y/n): " start_local
            
            if [ "$start_local" = "y" ]; then
                echo "Starting production server on http://localhost:3000"
                npm run start
            fi
        else
            echo "❌ Build failed. Please fix errors before deploying."
            exit 1
        fi
        ;;
    4)
        echo "👋 Exiting..."
        exit 0
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✨ Done!"
