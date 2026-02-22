"""
Test Unified Authentication System for Leaderlix
Tests:
1. POST /api/auth/register - External user registration (blocks @leaderlix.com)
2. POST /api/auth/login - External user login (blocks @leaderlix.com)
3. GET /api/auth/verify-email/{token} - Email verification
4. GET /api/auth/check - Session verification
5. GET /api/auth/google/init - Google OAuth initialization
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from E1 agent
TEST_EXTERNAL_EMAIL = f"testuser_{uuid.uuid4().hex[:8]}@testdomain.com"
TEST_PASSWORD = "TestPassword123!"
TEST_TURNSTILE_TOKEN = "test_token"


class TestAuthEndpointsBasic:
    """Basic endpoint availability tests"""
    
    def test_api_root_accessible(self):
        """Test API root is accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"API root accessible: {data}")
    
    def test_google_init_endpoint_exists(self):
        """Test Google OAuth init endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/auth/google/init")
        # Should return 200 with auth_url or 500 if Google not configured
        assert response.status_code in [200, 500]
        print(f"Google init response: {response.status_code} - {response.json()}")
    
    def test_auth_check_without_session(self):
        """Test auth check without any session"""
        response = requests.get(f"{BASE_URL}/api/auth/check")
        assert response.status_code == 200
        data = response.json()
        assert "authenticated" in data
        assert data["authenticated"] == False
        print(f"Auth check (no session): {data}")


class TestExternalUserRegistration:
    """Tests for external user registration via email/password"""
    
    def test_register_external_user_success(self):
        """Test successful registration of external user"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@external.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Test User External",
            "phone": "+1234567890",
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "user_id" in data
        assert "verification_token" in data  # Returned for testing (mocked email)
        print(f"Registration success: user_id={data.get('user_id')}, token={data.get('verification_token')[:20]}...")
        
        # Store for verification test
        return data
    
    def test_register_blocks_leaderlix_domain(self):
        """Test that @leaderlix.com emails are blocked from registration"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "testuser@leaderlix.com",
            "password": TEST_PASSWORD,
            "name": "Leaderlix User",
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "leaderlix.com" in data["detail"].lower() or "google" in data["detail"].lower()
        print(f"Correctly blocked @leaderlix.com: {data['detail']}")
    
    def test_register_missing_fields(self):
        """Test registration fails with missing required fields"""
        # Missing email
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "password": TEST_PASSWORD,
            "name": "Test",
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        assert response.status_code == 422  # Validation error
        
        # Missing password
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "test@external.com",
            "name": "Test",
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        assert response.status_code == 422
        
        # Missing turnstile token
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "test@external.com",
            "password": TEST_PASSWORD,
            "name": "Test"
        })
        assert response.status_code == 422
        
        print("Missing fields validation working correctly")
    
    def test_register_duplicate_email(self):
        """Test registration fails for existing email"""
        unique_email = f"dup_{uuid.uuid4().hex[:8]}@external.com"
        
        # First registration
        response1 = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Test User 1",
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        assert response1.status_code == 200
        
        # Second registration with same email
        response2 = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Test User 2",
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        assert response2.status_code == 400
        assert "registrado" in response2.json().get("detail", "").lower() or "registered" in response2.json().get("detail", "").lower()
        print(f"Duplicate email correctly blocked: {response2.json()}")


class TestEmailVerification:
    """Tests for email verification flow"""
    
    def test_verify_email_with_valid_token(self):
        """Test email verification with valid token"""
        # First register to get a token
        unique_email = f"verify_{uuid.uuid4().hex[:8]}@external.com"
        
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Verify Test User",
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        assert register_response.status_code == 200
        verification_token = register_response.json().get("verification_token")
        
        # Verify the email
        verify_response = requests.get(
            f"{BASE_URL}/api/auth/verify-email/{verification_token}",
            allow_redirects=False
        )
        # Should redirect to frontend with success
        assert verify_response.status_code in [200, 302, 307]
        print(f"Email verification redirect status: {verify_response.status_code}")
    
    def test_verify_email_with_invalid_token(self):
        """Test email verification with invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/verify-email/invalid_token_12345",
            allow_redirects=False
        )
        # Should return error
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"Invalid token handled: {data}")


