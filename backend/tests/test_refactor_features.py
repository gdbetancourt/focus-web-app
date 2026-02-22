"""
Test suite for Focus/Leaderlix Refactor Features
Tests: Business Search Config, Mensajes Hoy unified endpoint, LinkedIn Events
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "perla@leaderlix.com"
TEST_PASSWORD = "Leaderlix2025"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestBusinessSearchConfig:
    """Tests for Business Search Configuration module (1.1.2)"""
    
    def test_list_business_types(self, auth_headers):
        """GET /api/business-search/business-types - List all business types"""
        response = requests.get(
            f"{BASE_URL}/api/business-search/business-types",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "business_types" in data
        assert "count" in data
        assert isinstance(data["business_types"], list)
        print(f"Business types count: {data['count']}")
    
    def test_create_business_type(self, auth_headers):
        """POST /api/business-search/business-types - Create business type"""
        test_id = str(uuid.uuid4())[:8]
        payload = {
            "category_name": f"TEST_farmacia_{test_id}",
            "search_keyword": f"farmacias_{test_id}"
        }
        response = requests.post(
            f"{BASE_URL}/api/business-search/business-types",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "business_type" in data
        assert data["business_type"]["category_name"] == payload["category_name"]
        assert data["business_type"]["search_keyword"] == payload["search_keyword"]
        assert "id" in data["business_type"]
        
        # Store for cleanup
        self.__class__.created_business_type_id = data["business_type"]["id"]
        print(f"Created business type: {data['business_type']['id']}")
    
    def test_list_cities(self, auth_headers):
        """GET /api/business-search/cities - List all cities"""
        response = requests.get(
            f"{BASE_URL}/api/business-search/cities",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "cities" in data
        assert "count" in data
        assert isinstance(data["cities"], list)
        print(f"Cities count: {data['count']}")
    
    def test_create_city(self, auth_headers):
        """POST /api/business-search/cities - Create city"""
        test_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_Ciudad_{test_id}",
            "state": "TEST_State"
        }
        response = requests.post(
            f"{BASE_URL}/api/business-search/cities",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "city" in data
        assert data["city"]["name"] == payload["name"]
        assert "id" in data["city"]
        assert "queue_items_created" in data
        
        # Store for cleanup
        self.__class__.created_city_id = data["city"]["id"]
        print(f"Created city: {data['city']['id']}, queue items: {data['queue_items_created']}")
    
    def test_get_search_queue(self, auth_headers):
        """GET /api/business-search/queue - Get search queue"""
        response = requests.get(
            f"{BASE_URL}/api/business-search/queue",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "queue_items" in data
        assert "counts" in data
        assert "pending" in data["counts"]
        assert "completed" in data["counts"]
        assert "failed" in data["counts"]
        print(f"Queue counts: {data['counts']}")
    
    def test_get_stats(self, auth_headers):
        """GET /api/business-search/stats - Get statistics"""
        response = requests.get(
            f"{BASE_URL}/api/business-search/stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "business_types" in data
        assert "cities" in data
        assert "total_combinations" in data
        assert "queue" in data
        print(f"Stats: {data}")
    
    def test_cleanup_business_type(self, auth_headers):
        """DELETE /api/business-search/business-types/{id} - Cleanup test data"""
        if hasattr(self.__class__, 'created_business_type_id'):
            response = requests.delete(
                f"{BASE_URL}/api/business-search/business-types/{self.__class__.created_business_type_id}",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            print(f"Deleted business type: {self.__class__.created_business_type_id}")
    
    def test_cleanup_city(self, auth_headers):
        """DELETE /api/business-search/cities/{id} - Cleanup test data"""
        if hasattr(self.__class__, 'created_city_id'):
            response = requests.delete(
                f"{BASE_URL}/api/business-search/cities/{self.__class__.created_city_id}",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            print(f"Deleted city: {self.__class__.created_city_id}")


class TestMensajesHoyUnified:
    """Tests for Mensajes Hoy unified WhatsApp endpoint"""
    
    def test_get_all_whatsapp_contacts(self, auth_headers):
        """GET /api/mensajes-hoy/whatsapp/all-contacts - Unified endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/mensajes-hoy/whatsapp/all-contacts",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "contacts" in data
        assert "count" in data
        assert "rules_summary" in data
        
        # Verify rules_summary has expected categories
        rules = data["rules_summary"]
        assert "meeting_today" in rules
        assert "student_coaching" in rules
        assert "quote_followup" in rules
        assert "new_business_first" in rules
        assert "new_business_followup" in rules
        
        print(f"Total contacts: {data['count']}")
        print(f"Rules summary: {rules}")
        
        # Verify contact structure if any contacts exist
        if data["contacts"]:
            contact = data["contacts"][0]
            assert "contact_id" in contact
            assert "name" in contact
            assert "message" in contact
            assert "rule_matched" in contact
            assert "contact_type" in contact
            print(f"First contact rule: {contact['rule_matched']}")
    
    def test_dismiss_contact(self, auth_headers):
        """POST /api/mensajes-hoy/whatsapp/dismiss-contact - Dismiss contact for today"""
        payload = {
            "contact_id": f"test-dismiss-{uuid.uuid4()}",
            "contact_type": "contact"
        }
        response = requests.post(
            f"{BASE_URL}/api/mensajes-hoy/whatsapp/dismiss-contact",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["dismissed"] == True
        assert data["reappears"] == "tomorrow"
        print("Dismiss contact: SUCCESS")
    
    def test_get_dismissed_today(self, auth_headers):
        """GET /api/mensajes-hoy/whatsapp/dismissed-today - Get dismissed contacts"""
        response = requests.get(
            f"{BASE_URL}/api/mensajes-hoy/whatsapp/dismissed-today",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "dismissed_ids" in data
        assert "count" in data
        assert isinstance(data["dismissed_ids"], list)
        print(f"Dismissed today: {data['count']}")
    
    def test_add_phone_not_found(self, auth_headers):
        """POST /api/mensajes-hoy/whatsapp/add-phone - Returns 404 for non-existent contact"""
        payload = {
            "contact_id": "non-existent-contact-id",
            "contact_type": "contact",
            "phone": "+52 55 1234 5678"
        }
        response = requests.post(
            f"{BASE_URL}/api/mensajes-hoy/whatsapp/add-phone",
            headers=auth_headers,
            json=payload
        )
        # Should return 404 for non-existent contact
        assert response.status_code == 404
        print("Add phone to non-existent contact: 404 as expected")
    
    def test_get_stats(self, auth_headers):
        """GET /api/mensajes-hoy/stats - Get message statistics"""
        response = requests.get(
            f"{BASE_URL}/api/mensajes-hoy/stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "stage_counts" in data
        assert "contacted_today" in data
        assert "whatsapp" in data["contacted_today"]
        assert "linkedin" in data["contacted_today"]
        print(f"Stats: {data}")


class TestLinkedInEvents:
    """Tests for LinkedIn Events URLs endpoint (1.3.2)"""
    
    def test_get_active_linkedin_events(self, auth_headers):
        """GET /api/mensajes-hoy/linkedin/active-events - Get active LinkedIn event URLs"""
        response = requests.get(
            f"{BASE_URL}/api/mensajes-hoy/linkedin/active-events",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "events" in data
        assert "count" in data
        assert "urls_copyable" in data
        
        print(f"Active LinkedIn events: {data['count']}")
        
        # Verify event structure if any events exist
        if data["events"]:
            event = data["events"][0]
            assert "id" in event
            assert "name" in event
            assert "linkedin_url" in event
            assert "status" in event
            print(f"First event: {event['name']} - {event['linkedin_url']}")
    
    def test_get_linkedin_by_keyword(self, auth_headers):
        """GET /api/mensajes-hoy/linkedin/by-keyword - Get LinkedIn contacts by keyword"""
        response = requests.get(
            f"{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "keyword_groups" in data
        assert "total_keywords" in data
        assert "total_contacts" in data
        print(f"LinkedIn keywords: {data['total_keywords']}, contacts: {data['total_contacts']}")


class TestAuthFlow:
    """Tests for authentication flow"""
    
    def test_login_success(self):
        """POST /api/auth/login - Successful login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"Login successful for: {data['user']['email']}")
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login - Invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        assert response.status_code in [401, 400]
        print("Invalid login rejected as expected")
    
    def test_auth_me(self, auth_headers):
        """GET /api/auth/me - Get current user"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert data["email"] == TEST_EMAIL
        print(f"Auth me: {data['email']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
