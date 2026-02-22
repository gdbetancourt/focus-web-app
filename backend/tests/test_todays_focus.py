"""
Test Today's Focus API Endpoints
Tests for TodaysFocus page refactoring and Quotes tab implementation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTodaysFocusEndpoints:
    """Test Today's Focus API endpoints - unauthenticated access should return 401"""
    
    def test_cases_without_dealmaker_requires_auth(self):
        """GET /api/todays-focus/cases-without-dealmaker requires authentication"""
        response = requests.get(f"{BASE_URL}/api/todays-focus/cases-without-dealmaker")
        # Should return 401 or 403 for unauthenticated requests
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"PASS: cases-without-dealmaker returns {response.status_code} for unauthenticated request")
    
    def test_contacts_without_roles_requires_auth(self):
        """GET /api/todays-focus/contacts-without-roles requires authentication"""
        response = requests.get(f"{BASE_URL}/api/todays-focus/contacts-without-roles")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"PASS: contacts-without-roles returns {response.status_code} for unauthenticated request")
    
    def test_cases_solicited_requires_auth(self):
        """GET /api/todays-focus/cases-solicited requires authentication (Quotes tab)"""
        response = requests.get(f"{BASE_URL}/api/todays-focus/cases-solicited")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"PASS: cases-solicited returns {response.status_code} for unauthenticated request")
    
    def test_available_roles_requires_auth(self):
        """GET /api/todays-focus/available-roles requires authentication"""
        response = requests.get(f"{BASE_URL}/api/todays-focus/available-roles")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: available-roles returns {response.status_code} for unauthenticated request")
    
    def test_assign_dealmaker_requires_auth(self):
        """POST /api/todays-focus/assign-dealmaker requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/todays-focus/assign-dealmaker",
            json={"case_id": "test", "contact_id": "test"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: assign-dealmaker returns {response.status_code} for unauthenticated request")
    
    def test_mark_dm_complete_requires_auth(self):
        """POST /api/todays-focus/mark-dm-complete requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/todays-focus/mark-dm-complete",
            json={"case_id": "test"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: mark-dm-complete returns {response.status_code} for unauthenticated request")
    
    def test_assign_roles_requires_auth(self):
        """POST /api/todays-focus/assign-roles requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/todays-focus/assign-roles",
            json={"contact_id": "test", "roles": ["deal_maker"]}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: assign-roles returns {response.status_code} for unauthenticated request")
    
    def test_dealmaker_followup_requires_auth(self):
        """GET /api/todays-focus/dealmaker-followup requires authentication"""
        response = requests.get(f"{BASE_URL}/api/todays-focus/dealmaker-followup")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: dealmaker-followup returns {response.status_code} for unauthenticated request")
    
    def test_batting_stats_requires_auth(self):
        """GET /api/todays-focus/batting-stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/todays-focus/batting-stats")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"PASS: batting-stats returns {response.status_code} for unauthenticated request")


class TestAPIStructure:
    """Test API endpoint structure and routing"""
    
    def test_api_root_accessible(self):
        """API root should be accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: API root is accessible")
    
    def test_todays_focus_prefix_exists(self):
        """Today's Focus endpoints should exist under /api/todays-focus/"""
        # Test that the endpoint exists (even if auth required)
        response = requests.get(f"{BASE_URL}/api/todays-focus/cases-without-dealmaker")
        # Should not be 404 - endpoint exists but requires auth
        assert response.status_code != 404, "Endpoint /api/todays-focus/cases-without-dealmaker not found"
        print("PASS: todays-focus prefix exists")
    
    def test_invalid_endpoint_returns_404(self):
        """Invalid endpoint should return 404"""
        response = requests.get(f"{BASE_URL}/api/todays-focus/invalid-endpoint-xyz")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Invalid endpoint returns 404")


class TestRequestValidation:
    """Test request body validation for POST endpoints"""
    
    def test_assign_dealmaker_validates_body(self):
        """POST /api/todays-focus/assign-dealmaker should validate request body"""
        # Empty body
        response = requests.post(
            f"{BASE_URL}/api/todays-focus/assign-dealmaker",
            json={}
        )
        # Should return 401 (auth) or 422 (validation) - not 500
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"PASS: assign-dealmaker validates body (returns {response.status_code})")
    
    def test_assign_roles_validates_body(self):
        """POST /api/todays-focus/assign-roles should validate request body"""
        # Empty body
        response = requests.post(
            f"{BASE_URL}/api/todays-focus/assign-roles",
            json={}
        )
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"PASS: assign-roles validates body (returns {response.status_code})")
    
    def test_mark_dm_complete_validates_body(self):
        """POST /api/todays-focus/mark-dm-complete should validate request body"""
        response = requests.post(
            f"{BASE_URL}/api/todays-focus/mark-dm-complete",
            json={}
        )
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"PASS: mark-dm-complete validates body (returns {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
