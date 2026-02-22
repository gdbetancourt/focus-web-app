"""
Test Prospection Router - Stage 1 qualification, LinkedIn import, and active companies
Tests for the new prospection system endpoints.

Endpoints tested:
- GET /api/prospection/to-qualify/stats - Get qualification stats
- GET /api/prospection/to-qualify/next - Get next contact to qualify
- POST /api/prospection/to-qualify/{id}/qualify - Qualify a contact
- POST /api/prospection/to-qualify/{id}/discard - Discard a contact
- POST /api/prospection/to-qualify/{id}/postpone - Postpone a contact
- POST /api/prospection/to-qualify/{id}/undo-discard - Undo discard
- GET /api/prospection/linkedin-import/status - Get LinkedIn import status
- POST /api/prospection/linkedin-import/mark-export-requested - Mark export requested
- POST /api/prospection/linkedin-import/upload - Upload LinkedIn CSV
- GET /api/prospection/active-companies - Get active companies
- POST /api/prospection/companies/{id}/searches - Add search to company
- DELETE /api/prospection/searches/{id} - Delete search
- POST /api/prospection/searches/{id}/mark-copied - Mark search as copied
- GET /api/prospection/queue/{profile} - Get prospection queue
- PATCH /api/prospection/contacts/{id}/stage-1-status - Update Stage 1 status
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestProspectionEndpointsNoAuth:
    """Test that prospection endpoints require authentication (return 401)"""
    
    def test_to_qualify_stats_requires_auth(self):
        """GET /api/prospection/to-qualify/stats should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/prospection/to-qualify/stats")
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_to_qualify_next_requires_auth(self):
        """GET /api/prospection/to-qualify/next should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/prospection/to-qualify/next")
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_linkedin_import_status_requires_auth(self):
        """GET /api/prospection/linkedin-import/status should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/prospection/linkedin-import/status")
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_active_companies_requires_auth(self):
        """GET /api/prospection/active-companies should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/prospection/active-companies")
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_queue_gb_requires_auth(self):
        """GET /api/prospection/queue/GB should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/prospection/queue/GB")
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_queue_mg_requires_auth(self):
        """GET /api/prospection/queue/MG should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/prospection/queue/MG")
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_qualify_contact_requires_auth(self):
        """POST /api/prospection/to-qualify/{id}/qualify should return 401 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/prospection/to-qualify/test-id/qualify",
            json={"buyer_persona": "mateo"}
        )
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_discard_contact_requires_auth(self):
        """POST /api/prospection/to-qualify/{id}/discard should return 401 without auth"""
        response = requests.post(f"{BASE_URL}/api/prospection/to-qualify/test-id/discard")
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_postpone_contact_requires_auth(self):
        """POST /api/prospection/to-qualify/{id}/postpone should return 401 without auth"""
        response = requests.post(f"{BASE_URL}/api/prospection/to-qualify/test-id/postpone")
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_undo_discard_requires_auth(self):
        """POST /api/prospection/to-qualify/{id}/undo-discard should return 401 without auth"""
        response = requests.post(f"{BASE_URL}/api/prospection/to-qualify/test-id/undo-discard")
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_mark_export_requested_requires_auth(self):
        """POST /api/prospection/linkedin-import/mark-export-requested should return 401 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/prospection/linkedin-import/mark-export-requested",
            json={"profile": "GB"}
        )
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_add_search_to_company_requires_auth(self):
        """POST /api/prospection/companies/{id}/searches should return 401 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/prospection/companies/test-id/searches",
            json={"keyword": "test", "url": "https://linkedin.com/search"}
        )
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_delete_search_requires_auth(self):
        """DELETE /api/prospection/searches/{id} should return 401 without auth"""
        response = requests.delete(f"{BASE_URL}/api/prospection/searches/test-id")
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_mark_search_copied_requires_auth(self):
        """POST /api/prospection/searches/{id}/mark-copied should return 401 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/prospection/searches/test-id/mark-copied",
            json={"profile": "GB"}
        )
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_update_stage_1_status_requires_auth(self):
        """PATCH /api/prospection/contacts/{id}/stage-1-status should return 401 without auth"""
        response = requests.patch(
            f"{BASE_URL}/api/prospection/contacts/test-id/stage-1-status",
            json={"status": "accepted", "linkedin_profile": "GB"}
        )
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_toggle_company_active_requires_auth(self):
        """PATCH /api/prospection/companies/{id}/toggle-active should return 401 without auth"""
        response = requests.patch(f"{BASE_URL}/api/prospection/companies/test-id/toggle-active")
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_merge_companies_requires_auth(self):
        """POST /api/prospection/companies/merge should return 401 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/prospection/companies/merge",
            json={"source_ids": ["id1"], "target_id": "id2", "target_name": "Test"}
        )
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_get_all_managed_companies_requires_auth(self):
        """GET /api/prospection/companies/all should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/prospection/companies/all")
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")


class TestProspectionEndpointValidation:
    """Test endpoint validation (invalid profiles, etc.) - these should return 401 first"""
    
    def test_queue_invalid_profile_returns_401_first(self):
        """GET /api/prospection/queue/INVALID should return 401 without auth (before validation)"""
        response = requests.get(f"{BASE_URL}/api/prospection/queue/INVALID")
        # Without auth, should return 401 before profile validation
        assert response.status_code == 401


class TestProspectionRouterExists:
    """Verify the prospection router is properly mounted"""
    
    def test_prospection_prefix_exists(self):
        """Verify /api/prospection prefix returns proper responses (not 404)"""
        # All these should return 401 (auth required) not 404 (not found)
        endpoints = [
            "/api/prospection/to-qualify/stats",
            "/api/prospection/to-qualify/next",
            "/api/prospection/linkedin-import/status",
            "/api/prospection/active-companies",
            "/api/prospection/queue/GB",
            "/api/prospection/companies/all"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code != 404, f"Endpoint {endpoint} returned 404 - router may not be mounted"
            assert response.status_code == 401, f"Endpoint {endpoint} should return 401, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