class TestExternalUserLogin:
    """Tests for external user login via email/password"""
    
    def test_login_external_user_success(self):
        """Test successful login of verified external user"""
        # First register and verify a user
        unique_email = f"login_{uuid.uuid4().hex[:8]}@external.com"
        
        # Register
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Login Test User",
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        assert register_response.status_code == 200
        verification_token = register_response.json().get("verification_token")
        
        # Verify email
        requests.get(f"{BASE_URL}/api/auth/verify-email/{verification_token}", allow_redirects=False)
        
        # Now login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        
        assert login_response.status_code == 200
        data = login_response.json()
        assert data.get("success") == True
        assert data.get("user_type") == "external"
        assert data.get("redirect_url") == "/nurture/lms"
        assert "user" in data
        assert data["user"]["email"] == unique_email
        
        # Check session cookie is set
        assert "session_token" in login_response.cookies
        print(f"Login success: {data}")
        
        return login_response.cookies.get("session_token")
    
    def test_login_blocks_leaderlix_domain(self):
        """Test that @leaderlix.com emails are blocked from email login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "anyuser@leaderlix.com",
            "password": TEST_PASSWORD,
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "google" in data["detail"].lower() or "leaderlix.com" in data["detail"].lower()
        print(f"Correctly blocked @leaderlix.com login: {data['detail']}")
    
    def test_login_invalid_credentials(self):
        """Test login fails with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@external.com",
            "password": "wrongpassword",
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"Invalid credentials handled: {data}")
    
    def test_login_unverified_user(self):
        """Test login fails for unverified user"""
        unique_email = f"unverified_{uuid.uuid4().hex[:8]}@external.com"
        
        # Register but don't verify
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Unverified User",
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        assert register_response.status_code == 200
        
        # Try to login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        
        assert login_response.status_code == 403
        data = login_response.json()
        assert "verifica" in data.get("detail", "").lower() or "verify" in data.get("detail", "").lower()
        print(f"Unverified user correctly blocked: {data}")


class TestSessionCheck:
    """Tests for session verification endpoint"""
    
    def test_session_check_with_valid_session(self):
        """Test session check returns user info with valid session"""
        # Create a verified user and login
        unique_email = f"session_{uuid.uuid4().hex[:8]}@external.com"
        
        # Register
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Session Test User",
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        verification_token = register_response.json().get("verification_token")
        
        # Verify
        requests.get(f"{BASE_URL}/api/auth/verify-email/{verification_token}", allow_redirects=False)
        
        # Login
        session = requests.Session()
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        assert login_response.status_code == 200
        
        # Check session using the same session (with cookies)
        check_response = session.get(f"{BASE_URL}/api/auth/check")
        assert check_response.status_code == 200
        data = check_response.json()
        
        assert data.get("authenticated") == True
        assert data.get("user_type") == "external"
        assert data.get("redirect_url") == "/nurture/lms"
        assert data["user"]["email"] == unique_email
        print(f"Session check success: {data}")
    
    def test_session_check_without_session(self):
        """Test session check returns unauthenticated without session"""
        response = requests.get(f"{BASE_URL}/api/auth/check")
        assert response.status_code == 200
        data = response.json()
        assert data.get("authenticated") == False
        assert "reason" in data
        print(f"No session correctly handled: {data}")


class TestGoogleOAuthInit:
    """Tests for Google OAuth initialization"""
    
    def test_google_init_returns_auth_url(self):
        """Test Google OAuth init returns auth URL when configured"""
        response = requests.get(f"{BASE_URL}/api/auth/google/init")
        
        if response.status_code == 200:
            data = response.json()
            assert "auth_url" in data
            assert "accounts.google.com" in data["auth_url"]
            print(f"Google OAuth configured: {data['auth_url'][:80]}...")
        elif response.status_code == 500:
            # Google OAuth not configured
            data = response.json()
            assert "detail" in data
            print(f"Google OAuth not configured: {data}")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")


class TestLogout:
    """Tests for logout functionality"""
    
    def test_logout_clears_session(self):
        """Test logout clears session"""
        # Create session first
        unique_email = f"logout_{uuid.uuid4().hex[:8]}@external.com"
        
        # Register and verify
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Logout Test User",
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        verification_token = register_response.json().get("verification_token")
        requests.get(f"{BASE_URL}/api/auth/verify-email/{verification_token}", allow_redirects=False)
        
        # Login
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        
        # Verify session works
        check_before = session.get(f"{BASE_URL}/api/auth/check")
        assert check_before.json().get("authenticated") == True
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_response.status_code == 200
        data = logout_response.json()
        assert data.get("success") == True
        
        # Session should no longer be valid
        check_after = session.get(f"{BASE_URL}/api/auth/check")
        assert check_after.json().get("authenticated") == False
        print("Logout successfully cleared session")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
