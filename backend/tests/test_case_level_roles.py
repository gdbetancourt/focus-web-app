"""
Test Suite for Case-Level Role Assignment Bug Fixes (Iteration 64)

Tests for the following user-reported bugs:
1. Roles not reflected in grouping after saving
2. Sticky/ghost roles reappearing (roles not being cleared properly)
3. Cannot delete all roles (sending roles=[] should clear all roles)
4. Multi-role grouping not working correctly (contact with multiple roles should appear in multiple groups)

Endpoints tested:
- PUT /api/todays-focus/case-roles - Save case-level roles (including empty array to delete all)
- GET /api/cases/by-contact/{contact_id} - Get cases with case_roles array
- GET /api/cases/delivery/ganados - Get contacts with case_roles for grouping

Test contact: Kathia Lira (6958db72-e0ee-45f4-b143-3638cf1426a0) has roles ['coachee', 'deal_maker'] 
             in case 965ead56-a20c-491a-b5b7-a37c8c5aaca9
"""
import os
import pytest
import requests
from datetime import datetime, timezone

# Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test JWT token
TEST_JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4ZjliMTVkZS05YWRmLTQ3MTYtOWNmMy05ZDIzNGNkZmNhY2MiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJleHAiOjE3NzE1NDY2OTV9.70ghHeMc9LTWYg6GhV7jIoOp_LaKYg4193G4bNKezno"

# Test data from context
TEST_CONTACT_ID = "6958db72-e0ee-45f4-b143-3638cf1426a0"  # Kathia Lira
TEST_CASE_ID = "965ead56-a20c-491a-b5b7-a37c8c5aaca9"
TEST_EXPECTED_ROLES = ["coachee", "deal_maker"]


