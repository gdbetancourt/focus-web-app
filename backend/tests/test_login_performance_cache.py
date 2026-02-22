"""
Test Login Performance Cache Fix

This test suite verifies the fix for the critical login performance bug where
the login process was unusable slow (30+ seconds or timing out) because 
find_similar_names was being called synchronously during login via 
/api/focus/traffic-light-status endpoint.

Tests:
1. /api/focus/traffic-light-status should respond within 3 seconds
2. merge-companies semaphore should show yellow (not gray) since cache exists
3. /api/companies/merge-candidates/cache-status should show cache_exists: true
4. /api/companies/merge-candidates/similar-names should return from_cache: true
"""

import pytest
import requests
import os
import time
from datetime import datetime, timezone
from pymongo import MongoClient
import uuid
from dotenv import load_dotenv

# Load environment from backend .env
load_dotenv('/app/backend/.env')

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://persona-assets.preview.emergentagent.com').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', '')
DB_NAME = os.environ.get('DB_NAME', 'leaderlix')


# Test session constants
TEST_SESSION_TOKEN = f"test_perf_{uuid.uuid4().hex[:8]}"
TEST_USER_ID = f"test_perf_user_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def setup_test_session():
    """Setup test session in database via direct MongoDB connection"""
    from motor.motor_asyncio import AsyncIOMotorClient
    import asyncio
    from datetime import timedelta
    
    async def create_session():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        
        now = datetime.now(timezone.utc)
        
        # Create test user in unified_contacts
        test_user = {
            "id": TEST_USER_ID,
            "email": "test_performance@leaderlix.com",
            "name": "Test User Performance",
            "is_staff": True,
            "can_login": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        # Delete existing test user if exists
        await db.unified_contacts.delete_many({"email": "test_performance@leaderlix.com"})
        await db.unified_contacts.insert_one(test_user)
        
        # Create session in user_sessions collection (required by auth router)
        session_doc = {
            "id": str(uuid.uuid4()),
            "user_id": TEST_USER_ID,
            "session_token": TEST_SESSION_TOKEN,
            "user_type": "staff",
            "expires_at": (now + timedelta(days=7)).isoformat(),
            "created_at": now.isoformat()
        }
        
        await db.user_sessions.delete_many({"user_id": TEST_USER_ID})
        await db.user_sessions.insert_one(session_doc)
        
        client.close()
        return TEST_SESSION_TOKEN
    
    loop = asyncio.new_event_loop()
    token = loop.run_until_complete(create_session())
    loop.close()
    
    yield token
    
    # Cleanup
    async def cleanup():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        await db.unified_contacts.delete_many({"email": "test_performance@leaderlix.com"})
        await db.user_sessions.delete_many({"user_id": TEST_USER_ID})
        client.close()
    
    loop = asyncio.new_event_loop()
    loop.run_until_complete(cleanup())
    loop.close()


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def authenticated_client(api_client, setup_test_session):
    """Session with auth cookie"""
    api_client.cookies.set("session_token", setup_test_session)
    return api_client


class TestTrafficLightPerformance:
    """Test traffic-light-status endpoint performance (the main bug fix)"""
    
    def test_traffic_light_status_responds_quickly(self, api_client):
        """
        CRITICAL: /api/focus/traffic-light-status must respond within 3 seconds
        This is the main bug fix - before it was timing out during login
        """
        start_time = time.time()
        response = api_client.get(f"{BASE_URL}/api/focus/traffic-light-status")
        elapsed_time = time.time() - start_time
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # CRITICAL: Performance assertion - must be under 3 seconds
        assert elapsed_time < 3.0, f"Response took {elapsed_time:.2f}s, expected < 3s (PERFORMANCE BUG NOT FIXED)"
        
        # Data assertions
        data = response.json()
        assert isinstance(data, dict), "Response should be a dictionary"
        assert "merge-companies" in data, "Response should include merge-companies status"
        
        print(f"✅ traffic-light-status responded in {elapsed_time:.2f}s (< 3s)")
        print(f"   merge-companies status: {data.get('merge-companies')}")
    
    def test_traffic_light_consistent_performance(self, api_client):
        """
        Test that traffic-light-status performs consistently across multiple calls
        """
        times = []
        for i in range(3):
            start_time = time.time()
            response = api_client.get(f"{BASE_URL}/api/focus/traffic-light-status")
            elapsed_time = time.time() - start_time
            times.append(elapsed_time)
            
            assert response.status_code == 200
            assert elapsed_time < 3.0, f"Call {i+1}: Response took {elapsed_time:.2f}s, expected < 3s"
        
        avg_time = sum(times) / len(times)
        print(f"✅ Average response time: {avg_time:.2f}s over {len(times)} calls")
        print(f"   Individual times: {[f'{t:.2f}s' for t in times]}")
    
    def test_merge_companies_semaphore_not_gray(self, api_client):
        """
        merge-companies semaphore should show yellow or green (not gray) when cache exists
        Gray indicates cache is not available
        """
        response = api_client.get(f"{BASE_URL}/api/focus/traffic-light-status")
        
        assert response.status_code == 200
        
        data = response.json()
        merge_companies_status = data.get("merge-companies")
        
        # Should NOT be gray since cache exists
        assert merge_companies_status != "gray", \
            f"merge-companies status is 'gray', expected 'yellow' or 'green' (cache should exist)"
        
        # Valid statuses are green, yellow, or red
        assert merge_companies_status in ["green", "yellow", "red"], \
            f"Unexpected status: {merge_companies_status}"
        
        print(f"✅ merge-companies status is '{merge_companies_status}' (not gray - cache is working)")


class TestCacheStatus:
    """Test cache status endpoints"""
    
    def test_cache_status_shows_cache_exists(self, authenticated_client):
        """
        /api/companies/merge-candidates/cache-status should show cache_exists: true
        """
        response = authenticated_client.get(f"{BASE_URL}/api/companies/merge-candidates/cache-status")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "cache_exists" in data, "Response should include cache_exists field"
        assert data["cache_exists"] == True, \
            f"cache_exists should be True, got {data.get('cache_exists')}"
        
        # Additional checks
        assert "total_count" in data, "Response should include total_count"
        assert "last_updated" in data, "Response should include last_updated"
        
        print(f"✅ Cache exists: {data['cache_exists']}")
        print(f"   Total candidates: {data.get('total_count', 'N/A')}")
        print(f"   Domain count: {data.get('domain_count', 'N/A')}")
        print(f"   Name count: {data.get('name_count', 'N/A')}")
        print(f"   Last updated: {data.get('last_updated', 'N/A')}")


class TestSimilarNamesFromCache:
    """Test similar-names endpoint returns cached results"""
    
    def test_similar_names_returns_from_cache(self, authenticated_client):
        """
        /api/companies/merge-candidates/similar-names should return from_cache: true
        """
        start_time = time.time()
        response = authenticated_client.get(f"{BASE_URL}/api/companies/merge-candidates/similar-names")
        elapsed_time = time.time() - start_time
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "from_cache" in data, "Response should include from_cache field"
        assert data["from_cache"] == True, \
            f"from_cache should be True (using cache), got {data.get('from_cache')}"
        
        # Performance check - cached results should be fast
        assert elapsed_time < 3.0, \
            f"Cached similar-names took {elapsed_time:.2f}s, expected < 3s"
        
        # Check response structure
        assert "groups" in data, "Response should include groups array"
        assert "total" in data, "Response should include total count"
        
        print(f"✅ similar-names from_cache: {data['from_cache']}")
        print(f"   Response time: {elapsed_time:.2f}s")
        print(f"   Total groups: {data.get('total', 'N/A')}")
        
        # Verify group structure if any exist
        if data.get("groups") and len(data["groups"]) > 0:
            first_group = data["groups"][0]
            assert "primary" in first_group, "Group should have primary company"
            assert "secondaries" in first_group, "Group should have secondaries list"
            print(f"   First group example: {first_group.get('normalized_name', 'N/A')}")


class TestMergeCandidatesSemaphore:
    """Test the semaphore endpoint directly"""
    
    def test_semaphore_endpoint(self, authenticated_client):
        """
        /api/companies/merge-candidates/semaphore should work with cache
        """
        response = authenticated_client.get(f"{BASE_URL}/api/companies/merge-candidates/semaphore")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
        
        data = response.json()
        
        # Status should not be gray (gray = no cache)
        status = data.get("status")
        assert status != "gray", f"Semaphore status is 'gray', cache should exist"
        assert status in ["green", "yellow", "red"], f"Unexpected status: {status}"
        
        # Check for cache_last_updated field
        assert "cache_last_updated" in data, "Response should include cache_last_updated"
        
        print(f"✅ Semaphore status: {status}")
        print(f"   Pending count: {data.get('pending_count', 'N/A')}")
        print(f"   Reviewed this week: {data.get('reviewed_this_week', 'N/A')}")
        print(f"   Cache last updated: {data.get('cache_last_updated', 'N/A')}")


class TestDomainDuplicatesCached:
    """Test domain duplicates endpoint uses cache"""
    
    def test_domain_duplicates_fast(self, authenticated_client):
        """
        /api/companies/merge-candidates/domain-duplicates should be fast (cached)
        """
        start_time = time.time()
        response = authenticated_client.get(f"{BASE_URL}/api/companies/merge-candidates/domain-duplicates")
        elapsed_time = time.time() - start_time
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
        
        # Should be fast since it's cached
        assert elapsed_time < 3.0, f"domain-duplicates took {elapsed_time:.2f}s, expected < 3s"
        
        data = response.json()
        assert "groups" in data, "Response should include groups array"
        
        print(f"✅ domain-duplicates response time: {elapsed_time:.2f}s")
        print(f"   Total groups: {data.get('total', len(data.get('groups', [])))}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
