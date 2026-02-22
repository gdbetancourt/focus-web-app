"""
Rate Limiter module for Leaderlix Backend
Shared rate limiter instance for all routers
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from config import RATE_LIMIT_AUTH

# Create shared limiter instance
limiter = Limiter(key_func=get_remote_address)

# Default rate limit for auth endpoints
AUTH_RATE_LIMIT = RATE_LIMIT_AUTH
