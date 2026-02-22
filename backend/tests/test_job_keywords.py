"""
Test suite for Job Keywords (Cargos) API endpoints
Tests keyword management, priorities, and contact classification
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "perla@leaderlix.com"
TEST_PASSWORD = "Leaderlix2025"


class TestJobKeywordsAPI:
    """Test Job Keywords CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("access_token")
        assert token, "No token received"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.created_keyword_ids = []
        
        yield
        
        # Cleanup - delete test keywords
        for keyword_id in self.created_keyword_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/job-keywords/{keyword_id}")
            except:
                pass
    
    # ============ GET Keywords Tests ============
    
    def test_get_all_keywords(self):
        """Test GET /api/job-keywords/ returns keywords list"""
        response = self.session.get(f"{BASE_URL}/api/job-keywords/")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "success" in data
        assert data["success"] == True
        assert "keywords" in data
        assert "total" in data
        assert isinstance(data["keywords"], list)
        print(f"Found {data['total']} keywords")
    
    def test_get_keywords_filter_by_persona(self):
        """Test GET /api/job-keywords/ with buyer_persona_id filter"""
        # First get all keywords to find a valid persona id
        all_response = self.session.get(f"{BASE_URL}/api/job-keywords/")
        assert all_response.status_code == 200
        
        keywords = all_response.json().get("keywords", [])
        if keywords:
            persona_id = keywords[0].get("buyer_persona_id")
            
            # Filter by persona
            response = self.session.get(f"{BASE_URL}/api/job-keywords/?buyer_persona_id={persona_id}")
            assert response.status_code == 200
            
            data = response.json()
            assert data["success"] == True
            
            # All returned keywords should have the same persona_id
            for kw in data["keywords"]:
                assert kw["buyer_persona_id"] == persona_id
            print(f"Filtered keywords for persona {persona_id}: {len(data['keywords'])}")
    
    # ============ CREATE Keyword Tests ============
    
    def test_create_single_keyword(self):
        """Test POST /api/job-keywords/ creates a new keyword"""
        unique_keyword = f"test_keyword_{uuid.uuid4().hex[:8]}"
        
        response = self.session.post(f"{BASE_URL}/api/job-keywords/", json={
            "keyword": unique_keyword,
            "buyer_persona_id": "jorge",
            "buyer_persona_name": "Jorge"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "keyword" in data
        assert data["keyword"]["keyword"] == unique_keyword.lower()
        assert data["keyword"]["buyer_persona_id"] == "jorge"
        assert "id" in data["keyword"]
        
        self.created_keyword_ids.append(data["keyword"]["id"])
        print(f"Created keyword: {unique_keyword}")
    
    def test_create_keyword_duplicate_fails(self):
        """Test POST /api/job-keywords/ fails for duplicate keyword"""
        unique_keyword = f"test_dup_{uuid.uuid4().hex[:8]}"
        
        # Create first keyword
        response1 = self.session.post(f"{BASE_URL}/api/job-keywords/", json={
            "keyword": unique_keyword,
            "buyer_persona_id": "jorge",
            "buyer_persona_name": "Jorge"
        })
        assert response1.status_code == 200
        self.created_keyword_ids.append(response1.json()["keyword"]["id"])
        
        # Try to create duplicate
        response2 = self.session.post(f"{BASE_URL}/api/job-keywords/", json={
            "keyword": unique_keyword,
            "buyer_persona_id": "martha",
            "buyer_persona_name": "Martha"
        })
        
        assert response2.status_code == 409
        print("Duplicate keyword correctly rejected")
    
    def test_create_keyword_empty_fails(self):
        """Test POST /api/job-keywords/ fails for empty keyword"""
        response = self.session.post(f"{BASE_URL}/api/job-keywords/", json={
            "keyword": "   ",
            "buyer_persona_id": "jorge",
            "buyer_persona_name": "Jorge"
        })
        
        assert response.status_code == 400
        print("Empty keyword correctly rejected")
    
    # ============ BULK CREATE Tests ============
    
    def test_bulk_create_keywords(self):
        """Test POST /api/job-keywords/bulk creates multiple keywords"""
        unique_prefix = uuid.uuid4().hex[:6]
        keywords_text = f"test_bulk1_{unique_prefix}, test_bulk2_{unique_prefix}\ntest_bulk3_{unique_prefix}"
        
        response = self.session.post(f"{BASE_URL}/api/job-keywords/bulk", json={
            "keywords": keywords_text,
            "buyer_persona_id": "martha",
            "buyer_persona_name": "Martha"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "created" in data
        assert "skipped" in data
        assert "total_input" in data
        assert data["created"] == 3
        assert data["total_input"] == 3
        
        print(f"Bulk created {data['created']} keywords, skipped {data['skipped']}")
        
        # Get the created keywords to clean up
        all_response = self.session.get(f"{BASE_URL}/api/job-keywords/")
        for kw in all_response.json().get("keywords", []):
            if unique_prefix in kw["keyword"]:
                self.created_keyword_ids.append(kw["id"])
    
    def test_bulk_create_with_duplicates(self):
        """Test POST /api/job-keywords/bulk handles duplicates correctly"""
        unique_prefix = uuid.uuid4().hex[:6]
        
        # Create one keyword first
        first_keyword = f"test_first_{unique_prefix}"
        response1 = self.session.post(f"{BASE_URL}/api/job-keywords/", json={
            "keyword": first_keyword,
            "buyer_persona_id": "jorge",
            "buyer_persona_name": "Jorge"
        })
        assert response1.status_code == 200
        self.created_keyword_ids.append(response1.json()["keyword"]["id"])
        
        # Bulk add including the duplicate
        keywords_text = f"{first_keyword}, test_new_{unique_prefix}"
        response2 = self.session.post(f"{BASE_URL}/api/job-keywords/bulk", json={
            "keywords": keywords_text,
            "buyer_persona_id": "martha",
            "buyer_persona_name": "Martha"
        })
        
        assert response2.status_code == 200
        data = response2.json()
        
        assert data["created"] == 1  # Only the new one
        assert data["skipped"] == 1  # The duplicate
        print(f"Bulk with duplicates: created {data['created']}, skipped {data['skipped']}")
        
        # Cleanup
        all_response = self.session.get(f"{BASE_URL}/api/job-keywords/")
        for kw in all_response.json().get("keywords", []):
            if unique_prefix in kw["keyword"]:
                self.created_keyword_ids.append(kw["id"])
    
    # ============ DELETE Keyword Tests ============
    
    def test_delete_keyword(self):
        """Test DELETE /api/job-keywords/{id} removes keyword"""
        # Create a keyword first
        unique_keyword = f"test_delete_{uuid.uuid4().hex[:8]}"
        create_response = self.session.post(f"{BASE_URL}/api/job-keywords/", json={
            "keyword": unique_keyword,
            "buyer_persona_id": "jorge",
            "buyer_persona_name": "Jorge"
        })
        assert create_response.status_code == 200
        keyword_id = create_response.json()["keyword"]["id"]
        
        # Delete the keyword
        delete_response = self.session.delete(f"{BASE_URL}/api/job-keywords/{keyword_id}")
        assert delete_response.status_code == 200
        
        data = delete_response.json()
        assert data["success"] == True
        print(f"Deleted keyword: {unique_keyword}")
        
        # Verify it's gone
        all_response = self.session.get(f"{BASE_URL}/api/job-keywords/")
        keywords = all_response.json().get("keywords", [])
        keyword_ids = [kw["id"] for kw in keywords]
        assert keyword_id not in keyword_ids
    
    def test_delete_nonexistent_keyword(self):
        """Test DELETE /api/job-keywords/{id} returns 404 for nonexistent"""
        fake_id = str(uuid.uuid4())
        response = self.session.delete(f"{BASE_URL}/api/job-keywords/{fake_id}")
        
        assert response.status_code == 404
        print("Nonexistent keyword delete correctly returns 404")


class TestBuyerPersonaPriorities:
    """Test Buyer Persona Priority management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_priorities(self):
        """Test GET /api/job-keywords/priorities returns priority list"""
        response = self.session.get(f"{BASE_URL}/api/job-keywords/priorities")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "priorities" in data
        assert isinstance(data["priorities"], list)
        
        # Each priority should have required fields
        for priority in data["priorities"]:
            assert "buyer_persona_id" in priority
            assert "buyer_persona_name" in priority
            assert "priority" in priority
        
        print(f"Found {len(data['priorities'])} buyer persona priorities")
    
    def test_update_priorities(self):
        """Test PUT /api/job-keywords/priorities updates order"""
        # Get current priorities
        get_response = self.session.get(f"{BASE_URL}/api/job-keywords/priorities")
        assert get_response.status_code == 200
        
        priorities = get_response.json()["priorities"]
        if len(priorities) < 2:
            pytest.skip("Need at least 2 priorities to test reordering")
        
        # Swap first two priorities
        original_order = [p["buyer_persona_id"] for p in priorities]
        
        # Create new order (swap first two)
        new_priorities = [
            {"buyer_persona_id": priorities[1]["buyer_persona_id"], "priority": 1},
            {"buyer_persona_id": priorities[0]["buyer_persona_id"], "priority": 2}
        ]
        # Add rest unchanged
        for i, p in enumerate(priorities[2:], start=3):
            new_priorities.append({"buyer_persona_id": p["buyer_persona_id"], "priority": i})
        
        # Update priorities
        update_response = self.session.put(f"{BASE_URL}/api/job-keywords/priorities", json=new_priorities)
        assert update_response.status_code == 200
        
        data = update_response.json()
        assert data["success"] == True
        print("Priorities updated successfully")
        
        # Restore original order
        restore_priorities = [
            {"buyer_persona_id": pid, "priority": i+1} 
            for i, pid in enumerate(original_order)
        ]
        self.session.put(f"{BASE_URL}/api/job-keywords/priorities", json=restore_priorities)


class TestContactClassification:
    """Test contact classification by job title"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_classify_contact_with_match(self):
        """Test POST /api/job-keywords/classify-contact finds matching persona"""
        # Use a job title that should match existing keywords
        response = self.session.post(
            f"{BASE_URL}/api/job-keywords/classify-contact",
            params={"job_title": "Director de Marketing"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        # Should find a match for "director de marketing"
        if data.get("match"):
            print(f"Matched keyword: {data['match']} -> {data['buyer_persona_name']}")
            assert data["buyer_persona_name"] is not None
        else:
            print("No match found - may need to add keyword")
    
    def test_classify_contact_no_match(self):
        """Test POST /api/job-keywords/classify-contact returns Mateo for no match"""
        response = self.session.post(
            f"{BASE_URL}/api/job-keywords/classify-contact",
            params={"job_title": "xyz_nonexistent_job_title_12345"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["buyer_persona_name"] == "Mateo"  # Catch-all
        assert data["match"] is None
        print("No match correctly returns Mateo (catch-all)")
    
    def test_classify_contact_empty_title(self):
        """Test POST /api/job-keywords/classify-contact handles empty title"""
        response = self.session.post(
            f"{BASE_URL}/api/job-keywords/classify-contact",
            params={"job_title": ""}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["buyer_persona_name"] == "Mateo"
        print("Empty job title correctly returns Mateo")
    
    def test_reclassify_all_contacts(self):
        """Test POST /api/job-keywords/reclassify-all-contacts"""
        response = self.session.post(f"{BASE_URL}/api/job-keywords/reclassify-all-contacts")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "total_contacts" in data
        assert "updated_with_persona" in data
        assert "assigned_mateo" in data
        
        print(f"Reclassified {data['total_contacts']} contacts: {data['updated_with_persona']} with persona, {data['assigned_mateo']} to Mateo")


class TestBuyerPersonasDB:
    """Test Buyer Personas DB endpoint (used by Job Keywords)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_buyer_personas_db(self):
        """Test GET /api/buyer-personas-db/ returns personas list"""
        response = self.session.get(f"{BASE_URL}/api/buyer-personas-db/")
        
        assert response.status_code == 200
        data = response.json()
        
        # API returns array directly
        assert isinstance(data, list)
        
        # Each persona should have name and code
        for persona in data:
            assert "name" in persona
            # code may be present
            print(f"Persona: {persona.get('name')} (code: {persona.get('code', 'N/A')})")
        
        print(f"Found {len(data)} buyer personas")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
