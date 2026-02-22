"""
Configuration module for Leaderlix Backend
Centralizes all environment variables and settings
"""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

# JWT
SECRET_KEY = os.environ.get('SECRET_KEY', 'leaderlix-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Emergent LLM
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# HubSpot
HUBSPOT_TOKEN = os.environ.get('HUBSPOT_TOKEN', '')
HUBSPOT_LIST_ID = os.environ.get('HUBSPOT_LIST_ID', '13417')
HUBSPOT_ACCOUNT_ID = os.environ.get('HUBSPOT_ACCOUNT_ID', '20165345')

# Pipeline IDs
PIPELINE_COHORTES_ID = "860644905"
PIPELINE_PROYECTOS_ID = "654720623"

# Stage IDs
STAGE_DM_IDENTIFICADO_ID = "1069593191"
STAGE_INTERES_CASO_ID = "1263891294"

# Google OAuth
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GOOGLE_SCOPES = [
    'openid',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
]

# Google Docs Template for Cotizaciones
GOOGLE_DOCS_COTIZACION_TEMPLATE_ID = os.environ.get('GOOGLE_DOCS_COTIZACION_TEMPLATE_ID', '1ZMBgsk3N6ay5zSuNR0QJzAKML4JqDBfIwZB0RXgq7lQ')

# CORS - Production domains
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')

# Environment
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'development')  # 'development' or 'production'
IS_PRODUCTION = ENVIRONMENT == 'production'

# Rate Limiting
RATE_LIMIT_AUTH = os.environ.get('RATE_LIMIT_AUTH', '5/minute')  # 5 requests per minute for auth endpoints

# Frontend URL (for email links)
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://go.leaderlix.com')