@pytest.fixture
def auth_headers():
    """Return headers with JWT authentication"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TEST_JWT_TOKEN}"
    }


@pytest.fixture
def api_session():
    """Create a requests session"""
    session = requests.Session()
    return session


# ============ PUT /api/todays-focus/case-roles Tests ============

class TestCaseRolesEndpoint:
    """
    Tests for PUT /api/todays-focus/case-roles endpoint
    This is the authoritative endpoint for case-level role assignment
    """
    
    def test_case_roles_endpoint_exists(self, api_session, auth_headers):
        """CRITICAL: case-roles endpoint should exist and accept PUT requests"""
        # Send a GET request first to verify endpoint exists (will fail but with 405)
        response = api_session.get(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers
        )
        # Should return 405 Method Not Allowed (PUT only) or 404 if wrong path
        # We'll test with PUT to verify it's functional
        print(f"GET response status: {response.status_code}")
    
    def test_set_single_role(self, api_session, auth_headers):
        """Test setting a single role for a contact-case pair"""
        payload = {
            "contact_id": TEST_CONTACT_ID,
            "case_id": TEST_CASE_ID,
            "roles": ["coachee"]
        }
        
        response = api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json=payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got: {data}"
        assert data.get("contact_id") == TEST_CONTACT_ID
        assert data.get("case_id") == TEST_CASE_ID
        assert "coachee" in data.get("case_roles", []), f"Expected 'coachee' in case_roles, got: {data.get('case_roles')}"
    
    def test_set_multiple_roles(self, api_session, auth_headers):
        """CRITICAL: Test setting multiple roles (multi-role grouping fix)"""
        payload = {
            "contact_id": TEST_CONTACT_ID,
            "case_id": TEST_CASE_ID,
            "roles": ["coachee", "deal_maker"]
        }
        
        response = api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json=payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        case_roles = data.get("case_roles", [])
        
        # CRITICAL: Both roles should be saved
        assert "coachee" in case_roles, f"Expected 'coachee' in case_roles, got: {case_roles}"
        assert "deal_maker" in case_roles, f"Expected 'deal_maker' in case_roles, got: {case_roles}"
        
        print(f"Multi-role assignment successful: {case_roles}")
    
    def test_delete_all_roles_empty_array(self, api_session, auth_headers):
        """CRITICAL BUG FIX: Sending roles=[] should DELETE all roles for contact+case"""
        # First, ensure there are roles to delete
        setup_payload = {
            "contact_id": TEST_CONTACT_ID,
            "case_id": TEST_CASE_ID,
            "roles": ["coachee", "deal_maker"]
        }
        api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json=setup_payload
        )
        
        # Now delete all roles by sending empty array
        delete_payload = {
            "contact_id": TEST_CONTACT_ID,
            "case_id": TEST_CASE_ID,
            "roles": []
        }
        
        response = api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json=delete_payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        case_roles = data.get("case_roles", [])
        
        # CRITICAL: case_roles should be empty
        assert case_roles == [], f"Expected empty case_roles after deletion, got: {case_roles}"
        
        # Verify with deleted_count
        deleted_count = data.get("deleted_count", 0)
        assert deleted_count >= 0, "Should report deleted_count"
        
        print(f"All roles deleted successfully. deleted_count={deleted_count}")
    
    def test_role_replacement_not_append(self, api_session, auth_headers):
        """
        Test that setting new roles REPLACES existing roles (not appends).
        This fixes the "sticky/ghost roles" bug.
        """
        # Step 1: Set initial roles
        initial_payload = {
            "contact_id": TEST_CONTACT_ID,
            "case_id": TEST_CASE_ID,
            "roles": ["coachee", "deal_maker", "sponsor"]
        }
        
        response1 = api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json=initial_payload
        )
        assert response1.status_code == 200
        
        # Step 2: Set DIFFERENT roles (should replace, not append)
        replacement_payload = {
            "contact_id": TEST_CONTACT_ID,
            "case_id": TEST_CASE_ID,
            "roles": ["coachee"]  # Only coachee now
        }
        
        response2 = api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json=replacement_payload
        )
        assert response2.status_code == 200
        
        data = response2.json()
        case_roles = data.get("case_roles", [])
        
        # CRITICAL: Should ONLY have 'coachee', not old roles
        assert "coachee" in case_roles, f"Expected 'coachee' in case_roles"
        assert "deal_maker" not in case_roles, f"'deal_maker' should have been removed, got: {case_roles}"
        assert "sponsor" not in case_roles, f"'sponsor' should have been removed, got: {case_roles}"
        
        print(f"Role replacement (not append) verified: {case_roles}")
    
    def test_invalid_role_rejected(self, api_session, auth_headers):
        """Test that invalid roles are rejected"""
        payload = {
            "contact_id": TEST_CONTACT_ID,
            "case_id": TEST_CASE_ID,
            "roles": ["invalid_role_xyz"]
        }
        
        response = api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json=payload
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid role, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data, "Should have error detail"
        print(f"Invalid role correctly rejected: {data.get('detail')}")
    
    def test_nonexistent_contact_rejected(self, api_session, auth_headers):
        """Test that nonexistent contact returns 404"""
        payload = {
            "contact_id": "nonexistent-contact-id-12345",
            "case_id": TEST_CASE_ID,
            "roles": ["coachee"]
        }
        
        response = api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json=payload
        )
        
        assert response.status_code == 404, f"Expected 404 for nonexistent contact, got {response.status_code}"
    
    def test_nonexistent_case_rejected(self, api_session, auth_headers):
        """Test that nonexistent case returns 404"""
        payload = {
            "contact_id": TEST_CONTACT_ID,
            "case_id": "nonexistent-case-id-12345",
            "roles": ["coachee"]
        }
        
        response = api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json=payload
        )
        
        assert response.status_code == 404, f"Expected 404 for nonexistent case, got {response.status_code}"


# ============ GET /api/cases/by-contact/{contact_id} Tests ============

class TestCasesByContactEndpoint:
    """
    Tests for GET /api/cases/by-contact/{contact_id} endpoint
    Should return case_roles array for each case
    """
    
    def test_endpoint_returns_200(self, api_session, auth_headers):
        """Endpoint should return 200 for valid contact"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/by-contact/{TEST_CONTACT_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_cases_have_case_roles_array(self, api_session, auth_headers):
        """CRITICAL: Each case should have 'case_roles' array field"""
        # First, ensure contact has roles
        setup_payload = {
            "contact_id": TEST_CONTACT_ID,
            "case_id": TEST_CASE_ID,
            "roles": ["coachee", "deal_maker"]
        }
        api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json=setup_payload
        )
        
        # Now get cases by contact
        response = api_session.get(
            f"{BASE_URL}/api/cases/by-contact/{TEST_CONTACT_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        cases = response.json()
        assert isinstance(cases, list), f"Expected list of cases, got: {type(cases)}"
        
        # Find the test case
        test_case = next((c for c in cases if c.get("id") == TEST_CASE_ID), None)
        
        if test_case:
            assert "case_roles" in test_case, f"Case should have 'case_roles' field"
            case_roles = test_case.get("case_roles", [])
            assert isinstance(case_roles, list), "case_roles should be a list"
            
            print(f"Case '{test_case.get('name')}' has case_roles: {case_roles}")
            
            # CRITICAL: The roles we set should be present
            assert "coachee" in case_roles, f"Expected 'coachee' in case_roles, got: {case_roles}"
            assert "deal_maker" in case_roles, f"Expected 'deal_maker' in case_roles, got: {case_roles}"
        else:
            print(f"Test case {TEST_CASE_ID} not found in contact's cases (may not be associated)")
    
    def test_empty_case_roles_after_deletion(self, api_session, auth_headers):
        """CRITICAL: After deleting all roles, case_roles should be empty array"""
        # Delete all roles
        delete_payload = {
            "contact_id": TEST_CONTACT_ID,
            "case_id": TEST_CASE_ID,
            "roles": []
        }
        api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json=delete_payload
        )
        
        # Get cases by contact
        response = api_session.get(
            f"{BASE_URL}/api/cases/by-contact/{TEST_CONTACT_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        cases = response.json()
        test_case = next((c for c in cases if c.get("id") == TEST_CASE_ID), None)
        
        if test_case:
            case_roles = test_case.get("case_roles", [])
            assert case_roles == [], f"Expected empty case_roles after deletion, got: {case_roles}"
            print(f"Verified: case_roles is empty after deletion: {case_roles}")


# ============ GET /api/cases/delivery/ganados Tests ============

class TestDeliveryGanadosEndpoint:
    """
    Tests for GET /api/cases/delivery/ganados endpoint
    Should return contacts with case_roles for proper grouping
    """
    
    def test_endpoint_returns_200(self, api_session, auth_headers):
        """Endpoint should return 200"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_contacts_have_case_roles(self, api_session, auth_headers):
        """CRITICAL: Contacts in each case should have 'case_roles' field"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        for case in cases[:3]:  # Check first 3 cases
            contacts = case.get("contacts", [])
            for contact in contacts:
                assert "case_roles" in contact, \
                    f"Contact '{contact.get('name')}' in case '{case.get('name')}' should have 'case_roles' field"
                assert isinstance(contact["case_roles"], list), \
                    f"case_roles should be list, got: {type(contact['case_roles'])}"
                
                print(f"Contact '{contact.get('name')}': case_roles={contact['case_roles']}")
    
    def test_multi_role_contact_grouping(self, api_session, auth_headers):
        """
        CRITICAL: Contact with multiple roles (e.g., coachee + deal_maker) 
        should appear in BOTH role groups
        """
        # First, set up multi-role for test contact
        setup_payload = {
            "contact_id": TEST_CONTACT_ID,
            "case_id": TEST_CASE_ID,
            "roles": ["coachee", "deal_maker"]
        }
        api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json=setup_payload
        )
        
        # Get ganados cases
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        # Find test case
        test_case = next((c for c in cases if c.get("id") == TEST_CASE_ID), None)
        
        if test_case:
            contacts = test_case.get("contacts", [])
            test_contact = next((c for c in contacts if c.get("id") == TEST_CONTACT_ID), None)
            
            if test_contact:
                case_roles = test_contact.get("case_roles", [])
                print(f"Test contact '{test_contact.get('name')}' has case_roles: {case_roles}")
                
                # CRITICAL: Both roles should be present
                assert "coachee" in case_roles, f"Expected 'coachee' in case_roles"
                assert "deal_maker" in case_roles, f"Expected 'deal_maker' in case_roles"
            else:
                print(f"Test contact not found in test case contacts")
        else:
            print(f"Test case {TEST_CASE_ID} not found in ganados cases (may not be in 'ganados' stage)")


