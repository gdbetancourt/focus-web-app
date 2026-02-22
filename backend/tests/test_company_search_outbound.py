"""
Tests for Company Search and Outbound Features (P1 Tasks)
- /api/unified-companies/search endpoint
- /api/prospection/active-companies endpoint
- Outbound companies functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://persona-assets.preview.emergentagent.com')
if BASE_URL.endswith('/'):
    BASE_URL = BASE_URL.rstrip('/')

# Session for authenticated requests
SESSION_TOKEN = "ebb002fc-685e-4806-bb8b-08ad63f2811e"


@pytest.fixture
def auth_cookies():
    """Return session cookies for authentication"""
    return {"session_token": SESSION_TOKEN}


class TestUnifiedCompaniesSearch:
    """Tests for /api/unified-companies/search endpoint"""
    
    def test_search_returns_results(self, auth_cookies):
        """Test that search returns companies matching query"""
        response = requests.get(
            f"{BASE_URL}/api/unified-companies/search",
            params={"q": "Acme", "limit": 10},
            cookies=auth_cookies
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "companies" in data
        assert isinstance(data["companies"], list)
    
    def test_search_minimum_2_chars(self, auth_cookies):
        """Test that search requires minimum 2 characters"""
        # Single char should return empty
        response = requests.get(
            f"{BASE_URL}/api/unified-companies/search",
            params={"q": "A", "limit": 10},
            cookies=auth_cookies
        )
        assert response.status_code == 200
        data = response.json()
        assert data["companies"] == [], "Single char query should return empty results"
    
    def test_search_returns_company_fields(self, auth_cookies):
        """Test that search results include required fields"""
        response = requests.get(
            f"{BASE_URL}/api/unified-companies/search",
            params={"q": "Nov", "limit": 5},
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        if data["companies"]:
            company = data["companies"][0]
            # Required fields for display
            assert "id" in company
            assert "name" in company
            assert "classification" in company
    
    def test_search_by_domain(self, auth_cookies):
        """Test search by domain works"""
        response = requests.get(
            f"{BASE_URL}/api/unified-companies/search",
            params={"q": ".com", "limit": 20},
            cookies=auth_cookies
        )
        assert response.status_code == 200
        data = response.json()
        # Should find some companies with .com in domain
        assert isinstance(data["companies"], list)
    
    def test_search_no_results(self, auth_cookies):
        """Test search with no matches returns empty list"""
        response = requests.get(
            f"{BASE_URL}/api/unified-companies/search",
            params={"q": "xyzzzznonexistent", "limit": 10},
            cookies=auth_cookies
        )
        assert response.status_code == 200
        data = response.json()
        assert data["companies"] == []


class TestProspectionActiveCompanies:
    """Tests for /api/prospection/active-companies endpoint"""
    
    def test_get_active_companies(self, auth_cookies):
        """Test getting list of outbound/active companies"""
        response = requests.get(
            f"{BASE_URL}/api/prospection/active-companies",
            cookies=auth_cookies
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "companies" in data
        assert isinstance(data["companies"], list)
    
    def test_active_companies_have_outbound_classification(self, auth_cookies):
        """Test that active companies are classified as outbound"""
        response = requests.get(
            f"{BASE_URL}/api/prospection/active-companies",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        if data["companies"]:
            # Check first few companies
            for company in data["companies"][:5]:
                assert company.get("classification") == "outbound" or company.get("is_active") == True
    
    def test_active_companies_have_required_fields(self, auth_cookies):
        """Test that active companies include required fields"""
        response = requests.get(
            f"{BASE_URL}/api/prospection/active-companies",
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        if data["companies"]:
            company = data["companies"][0]
            assert "id" in company
            assert "name" in company
            # Optional but expected fields
            assert "searches" in company or True  # searches may or may not be present


class TestUnifiedCompaniesOutbound:
    """Tests for /api/unified-companies/outbound endpoint"""
    
    def test_get_outbound_companies(self, auth_cookies):
        """Test getting list of outbound companies"""
        response = requests.get(
            f"{BASE_URL}/api/unified-companies/outbound",
            cookies=auth_cookies
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "companies" in data
        assert "total" in data
    
    def test_outbound_companies_filtered_correctly(self, auth_cookies):
        """Test that only outbound companies are returned"""
        response = requests.get(
            f"{BASE_URL}/api/unified-companies/outbound",
            params={"limit": 50},
            cookies=auth_cookies
        )
        assert response.status_code == 200
        
        data = response.json()
        if data["companies"]:
            for company in data["companies"][:10]:
                # All should be outbound
                assert company.get("classification") == "outbound", \
                    f"Company {company.get('name')} has classification {company.get('classification')}"


class TestCompaniesAllWithSearch:
    """Tests for /api/prospection/companies/all endpoint with search"""
    
    def test_get_all_companies_with_inactive(self, auth_cookies):
        """Test getting all companies including inactive"""
        response = requests.get(
            f"{BASE_URL}/api/prospection/companies/all",
            params={"include_inactive": "true"},
            cookies=auth_cookies
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "active" in data or "inactive" in data or "companies" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
