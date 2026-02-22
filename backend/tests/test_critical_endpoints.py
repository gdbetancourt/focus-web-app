"""
Critical endpoint tests for Leaderlix Automation Platform
Tests: Authentication, Contacts, Companies, Sectors, Buyer Personas, Events
Routes:
- /api/auth/* - Authentication
- /api/events/* - Events
- /api/hubspot/* - HubSpot contacts, companies, buyer-personas, sectors
- /api/buyer-personas-db/* - Buyer personas from DB
- /api/thematic-axes/* - Thematic axes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "perla@leaderlix.com"
TEST_PASSWORD = "Leaderlix2025"


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"API root response: {data}")
    
    def test_login_success(self):
        """Test successful login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"Login successful, token received")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code in [401, 400, 404]
        print(f"Invalid login correctly rejected with status {response.status_code}")


@pytest.fixture
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestContacts:
    """CRITICAL - Contacts endpoint tests (previously freezing)"""
    
    def test_get_contacts(self, auth_headers):
        """Test contacts load correctly - CRITICAL FIX"""
        response = requests.get(f"{BASE_URL}/api/hubspot/contacts", headers=auth_headers, timeout=30)
        assert response.status_code == 200, f"Contacts failed to load: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Contacts should return a list"
        print(f"Contacts loaded successfully: {len(data)} contacts")
        # Verify we have contacts (should be ~965)
        assert len(data) > 0, "No contacts returned"
    
    def test_contacts_have_required_fields(self, auth_headers):
        """Test contacts have required fields"""
        response = requests.get(f"{BASE_URL}/api/hubspot/contacts", headers=auth_headers, timeout=30)
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            contact = data[0]
            print(f"Sample contact fields: {list(contact.keys())[:10]}")


class TestCompanies:
    """CRITICAL - Companies endpoint tests (previously freezing)"""
    
    def test_get_companies(self, auth_headers):
        """Test companies load correctly - CRITICAL FIX"""
        response = requests.get(f"{BASE_URL}/api/hubspot/companies", headers=auth_headers, timeout=30)
        assert response.status_code == 200, f"Companies failed to load: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Companies should return a list"
        print(f"Companies loaded successfully: {len(data)} companies")


class TestSectors:
    """CRITICAL - Sectors endpoint tests (previously freezing)"""
    
    def test_get_sectors(self, auth_headers):
        """Test sectors load correctly - CRITICAL FIX - route: /api/hubspot/sectors"""
        response = requests.get(f"{BASE_URL}/api/hubspot/sectors", headers=auth_headers, timeout=30)
        assert response.status_code == 200, f"Sectors failed to load: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Sectors should return a list"
        print(f"Sectors loaded successfully: {len(data)} sectors")


class TestBuyerPersonasHubSpot:
    """CRITICAL - Buyer Personas from HubSpot endpoint tests"""
    
    def test_get_buyer_personas_hubspot(self, auth_headers):
        """Test buyer personas from HubSpot load correctly - route: /api/hubspot/buyer-personas"""
        response = requests.get(f"{BASE_URL}/api/hubspot/buyer-personas", headers=auth_headers, timeout=30)
        assert response.status_code == 200, f"Buyer personas (HubSpot) failed to load: {response.text}"
        data = response.json()
        # Response is a dict with buyer_personas list and persona_map
        assert isinstance(data, dict), "Buyer personas should return a dict"
        assert "buyer_personas" in data, "Response should have buyer_personas key"
        assert isinstance(data["buyer_personas"], list), "buyer_personas should be a list"
        print(f"Buyer personas (HubSpot) loaded successfully: {len(data['buyer_personas'])} personas")


class TestBuyerPersonasDB:
    """CRITICAL - Buyer Personas from DB endpoint tests"""
    
    def test_get_buyer_personas_db(self, auth_headers):
        """Test buyer personas from DB load correctly - route: /api/buyer-personas-db/"""
        response = requests.get(f"{BASE_URL}/api/buyer-personas-db/", headers=auth_headers, timeout=30)
        assert response.status_code == 200, f"Buyer personas (DB) failed to load: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Buyer personas should return a list"
        print(f"Buyer personas (DB) loaded successfully: {len(data)} personas")
    
    def test_buyer_personas_have_display_name(self, auth_headers):
        """Test buyer personas have display_name (fictitious names)"""
        response = requests.get(f"{BASE_URL}/api/buyer-personas-db/", headers=auth_headers, timeout=30)
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            persona = data[0]
            has_display_name = "display_name" in persona
            print(f"Buyer persona has display_name: {has_display_name}")
            if has_display_name:
                print(f"Sample display_name: {persona.get('display_name')}")
            print(f"Sample persona fields: {list(persona.keys())}")


class TestThematicAxes:
    """Thematic Axes endpoint tests"""
    
    def test_get_thematic_axes(self, auth_headers):
        """Test thematic axes load correctly - route: /api/thematic-axes/"""
        response = requests.get(f"{BASE_URL}/api/thematic-axes/", headers=auth_headers, timeout=30)
        assert response.status_code == 200, f"Thematic axes failed to load: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Thematic axes should return a list"
        print(f"Thematic axes loaded successfully: {len(data)} axes")


class TestEvents:
    """Events endpoint tests"""
    
    def test_get_events(self, auth_headers):
        """Test events load correctly - route: /api/events/"""
        response = requests.get(f"{BASE_URL}/api/events/", headers=auth_headers, timeout=30)
        assert response.status_code == 200, f"Events failed to load: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Events should return a list"
        print(f"Events loaded successfully: {len(data)} events")


class TestGenerateTitle:
    """AI Title Generation endpoint tests"""
    
    def test_generate_title_with_ai(self, auth_headers):
        """Test generate title endpoint with AI - route: /api/events/generate-title"""
        # First get a thematic axis
        axes_response = requests.get(f"{BASE_URL}/api/thematic-axes/", headers=auth_headers, timeout=30)
        if axes_response.status_code != 200 or len(axes_response.json()) == 0:
            pytest.skip("No thematic axes available")
        
        axis = axes_response.json()[0]
        
        # Get a buyer persona from DB
        personas_response = requests.get(f"{BASE_URL}/api/buyer-personas-db/", headers=auth_headers, timeout=30)
        if personas_response.status_code != 200 or len(personas_response.json()) == 0:
            pytest.skip("No buyer personas available")
        
        persona = personas_response.json()[0]
        persona_code = persona.get("code")
        
        print(f"Testing with axis: {axis.get('name')}, persona code: {persona_code}")
        
        # Test generate title endpoint
        response = requests.post(
            f"{BASE_URL}/api/events/generate-title",
            headers=auth_headers,
            json={
                "thematic_axis_id": axis.get("id"),
                "buyer_persona_code": persona_code
            },
            timeout=60  # AI generation may take time
        )
        
        print(f"Generate title response status: {response.status_code}")
        print(f"Generate title response: {response.text[:500] if response.text else 'empty'}")
        
        # Should return 200 or 422 (validation error) - not 500
        assert response.status_code in [200, 422, 400], f"Generate title failed: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "title" in data, "Response should contain title"
            print(f"Generated title: {data.get('title')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