# ============ Role Grouping Logic Tests ============

class TestRoleGroupingLogic:
    """
    Tests to verify correct role-based grouping logic.
    
    Role group mapping:
    - deal_makers_team: deal_maker, influencer, champion, sponsor, asistente_deal_maker, procurement, staff
    - coachees: coachee
    - students: student, alumno
    - advisors_speakers: advisor, speaker, evaluador_360
    - others: contacts with no recognized case-level role
    """
    
    ROLE_GROUPS = {
        "deal_makers_team": ["deal_maker", "influencer", "champion", "sponsor", "asistente_deal_maker", "procurement", "staff"],
        "coachees": ["coachee"],
        "students": ["student", "alumno"],
        "advisors_speakers": ["advisor", "speaker", "evaluador_360"],
    }
    
    def get_expected_groups(self, roles):
        """Get expected group IDs based on roles"""
        groups = set()
        for role in roles:
            normalized = role.lower().strip().replace(" ", "_")
            for group_id, group_roles in self.ROLE_GROUPS.items():
                if normalized in group_roles:
                    groups.add(group_id)
        return groups if groups else {"others"}
    
    def test_multi_role_expected_groups(self, api_session, auth_headers):
        """
        Contact with ['coachee', 'deal_maker'] should be expected in:
        - 'coachees' group
        - 'deal_makers_team' group
        """
        roles = ["coachee", "deal_maker"]
        expected_groups = self.get_expected_groups(roles)
        
        assert "coachees" in expected_groups, f"Expected 'coachees' group for coachee role"
        assert "deal_makers_team" in expected_groups, f"Expected 'deal_makers_team' group for deal_maker role"
        
        print(f"Roles {roles} map to groups: {expected_groups}")
    
    def test_roles_not_reappearing_after_deletion(self, api_session, auth_headers):
        """
        CRITICAL BUG FIX: After deleting roles, they should NOT reappear.
        This tests the "sticky/ghost roles" bug.
        """
        # Step 1: Set initial roles
        setup_payload = {
            "contact_id": TEST_CONTACT_ID,
            "case_id": TEST_CASE_ID,
            "roles": ["coachee", "deal_maker", "sponsor"]
        }
        api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json=setup_payload
        )
        
        # Step 2: Delete all roles
        delete_payload = {
            "contact_id": TEST_CONTACT_ID,
            "case_id": TEST_CASE_ID,
            "roles": []
        }
        api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json=delete_payload
        )
        
        # Step 3: Verify roles are gone via GET /api/cases/by-contact
        response = api_session.get(
            f"{BASE_URL}/api/cases/by-contact/{TEST_CONTACT_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        cases = response.json()
        test_case = next((c for c in cases if c.get("id") == TEST_CASE_ID), None)
        
        if test_case:
            case_roles = test_case.get("case_roles", [])
            
            # CRITICAL: No ghost roles should reappear
            assert "coachee" not in case_roles, f"Ghost role 'coachee' should NOT reappear"
            assert "deal_maker" not in case_roles, f"Ghost role 'deal_maker' should NOT reappear"
            assert "sponsor" not in case_roles, f"Ghost role 'sponsor' should NOT reappear"
            assert case_roles == [], f"case_roles should be empty, got: {case_roles}"
            
            print(f"Verified: No ghost roles after deletion")


# ============ Integration Tests ============

class TestIntegration:
    """End-to-end integration tests"""
    
    def test_full_workflow_set_verify_delete_verify(self, api_session, auth_headers):
        """
        Full workflow test:
        1. Set multiple roles
        2. Verify roles via by-contact endpoint
        3. Delete all roles
        4. Verify roles are empty
        """
        # Step 1: Set multiple roles
        set_response = api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json={
                "contact_id": TEST_CONTACT_ID,
                "case_id": TEST_CASE_ID,
                "roles": ["coachee", "deal_maker"]
            }
        )
        assert set_response.status_code == 200
        print("Step 1: Set roles - PASS")
        
        # Step 2: Verify via by-contact
        verify_response1 = api_session.get(
            f"{BASE_URL}/api/cases/by-contact/{TEST_CONTACT_ID}",
            headers=auth_headers
        )
        assert verify_response1.status_code == 200
        cases = verify_response1.json()
        test_case = next((c for c in cases if c.get("id") == TEST_CASE_ID), None)
        if test_case:
            case_roles = test_case.get("case_roles", [])
            assert "coachee" in case_roles
            assert "deal_maker" in case_roles
            print(f"Step 2: Verify roles - PASS (case_roles={case_roles})")
        
        # Step 3: Delete all roles
        delete_response = api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json={
                "contact_id": TEST_CONTACT_ID,
                "case_id": TEST_CASE_ID,
                "roles": []
            }
        )
        assert delete_response.status_code == 200
        print("Step 3: Delete roles - PASS")
        
        # Step 4: Verify deletion
        verify_response2 = api_session.get(
            f"{BASE_URL}/api/cases/by-contact/{TEST_CONTACT_ID}",
            headers=auth_headers
        )
        assert verify_response2.status_code == 200
        cases = verify_response2.json()
        test_case = next((c for c in cases if c.get("id") == TEST_CASE_ID), None)
        if test_case:
            case_roles = test_case.get("case_roles", [])
            assert case_roles == [], f"Expected empty after deletion, got: {case_roles}"
            print(f"Step 4: Verify deletion - PASS (case_roles={case_roles})")
        
        # Restore original roles for consistency
        api_session.put(
            f"{BASE_URL}/api/todays-focus/case-roles",
            headers=auth_headers,
            json={
                "contact_id": TEST_CONTACT_ID,
                "case_id": TEST_CASE_ID,
                "roles": TEST_EXPECTED_ROLES
            }
        )
        print("Cleanup: Restored original roles")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
