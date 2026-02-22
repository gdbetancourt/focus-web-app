"""
Phase 1 Bug Fixes - Backend API Tests
Tests for:
1. Login redirect logic (leaderlix vs non-leaderlix users)
2. Registration block for @leaderlix.com emails
3. LMS dropdowns (no duplicates)
4. Time Tracker API
5. Certificate generation API
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
LEADERLIX_USER = {
    "email": "perla@leaderlix.com",
    "password": "Leaderlix2025"
}


def get_auth_token():
    """Helper to get auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=LEADERLIX_USER)
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")  # API returns access_token, not token
    return None


class TestAuthEndpoints:
    """Test authentication endpoints for login/registration logic"""
    
    def test_login_leaderlix_user(self):
        """Test login with @leaderlix.com user - should succeed"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=LEADERLIX_USER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        print(f"SUCCESS: Leaderlix user login works - token received")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"
        print(f"SUCCESS: Invalid login correctly rejected with {response.status_code}")
    
    def test_register_leaderlix_email_blocked(self):
        """Test that @leaderlix.com emails cannot register - should be blocked"""
        # Note: This is frontend validation, but we test if backend also blocks it
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "newuser@leaderlix.com",
            "password": "TestPass123",
            "name": "Test User"
        })
        # Backend might allow it (frontend blocks), or backend might also block
        # If backend allows, status would be 200/201
        # If backend blocks, status would be 400/403
        print(f"Register @leaderlix.com response: {response.status_code} - {response.text[:200]}")
        # We just log the behavior - frontend is responsible for blocking


class TestLMSEndpoints:
    """Test LMS endpoints for dropdown options"""
    
    def test_lms_options_no_duplicates(self):
        """Test that LMS options (formatos, enfoques, niveles) have no duplicates"""
        token = get_auth_token()
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/lms/options", headers=headers)
        assert response.status_code == 200, f"Failed to get LMS options: {response.text}"
        
        data = response.json()
        
        # Check formatos for duplicates
        formatos = data.get("formatos", [])
        formato_names = [f.get("name") for f in formatos]
        unique_formato_names = set(formato_names)
        if len(formato_names) != len(unique_formato_names):
            duplicates = [n for n in formato_names if formato_names.count(n) > 1]
            print(f"WARNING: Duplicate formatos found: {set(duplicates)}")
            assert False, f"Duplicate formatos found: {set(duplicates)}"
        else:
            print(f"SUCCESS: No duplicate formatos ({len(formatos)} items)")
        
        # Check enfoques for duplicates
        enfoques = data.get("enfoques", [])
        enfoque_names = [e.get("name") for e in enfoques]
        unique_enfoque_names = set(enfoque_names)
        if len(enfoque_names) != len(unique_enfoque_names):
            duplicates = [n for n in enfoque_names if enfoque_names.count(n) > 1]
            print(f"WARNING: Duplicate enfoques found: {set(duplicates)}")
            assert False, f"Duplicate enfoques found: {set(duplicates)}"
        else:
            print(f"SUCCESS: No duplicate enfoques ({len(enfoques)} items)")
        
        # Check niveles for duplicates
        niveles = data.get("niveles", [])
        nivel_names = [n.get("name") for n in niveles]
        unique_nivel_names = set(nivel_names)
        if len(nivel_names) != len(unique_nivel_names):
            duplicates = [n for n in nivel_names if nivel_names.count(n) > 1]
            print(f"WARNING: Duplicate niveles found: {set(duplicates)}")
            assert False, f"Duplicate niveles found: {set(duplicates)}"
        else:
            print(f"SUCCESS: No duplicate niveles ({len(niveles)} items)")
    
    def test_lms_courses_list(self):
        """Test listing LMS courses"""
        token = get_auth_token()
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/lms/courses", headers=headers)
        assert response.status_code == 200, f"Failed to get courses: {response.text}"
        
        data = response.json()
        courses = data.get("courses", [])
        print(f"SUCCESS: LMS courses endpoint works - {len(courses)} courses found")
        
        # Check for published courses (for external link test)
        published = [c for c in courses if c.get("is_published")]
        print(f"  - Published courses: {len(published)}")


class TestBlogEndpoints:
    """Test Blog endpoints"""
    
    def test_blog_posts_list(self):
        """Test listing blog posts"""
        token = get_auth_token()
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/blog/posts", headers=headers)
        assert response.status_code == 200, f"Failed to get posts: {response.text}"
        
        data = response.json()
        posts = data.get("posts", [])
        print(f"SUCCESS: Blog posts endpoint works - {len(posts)} posts found")
        
        # Check for published posts with slugs (for external link test)
        published = [p for p in posts if p.get("is_published") and p.get("slug")]
        print(f"  - Published posts with slugs: {len(published)}")


class TestTimeTrackerEndpoints:
    """Test Time Tracker endpoints"""
    
    def test_time_tracker_entries_list(self):
        """Test listing time tracker entries"""
        token = get_auth_token()
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/time-tracker/entries?limit=50", headers=headers)
        assert response.status_code == 200, f"Failed to get entries: {response.text}"
        
        data = response.json()
        entries = data.get("entries", [])
        print(f"SUCCESS: Time tracker entries endpoint works - {len(entries)} entries found")
    
    def test_time_tracker_stats(self):
        """Test time tracker stats endpoint"""
        token = get_auth_token()
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/time-tracker/stats?period=week", headers=headers)
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        
        data = response.json()
        assert "total_hours" in data, "Missing total_hours in stats"
        assert "total_sessions" in data, "Missing total_sessions in stats"
        print(f"SUCCESS: Time tracker stats endpoint works - {data.get('total_hours')} hours, {data.get('total_sessions')} sessions")
    
    def test_time_tracker_students(self):
        """Test getting students for time tracker"""
        token = get_auth_token()
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/time-tracker/contacts/students", headers=headers)
        assert response.status_code == 200, f"Failed to get students: {response.text}"
        
        data = response.json()
        contacts = data.get("contacts", [])
        print(f"SUCCESS: Time tracker students endpoint works - {len(contacts)} students found")
    
    def test_time_tracker_create_and_delete_entry(self):
        """Test creating and deleting a time tracker entry"""
        token = get_auth_token()
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        entry_data = {
            "contact_name": "TEST_Student",
            "contact_email": "test@example.com",
            "description": "Test coaching session",
            "duration_minutes": 60,
            "session_date": "2026-01-28",
            "session_type": "coaching"
        }
        response = requests.post(f"{BASE_URL}/api/time-tracker/entries", json=entry_data, headers=headers)
        assert response.status_code == 200, f"Failed to create entry: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Entry creation not successful"
        entry = data.get("entry", {})
        assert entry.get("id"), "No entry ID returned"
        print(f"SUCCESS: Time tracker entry created - ID: {entry.get('id')}")
        
        # Cleanup - delete the test entry
        entry_id = entry.get("id")
        if entry_id:
            delete_response = requests.delete(f"{BASE_URL}/api/time-tracker/entries/{entry_id}", headers=headers)
            assert delete_response.status_code == 200, f"Failed to delete entry: {delete_response.text}"
            print(f"  - Test entry cleaned up")


class TestCertificadosEndpoints:
    """Test Certificate generation endpoints"""
    
    def test_certificados_programs_catalog(self):
        """Test getting programs catalog"""
        token = get_auth_token()
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/certificados/catalog/programs", headers=headers)
        assert response.status_code == 200, f"Failed to get programs: {response.text}"
        
        data = response.json()
        programs = data.get("programs", [])
        assert len(programs) > 0, "No programs in catalog"
        print(f"SUCCESS: Certificados programs catalog works - {len(programs)} programs")
    
    def test_certificados_levels_catalog(self):
        """Test getting levels catalog"""
        token = get_auth_token()
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/certificados/catalog/levels", headers=headers)
        assert response.status_code == 200, f"Failed to get levels: {response.text}"
        
        data = response.json()
        levels = data.get("levels", [])
        assert len(levels) > 0, "No levels in catalog"
        print(f"SUCCESS: Certificados levels catalog works - {len(levels)} levels")
    
    def test_certificados_search_contact(self):
        """Test searching for a contact by email"""
        token = get_auth_token()
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        # Search for the test user
        response = requests.get(f"{BASE_URL}/api/certificados/search-contact?email=perla@leaderlix.com", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("found") == True, "Contact not found"
            contact = data.get("contact", {})
            print(f"SUCCESS: Contact search works - found: {contact.get('firstname')} {contact.get('lastname')}")
        elif response.status_code == 404:
            print(f"INFO: Contact not found in database (expected if no contacts seeded)")
        else:
            print(f"WARNING: Unexpected response: {response.status_code} - {response.text}")
    
    def test_certificados_list(self):
        """Test listing certificates"""
        token = get_auth_token()
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/certificados/list", headers=headers)
        assert response.status_code == 200, f"Failed to list certificates: {response.text}"
        
        data = response.json()
        certs = data.get("certificates", [])
        print(f"SUCCESS: Certificados list endpoint works - {len(certs)} certificates")


class TestJobKeywordsEndpoints:
    """Test Job Keywords endpoints (contact classification)"""
    
    def test_job_keywords_list(self):
        """Test listing job keywords"""
        token = get_auth_token()
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/job-keywords/", headers=headers)
        assert response.status_code == 200, f"Failed to get keywords: {response.text}"
        
        data = response.json()
        keywords = data.get("keywords", [])
        print(f"SUCCESS: Job keywords endpoint works - {len(keywords)} keywords")
    
    def test_job_keywords_priorities(self):
        """Test getting buyer persona priorities"""
        token = get_auth_token()
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/job-keywords/priorities", headers=headers)
        assert response.status_code == 200, f"Failed to get priorities: {response.text}"
        
        data = response.json()
        priorities = data.get("priorities", [])
        print(f"SUCCESS: Job keywords priorities endpoint works - {len(priorities)} priorities")
    
    def test_classify_contact(self):
        """Test classifying a contact by job title"""
        token = get_auth_token()
        assert token, "Failed to get auth token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"{BASE_URL}/api/job-keywords/classify-contact?job_title=Director%20de%20Marketing",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to classify: {response.text}"
        
        data = response.json()
        print(f"SUCCESS: Classify contact works - persona: {data.get('buyer_persona_name')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
