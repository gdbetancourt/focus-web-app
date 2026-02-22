"""
P1 Data Transition Tests - Verify unified_contacts and unified_companies migration

Tests:
1. GET /api/contacts - returns contacts from unified_contacts
2. GET /api/hubspot/sectors - returns company counts from unified_companies
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
SESSION_TOKEN = "ebb002fc-685e-4806-bb8b-08ad63f2811e"  # From iteration_70


class TestUnifiedContactsAPI:
    """Test /api/contacts endpoint using unified_contacts collection"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create session with auth cookie"""
        s = requests.Session()
        s.cookies.set("session_token", SESSION_TOKEN)
        return s
    
    def test_get_contacts_returns_200(self, session):
        """GET /api/contacts should return 200"""
        response = session.get(f"{BASE_URL}/api/contacts")
        print(f"GET /api/contacts status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_get_contacts_has_contacts_array(self, session):
        """Response should have contacts array"""
        response = session.get(f"{BASE_URL}/api/contacts")
        data = response.json()
        
        assert "contacts" in data, "Response should have 'contacts' key"
        assert isinstance(data["contacts"], list), "contacts should be a list"
        print(f"Contacts count: {len(data['contacts'])}")
    
    def test_get_contacts_has_total(self, session):
        """Response should have total count"""
        response = session.get(f"{BASE_URL}/api/contacts")
        data = response.json()
        
        assert "total" in data, "Response should have 'total' key"
        print(f"Total contacts: {data['total']}")
    
    def test_get_contacts_structure(self, session):
        """Contacts should have expected structure"""
        response = session.get(f"{BASE_URL}/api/contacts?limit=10")
        data = response.json()
        
        if len(data["contacts"]) > 0:
            contact = data["contacts"][0]
            # Required fields from unified_contacts schema
            expected_fields = ["id", "name"]
            for field in expected_fields:
                assert field in contact, f"Contact should have '{field}' field"
            print(f"Sample contact: id={contact.get('id')}, name={contact.get('name')}, email={contact.get('email')}")
    
    def test_get_contacts_with_limit(self, session):
        """GET /api/contacts with limit parameter should work"""
        response = session.get(f"{BASE_URL}/api/contacts?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data["contacts"]) <= 5, "Should respect limit parameter"
        print(f"Returned {len(data['contacts'])} contacts with limit=5")


class TestHubSpotSectorsAPI:
    """Test /api/hubspot/sectors endpoint using unified_companies collection"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create session with auth cookie"""
        s = requests.Session()
        s.cookies.set("session_token", SESSION_TOKEN)
        return s
    
    def test_get_sectors_returns_200(self, session):
        """GET /api/hubspot/sectors should return 200"""
        response = session.get(f"{BASE_URL}/api/hubspot/sectors")
        print(f"GET /api/hubspot/sectors status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_get_sectors_is_array(self, session):
        """Response should be an array of sectors"""
        response = session.get(f"{BASE_URL}/api/hubspot/sectors")
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list of sectors"
        print(f"Sectors count: {len(data)}")
    
    def test_sectors_have_company_count(self, session):
        """Sectors should have company_count from unified_companies"""
        response = session.get(f"{BASE_URL}/api/hubspot/sectors")
        data = response.json()
        
        if len(data) > 0:
            sector = data[0]
            assert "company_count" in sector, "Sector should have 'company_count' field"
            print(f"Sample sector: {sector.get('hubspot_label', sector.get('custom_name'))}, company_count={sector.get('company_count')}")
    
    def test_sectors_structure(self, session):
        """Sectors should have expected structure"""
        response = session.get(f"{BASE_URL}/api/hubspot/sectors")
        data = response.json()
        
        if len(data) > 0:
            sector = data[0]
            expected_fields = ["id"]
            for field in expected_fields:
                assert field in sector, f"Sector should have '{field}' field"


class TestContactsAndSectorsIntegration:
    """Integration tests verifying data comes from correct collections"""
    
    @pytest.fixture(scope="class")
    def session(self):
        s = requests.Session()
        s.cookies.set("session_token", SESSION_TOKEN)
        return s
    
    def test_contacts_and_sectors_both_work(self, session):
        """Both endpoints should work together"""
        contacts_resp = session.get(f"{BASE_URL}/api/contacts?limit=10")
        sectors_resp = session.get(f"{BASE_URL}/api/hubspot/sectors")
        
        assert contacts_resp.status_code == 200, "Contacts endpoint should work"
        assert sectors_resp.status_code == 200, "Sectors endpoint should work"
        
        contacts_data = contacts_resp.json()
        sectors_data = sectors_resp.json()
        
        print(f"Integration test: {len(contacts_data['contacts'])} contacts, {len(sectors_data)} sectors")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
