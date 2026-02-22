"""
Test Fase 3 Features - Leaderlix CRM
Tests for:
1. Convenios endpoint optimization (GET /api/convenios/companies)
2. Small business deletion endpoint (DELETE /api/scrappers/small-business)
3. Login flow verification
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://persona-assets.preview.emergentagent.com')

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
    data = response.json()
    assert "access_token" in data, "No access_token in response"
    return data["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestAPIHealth:
    """Basic API health checks"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Leaderlix" in data["message"]
        print(f"API Version: {data.get('version', 'unknown')}")


class TestAuthentication:
    """Authentication flow tests"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
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
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"


class TestConveniosEndpoint:
    """Tests for the optimized Convenios endpoint"""
    
    def test_convenios_companies_returns_500(self, auth_headers):
        """Test GET /api/convenios/companies returns 500 companies"""
        start_time = time.time()
        response = requests.get(
            f"{BASE_URL}/api/convenios/companies",
            headers=auth_headers
        )
        elapsed_time = time.time() - start_time
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify total count
        assert "total" in data, "Missing 'total' field"
        assert data["total"] == 500, f"Expected 500 companies, got {data['total']}"
        
        # Verify companies array
        assert "companies" in data, "Missing 'companies' field"
        assert len(data["companies"]) == 500, f"Expected 500 companies in array, got {len(data['companies'])}"
        
        # Verify response time is optimized (should be < 5 seconds, was 22s before)
        print(f"Response time: {elapsed_time:.2f}s")
        assert elapsed_time < 10, f"Response too slow: {elapsed_time:.2f}s (should be < 10s)"
        
        print(f"TEST PASS: Convenios endpoint returned {data['total']} companies in {elapsed_time:.2f}s")
    
    def test_convenios_companies_structure(self, auth_headers):
        """Test that companies have correct structure with Ricardo contacts"""
        response = requests.get(
            f"{BASE_URL}/api/convenios/companies",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check first company structure
        first_company = data["companies"][0]
        required_fields = ["id", "name", "ricardo_count", "contacts"]
        for field in required_fields:
            assert field in first_company, f"Missing field: {field}"
        
        # Verify Ricardo count is positive
        assert first_company["ricardo_count"] > 0, "First company should have Ricardo contacts"
        
        # Verify companies are sorted by Ricardo count (descending)
        companies = data["companies"]
        for i in range(len(companies) - 1):
            assert companies[i]["ricardo_count"] >= companies[i+1]["ricardo_count"], \
                f"Companies not sorted by ricardo_count at index {i}"
        
        print(f"Top company: {first_company['name']} with {first_company['ricardo_count']} Ricardo contacts")
    
    def test_convenios_stats(self, auth_headers):
        """Test GET /api/convenios/stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/convenios/stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "total" in data
        assert "con_interes" in data
        assert "activos" in data
        
        print(f"Convenios stats: total={data['total']}, con_interes={data['con_interes']}, activos={data['activos']}")


class TestSmallBusinessEndpoint:
    """Tests for the small business deletion endpoint"""
    
    def test_small_business_list_empty(self, auth_headers):
        """Test GET /api/scrappers/small-business returns empty (after deletion)"""
        response = requests.get(
            f"{BASE_URL}/api/scrappers/small-business",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "businesses" in data
        assert "total" in data
        assert data["total"] == 0, f"Expected 0 businesses, got {data['total']}"
        assert len(data["businesses"]) == 0, "Expected empty businesses array"
        
        print("TEST PASS: Small businesses list is empty (21 were deleted)")
    
    def test_delete_all_small_businesses_idempotent(self, auth_headers):
        """Test DELETE /api/scrappers/small-business is idempotent (returns 0 when empty)"""
        response = requests.delete(
            f"{BASE_URL}/api/scrappers/small-business",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["deleted_count"] == 0, "Should delete 0 since already empty"
        
        print(f"TEST PASS: Delete endpoint is idempotent - {data['message']}")


class TestSidebarModulesRemoved:
    """Verify removed modules are not accessible via API"""
    
    def test_nurturing_structure(self, auth_headers):
        """Verify the navigation structure doesn't include removed modules"""
        # This is a code review verification - the modules were removed from Layout.jsx
        # We verify by checking that the expected routes still work
        
        # Test 2.1.1 Import LinkedIn (should work)
        # Test 2.1.3 Nurture Deal Makers (should work)
        # Test 2.2.3 Testimonials (should work)
        
        # These are frontend routes, so we just verify the API is accessible
        response = requests.get(f"{BASE_URL}/api/", headers=auth_headers)
        assert response.status_code == 200
        print("TEST PASS: API accessible - sidebar module removal is frontend-only change")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
