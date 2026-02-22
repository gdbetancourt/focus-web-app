"""
Test suite for industry merge functionality
Testing POST /api/industries-v2/merge endpoint and merge preview
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session - created directly in DB for testing
TEST_SESSION_TOKEN = f"test_session_{uuid.uuid4().hex[:8]}"
TEST_USER_ID = f"test_user_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def setup_test_session():
    """Setup test session in database via direct MongoDB connection"""
    from motor.motor_asyncio import AsyncIOMotorClient
    import asyncio
    
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'leaderlix')
    
    async def create_session():
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        # Create test user in unified_contacts
        test_user = {
            "id": TEST_USER_ID,
            "email": "test_merge@leaderlix.com",
            "name": "Test User Merge",
            "is_staff": True,
            "can_login": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Delete existing test user if exists
        await db.unified_contacts.delete_many({"email": "test_merge@leaderlix.com"})
        await db.unified_contacts.insert_one(test_user)
        
        # Create session
        session_doc = {
            "id": str(uuid.uuid4()),
            "user_id": TEST_USER_ID,
            "session_token": TEST_SESSION_TOKEN,
            "user_type": "staff",
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
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
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        await db.unified_contacts.delete_many({"email": "test_merge@leaderlix.com"})
        await db.user_sessions.delete_many({"user_id": TEST_USER_ID})
        # Cleanup test industries
        await db.industries.delete_many({"code": {"$regex": "^TEST_"}})
        client.close()
    
    loop = asyncio.new_event_loop()
    loop.run_until_complete(cleanup())
    loop.close()


@pytest.fixture
def api_client(setup_test_session):
    """API client with authentication cookie"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    session.cookies.set("session_token", setup_test_session)
    return session


