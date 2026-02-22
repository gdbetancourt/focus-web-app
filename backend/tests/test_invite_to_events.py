"""
Test suite for Invite to Events feature and related bug fixes
Tests:
1. New 'Invite to Events' tab endpoints
2. Import Registrants validation fix
3. Company migration endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestInviteToEventsEndpoints:
    """Test the new Invite to Events feature endpoints"""
    
    def test_events_for_invitations_requires_auth(self):
        """GET /api/todays-focus/events-for-invitations should require auth"""
        response = requests.get(f"{BASE_URL}/api/todays-focus/events-for-invitations")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_event_company_invitations_requires_auth(self):
        """GET /api/todays-focus/events/{event_id}/company-invitations should require auth"""
        response = requests.get(f"{BASE_URL}/api/todays-focus/events/test-event-id/company-invitations")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_mark_companies_invited_requires_auth(self):
        """POST /api/todays-focus/events/{event_id}/mark-companies-invited should require auth"""
        response = requests.post(
            f"{BASE_URL}/api/todays-focus/events/test-event-id/mark-companies-invited",
            json={"company_ids": ["Test Company"]}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_unmark_company_invited_requires_auth(self):
        """POST /api/todays-focus/events/{event_id}/unmark-company-invited should require auth"""
        response = requests.post(
            f"{BASE_URL}/api/todays-focus/events/test-event-id/unmark-company-invited?company_name=Test"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestImportRegistrantsEndpoints:
    """Test Import Registrants endpoints (validation fix)"""
    
    def test_events_pending_import_requires_auth(self):
        """GET /api/todays-focus/events-pending-import should require auth"""
        response = requests.get(f"{BASE_URL}/api/todays-focus/events-pending-import")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_mark_event_imported_requires_auth(self):
        """PATCH /api/todays-focus/events/{event_id}/mark-imported should require auth"""
        response = requests.patch(f"{BASE_URL}/api/todays-focus/events/test-event-id/mark-imported")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_contact_imports_upload_requires_auth(self):
        """POST /api/contacts/imports/upload should require auth"""
        response = requests.post(f"{BASE_URL}/api/contacts/imports/upload")
        # Should return 401 for auth or 422 for missing file (both acceptable)
        assert response.status_code in [401, 422], f"Expected 401 or 422, got {response.status_code}"
    
    def test_contact_imports_validate_requires_auth(self):
        """POST /api/contacts/imports/{batch_id}/validate should require auth"""
        response = requests.post(f"{BASE_URL}/api/contacts/imports/test-batch-id/validate")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestCompanyMigrationEndpoints:
    """Test company migration endpoints for numeric names fix"""
    
    def test_check_numeric_names_requires_auth(self):
        """GET /api/companies/migration/check-numeric-names should require auth"""
        response = requests.get(f"{BASE_URL}/api/companies/migration/check-numeric-names")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_fix_numeric_names_requires_auth(self):
        """POST /api/companies/migration/fix-numeric-names should require auth"""
        response = requests.post(f"{BASE_URL}/api/companies/migration/fix-numeric-names")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_manual_name_fix_requires_auth(self):
        """POST /api/companies/migration/manual-name-fix should require auth"""
        response = requests.post(
            f"{BASE_URL}/api/companies/migration/manual-name-fix?company_id=123&new_name=Test"
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestProspectionEndpoints:
    """Test prospection tab endpoints (edit/combine companies)"""
    
    def test_active_companies_requires_auth(self):
        """GET /api/prospection/active-companies should require auth"""
        response = requests.get(f"{BASE_URL}/api/prospection/active-companies")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_companies_merge_requires_auth(self):
        """POST /api/prospection/companies/merge should require auth"""
        response = requests.post(
            f"{BASE_URL}/api/prospection/companies/merge",
            json={"source_ids": [], "target_id": "test", "target_name": "Test"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_queue_gb_requires_auth(self):
        """GET /api/prospection/queue/GB should require auth"""
        response = requests.get(f"{BASE_URL}/api/prospection/queue/GB")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_queue_mg_requires_auth(self):
        """GET /api/prospection/queue/MG should require auth"""
        response = requests.get(f"{BASE_URL}/api/prospection/queue/MG")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestTodaysFocusExistingEndpoints:
    """Test existing Today's Focus endpoints still work"""
    
    def test_cases_without_dealmaker_requires_auth(self):
        """GET /api/todays-focus/cases-without-dealmaker should require auth"""
        response = requests.get(f"{BASE_URL}/api/todays-focus/cases-without-dealmaker")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_contacts_without_roles_requires_auth(self):
        """GET /api/todays-focus/contacts-without-roles should require auth"""
        response = requests.get(f"{BASE_URL}/api/todays-focus/contacts-without-roles")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_available_roles_requires_auth(self):
        """GET /api/todays-focus/available-roles should require auth"""
        response = requests.get(f"{BASE_URL}/api/todays-focus/available-roles")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_cases_solicited_requires_auth(self):
        """GET /api/todays-focus/cases-solicited should require auth"""
        response = requests.get(f"{BASE_URL}/api/todays-focus/cases-solicited")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestHealthAndBasicEndpoints:
    """Test basic health and public endpoints"""
    
    def test_health_endpoint(self):
        """GET /api/health should return 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", f"Expected healthy status, got {data}"
    
    def test_root_endpoint(self):
        """GET /api/ should return 200"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
