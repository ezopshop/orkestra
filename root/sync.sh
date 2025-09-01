#!/bin/bash
# Orkestra ROOT senkronizasyon scripti

echo "Apps Script'ten son değişiklikler çekiliyor..."
clasp pull

echo "Git'e ekleniyor..."
git add .
git commit -m "Sync from Apps Script"
git push origin main