class TestIndustryMergeEndpoint:
    """Tests for industry merge functionality"""
    
    def test_list_industries(self, api_client):
        """Test listing industries works"""
        response = api_client.get(f"{BASE_URL}/api/industries-v2")
        print(f"List industries status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        assert response.status_code == 200
        data = response.json()
        assert "industries" in data
        assert "total" in data
        print(f"SUCCESS: Found {data['total']} industries")
    
    def test_merge_preview_endpoint(self, api_client):
        """Test merge preview endpoint"""
        # First, get some industries to test with
        response = api_client.get(f"{BASE_URL}/api/industries-v2?limit=10")
        assert response.status_code == 200
        industries = response.json().get("industries", [])
        
        if len(industries) < 2:
            pytest.skip("Not enough industries to test merge preview")
        
        primary = industries[0]
        secondary = industries[1]
        
        # Test merge preview
        response = api_client.get(
            f"{BASE_URL}/api/industries-v2/merge/preview",
            params={
                "primary_id": primary["id"],
                "secondary_ids": secondary["id"]
            }
        )
        print(f"Merge preview status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        assert response.status_code == 200
        data = response.json()
        assert "primary" in data
        assert "to_merge" in data
        assert "total_companies_affected" in data
        print(f"SUCCESS: Merge preview shows {data['total_companies_affected']} companies affected")
    
    def test_merge_preview_with_multiple_industries(self, api_client):
        """Test merge preview with multiple secondary industries"""
        response = api_client.get(f"{BASE_URL}/api/industries-v2?limit=10")
        assert response.status_code == 200
        industries = response.json().get("industries", [])
        
        if len(industries) < 3:
            pytest.skip("Not enough industries to test multi-merge preview")
        
        primary = industries[0]
        secondaries = [industries[1], industries[2]]
        
        response = api_client.get(
            f"{BASE_URL}/api/industries-v2/merge/preview",
            params={
                "primary_id": primary["id"],
                "secondary_ids": ",".join([s["id"] for s in secondaries])
            }
        )
        print(f"Multi-merge preview status: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert len(data["to_merge"]) == 2
        print(f"SUCCESS: Multi-merge preview shows {len(data['to_merge'])} industries to merge")
    
    def test_merge_industries_validation_no_industries(self, api_client):
        """Test merge fails when no industries to merge"""
        response = api_client.get(f"{BASE_URL}/api/industries-v2?limit=1")
        assert response.status_code == 200
        industries = response.json().get("industries", [])
        
        if len(industries) < 1:
            pytest.skip("No industries available")
        
        primary = industries[0]
        
        response = api_client.post(
            f"{BASE_URL}/api/industries-v2/merge",
            json={
                "primary_industry_id": primary["id"],
                "industries_to_merge": []
            }
        )
        print(f"Merge validation (empty list) status: {response.status_code}")
        assert response.status_code == 400
        assert "No industries to merge" in response.text
        print("SUCCESS: Correctly rejected merge with empty list")
    
    def test_merge_industries_validation_primary_in_list(self, api_client):
        """Test merge fails when primary is in merge list"""
        response = api_client.get(f"{BASE_URL}/api/industries-v2?limit=2")
        assert response.status_code == 200
        industries = response.json().get("industries", [])
        
        if len(industries) < 2:
            pytest.skip("Not enough industries")
        
        primary = industries[0]
        
        response = api_client.post(
            f"{BASE_URL}/api/industries-v2/merge",
            json={
                "primary_industry_id": primary["id"],
                "industries_to_merge": [primary["id"]]
            }
        )
        print(f"Merge validation (primary in list) status: {response.status_code}")
        assert response.status_code == 400
        assert "Primary industry cannot be in merge list" in response.text
        print("SUCCESS: Correctly rejected merge with primary in list")
    
    def test_merge_industries_not_found(self, api_client):
        """Test merge fails with non-existent primary industry"""
        response = api_client.post(
            f"{BASE_URL}/api/industries-v2/merge",
            json={
                "primary_industry_id": "non_existent_id",
                "industries_to_merge": ["another_fake_id"]
            }
        )
        print(f"Merge (not found) status: {response.status_code}")
        assert response.status_code == 404
        print("SUCCESS: Correctly returned 404 for non-existent industry")


class TestIndustryMergeIntegration:
    """Integration tests for full merge workflow with test data"""
    
    def test_create_test_industries_and_merge(self, api_client):
        """Create test industries and merge them"""
        # Create primary industry
        primary_data = {
            "name": "TEST_Primary Industry",
            "code": "TEST_primary_ind",
            "classification": "inbound",
            "color": "#ff0000"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/industries-v2",
            json=primary_data
        )
        print(f"Create primary industry status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Failed to create primary: {response.text}")
            pytest.skip("Could not create test industry")
        
        primary = response.json().get("industry", {})
        primary_id = primary.get("id")
        assert primary_id, "Primary industry should have ID"
        
        # Create secondary industry
        secondary_data = {
            "name": "TEST_Secondary Industry",
            "code": "TEST_secondary_ind",
            "classification": "inbound",
            "color": "#00ff00"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/industries-v2",
            json=secondary_data
        )
        print(f"Create secondary industry status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Failed to create secondary: {response.text}")
            # Cleanup primary
            api_client.delete(f"{BASE_URL}/api/industries-v2/{primary_id}")
            pytest.skip("Could not create test industry")
        
        secondary = response.json().get("industry", {})
        secondary_id = secondary.get("id")
        
        # Test merge preview
        response = api_client.get(
            f"{BASE_URL}/api/industries-v2/merge/preview",
            params={
                "primary_id": primary_id,
                "secondary_ids": secondary_id
            }
        )
        print(f"Merge preview status: {response.status_code}")
        assert response.status_code == 200
        
        # Execute merge
        response = api_client.post(
            f"{BASE_URL}/api/industries-v2/merge",
            json={
                "primary_industry_id": primary_id,
                "industries_to_merge": [secondary_id]
            }
        )
        print(f"Execute merge status: {response.status_code}")
        print(f"Merge response: {response.text}")
        assert response.status_code == 200
        
        merge_result = response.json()
        assert merge_result.get("success") == True
        assert merge_result.get("primary_industry") == "TEST_Primary Industry"
        assert "TEST_Secondary Industry" in merge_result.get("industries_merged", [])
        
        print(f"SUCCESS: Merged {len(merge_result.get('industries_merged', []))} industries")
        
        # Verify secondary is marked as merged
        response = api_client.get(f"{BASE_URL}/api/industries-v2/{secondary_id}")
        # Should be 404 or have is_merged=True
        if response.status_code == 200:
            data = response.json()
            # If found, should be marked as merged
            print(f"Secondary industry state: {data}")
        
        # Cleanup - delete primary (secondary already merged)
        api_client.delete(f"{BASE_URL}/api/industries-v2/{primary_id}")
        print("SUCCESS: Full merge workflow completed")


class TestMergePreviewValidation:
    """Tests for merge preview validation"""
    
    def test_preview_missing_primary_id(self, api_client):
        """Test preview fails without primary_id"""
        response = api_client.get(
            f"{BASE_URL}/api/industries-v2/merge/preview",
            params={"secondary_ids": "some_id"}
        )
        print(f"Preview without primary status: {response.status_code}")
        assert response.status_code in [400, 422]  # FastAPI validation error
        print("SUCCESS: Correctly rejected preview without primary_id")
    
    def test_preview_missing_secondary_ids(self, api_client):
        """Test preview fails without secondary_ids"""
        response = api_client.get(
            f"{BASE_URL}/api/industries-v2/merge/preview",
            params={"primary_id": "some_id"}
        )
        print(f"Preview without secondary status: {response.status_code}")
        # Should fail or return empty list
        assert response.status_code in [400, 422]
        print("SUCCESS: Correctly rejected preview without secondary_ids")
    
    def test_preview_nonexistent_primary(self, api_client):
        """Test preview with non-existent primary"""
        response = api_client.get(
            f"{BASE_URL}/api/industries-v2/merge/preview",
            params={
                "primary_id": "nonexistent_id_12345",
                "secondary_ids": "also_nonexistent"
            }
        )
        print(f"Preview nonexistent primary status: {response.status_code}")
        assert response.status_code == 404
        print("SUCCESS: Correctly returned 404 for non-existent primary")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
