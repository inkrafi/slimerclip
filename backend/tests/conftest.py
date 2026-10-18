"""
Tes backend dalam mode login (Supabase) tanpa jaringan: token JWT dibuat sendiri (HS256),
database akun diganti versi di memori, Gemini & render diganti tiruan.
"""
import os
import sys

# Harus diisi sebelum app/auth diimpor (keduanya membaca .env saat import)
os.environ.update({
    "SUPABASE_URL": "https://test-project.supabase.co",
    "SUPABASE_JWT_SECRET": "test-jwt-secret-yang-cukup-panjang-untuk-hs256",
    "SUPABASE_SECRET_KEY": "sb_secret_test",
    "APP_SECRET": "test-app-secret",
    "ADMIN_EMAILS": "admin@example.com",
    "CORS_ORIGINS": "http://localhost:3000",
})
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
