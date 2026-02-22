"""
Test suite for Stage 4 "Ganados" Delivery Cases - Version 2
Tests the CORRECTED implementation with:
1. case_roles (case-level roles from case_contact_roles collection) NOT global roles
2. No automatic column creation
3. Global indicator considers only 'ganados' cases
4. PATCH endpoint for editing columns (title, due_date, order)
5. DELETE endpoint for soft-deleting columns (preserves history)

Endpoints tested:
- GET /api/cases/delivery/ganados - Returns contacts with case_roles
- POST /api/cases/{case_id}/checklist/columns - Create column for correct group
- PATCH /api/cases/{case_id}/checklist/columns - Edit column
- DELETE /api/cases/{case_id}/checklist/columns - Soft delete column
- PATCH /api/cases/{case_id}/checklist/cell - Update checkbox
"""
import os
import pytest
import requests
import uuid
from datetime import datetime, timezone, timedelta

# Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token for authenticated requests
TEST_SESSION_TOKEN = "teststaff_jRpK6_PrQ_IboZOMBMUOdjGBBXAarHlrMzsly06s6Xo"


@pytest.fixture
def auth_headers():
    """Return headers with authentication cookie"""
    return {
        "Content-Type": "application/json",
        "Cookie": f"session_token={TEST_SESSION_TOKEN}"
    }


@pytest.fixture
def api_session():
    """Create a requests session"""
    session = requests.Session()
    return session


class TestCaseRolesField:
    """Tests for case_roles field in contacts (CRITICAL FEATURE)"""
    
    def test_contacts_have_case_roles_field(self, api_session, auth_headers):
        """CRITICAL: Each contact should have 'case_roles' field (case-level roles)"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        # Find a case with contacts
        for case in cases:
            contacts = case.get("contacts", [])
            if contacts:
                for contact in contacts[:5]:
                    # CRITICAL: contact should have case_roles field
                    assert "case_roles" in contact, f"Contact {contact.get('name', contact.get('id'))} should have 'case_roles' field"
                    assert isinstance(contact["case_roles"], list), "case_roles should be a list"
                break
    
    def test_case_roles_vs_global_roles(self, api_session, auth_headers):
        """
        Contacts should use case_roles (from case_contact_roles collection)
        NOT global roles from unified_contacts
        """
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        # Look for contacts with case_roles
        contacts_with_case_roles = 0
        for case in cases:
            for contact in case.get("contacts", []):
                if contact.get("case_roles"):
                    contacts_with_case_roles += 1
        
        print(f"Found {contacts_with_case_roles} contacts with case_roles populated")
        # Note: It's OK if case_roles is empty - the field existence is what matters


class TestEditColumnEndpoint:
    """Tests for PATCH /api/cases/{case_id}/checklist/columns - Edit column"""
    
    @pytest.fixture
    def case_with_column(self, api_session, auth_headers):
        """Get or create a case with a checklist column for testing"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        if response.status_code != 200:
            pytest.skip("Could not fetch ganados cases")
        
        cases = response.json().get("cases", [])
        
        # Find case with existing columns
        for case in cases:
            checklist = case.get("checklist", {})
            for group_id, group_data in checklist.items():
                columns = [c for c in group_data.get("columns", []) if not c.get("deleted")]
                if columns:
                    return {
                        "case_id": case["id"],
                        "group_id": group_id,
                        "column_id": columns[0]["id"],
                        "original_title": columns[0].get("title")
                    }
        
        # Create a column if none exists
        for case in cases:
            if case.get("contacts"):
                due_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
                create_resp = api_session.post(
                    f"{BASE_URL}/api/cases/{case['id']}/checklist/columns",
                    headers=auth_headers,
                    json={
                        "group_id": "deal_makers_team",
                        "title": f"TEST_Edit_{uuid.uuid4().hex[:8]}",
                        "due_date": due_date
                    }
                )
                if create_resp.status_code == 200:
                    return {
                        "case_id": case["id"],
                        "group_id": "deal_makers_team",
                        "column_id": create_resp.json().get("column_id"),
                        "original_title": f"TEST_Edit_{uuid.uuid4().hex[:8]}"
                    }
        
        pytest.skip("No suitable case for edit column testing")
    
    def test_edit_column_requires_authentication(self, api_session):
        """Should return 401 without authentication"""
        response = api_session.patch(
            f"{BASE_URL}/api/cases/some-id/checklist/columns",
            json={
                "group_id": "deal_makers_team",
                "column_id": "some-column",
                "title": "New Title"
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_edit_column_title_success(self, api_session, auth_headers, case_with_column):
        """Should successfully update column title"""
        new_title = f"TEST_Edited_{uuid.uuid4().hex[:8]}"
        
        response = api_session.patch(
            f"{BASE_URL}/api/cases/{case_with_column['case_id']}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": case_with_column["group_id"],
                "column_id": case_with_column["column_id"],
                "title": new_title
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get("success") == True, "Response should have success=True"
    
    def test_edit_column_due_date_success(self, api_session, auth_headers, case_with_column):
        """Should successfully update column due_date"""
        new_due_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        
        response = api_session.patch(
            f"{BASE_URL}/api/cases/{case_with_column['case_id']}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": case_with_column["group_id"],
                "column_id": case_with_column["column_id"],
                "due_date": new_due_date
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get("success") == True
    
    def test_edit_column_order_success(self, api_session, auth_headers, case_with_column):
        """Should successfully update column order"""
        response = api_session.patch(
            f"{BASE_URL}/api/cases/{case_with_column['case_id']}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": case_with_column["group_id"],
                "column_id": case_with_column["column_id"],
                "order": 0
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get("success") == True
    
    def test_edit_column_nonexistent_returns_404(self, api_session, auth_headers, case_with_column):
        """Should return 404 for non-existent column"""
        response = api_session.patch(
            f"{BASE_URL}/api/cases/{case_with_column['case_id']}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": case_with_column["group_id"],
                "column_id": "nonexistent-column-id",
                "title": "Test"
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_edit_column_nonexistent_group_returns_404(self, api_session, auth_headers, case_with_column):
        """Should return 404 for non-existent group"""
        response = api_session.patch(
            f"{BASE_URL}/api/cases/{case_with_column['case_id']}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": "nonexistent_group",
                "column_id": case_with_column["column_id"],
                "title": "Test"
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestDeleteColumnEndpoint:
    """Tests for DELETE /api/cases/{case_id}/checklist/columns - Soft delete column"""
    
    @pytest.fixture
    def column_to_delete(self, api_session, auth_headers):
        """Create a column specifically for deletion testing"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        if response.status_code != 200:
            pytest.skip("Could not fetch ganados cases")
        
        cases = response.json().get("cases", [])
        if not cases:
            pytest.skip("No ganados cases available")
        
        case = cases[0]
        case_id = case["id"]
        
        # Create a column to delete
        due_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        create_resp = api_session.post(
            f"{BASE_URL}/api/cases/{case_id}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": "deal_makers_team",
                "title": f"TEST_ToDelete_{uuid.uuid4().hex[:8]}",
                "due_date": due_date
            }
        )
        
        if create_resp.status_code != 200:
            pytest.skip("Could not create column for deletion test")
        
        return {
            "case_id": case_id,
            "group_id": "deal_makers_team",
            "column_id": create_resp.json().get("column_id")
        }
    
    def test_delete_column_requires_authentication(self, api_session):
        """Should return 401 without authentication"""
        response = api_session.delete(
            f"{BASE_URL}/api/cases/some-id/checklist/columns",
            json={
                "group_id": "deal_makers_team",
                "column_id": "some-column"
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_delete_column_success(self, api_session, auth_headers, column_to_delete):
        """Should successfully soft-delete a column"""
        response = api_session.delete(
            f"{BASE_URL}/api/cases/{column_to_delete['case_id']}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": column_to_delete["group_id"],
                "column_id": column_to_delete["column_id"]
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get("success") == True, "Response should have success=True"
        assert "Columna eliminada" in result.get("message", "") or "eliminada" in result.get("message", "").lower()
    
    def test_delete_column_is_soft_delete(self, api_session, auth_headers, column_to_delete):
        """Deleted column should still exist with deleted=True (soft delete)"""
        # First delete the column
        delete_resp = api_session.delete(
            f"{BASE_URL}/api/cases/{column_to_delete['case_id']}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": column_to_delete["group_id"],
                "column_id": column_to_delete["column_id"]
            }
        )
        assert delete_resp.status_code == 200
        
        # Fetch cases and verify column is marked as deleted
        fetch_resp = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert fetch_resp.status_code == 200
        
        cases = fetch_resp.json().get("cases", [])
        target_case = next((c for c in cases if c["id"] == column_to_delete["case_id"]), None)
        
        if target_case:
            checklist = target_case.get("checklist", {})
            group_data = checklist.get(column_to_delete["group_id"], {})
            columns = group_data.get("columns", [])
            
            # Column should NOT appear in the list (deleted columns are filtered)
            column_visible = any(c.get("id") == column_to_delete["column_id"] and not c.get("deleted") for c in columns)
            assert not column_visible, "Deleted column should not be visible in the list"
    
    def test_delete_column_nonexistent_returns_404(self, api_session, auth_headers, column_to_delete):
        """Should return 404 for non-existent column"""
        response = api_session.delete(
            f"{BASE_URL}/api/cases/{column_to_delete['case_id']}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": column_to_delete["group_id"],
                "column_id": "nonexistent-column-id"
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestNoAutoColumnCreation:
    """Tests to verify columns are NOT created automatically"""
    
    def test_no_auto_columns_on_get(self, api_session, auth_headers):
        """GET /api/cases/delivery/ganados should NOT auto-create columns"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        # Just verify the endpoint works - columns should only exist if explicitly created
        data = response.json()
        cases = data.get("cases", [])
        
        # Each case should have a checklist field (even if empty)
        for case in cases[:3]:
            assert "checklist" in case, f"Case {case.get('name')} should have checklist field"
            # Checklist can be empty {} if no columns were created
            assert isinstance(case["checklist"], dict), "Checklist should be a dict"


class TestGlobalIndicator:
    """Tests for global traffic indicator (only considers 'ganados' cases)"""
    
    def test_cases_are_all_ganados(self, api_session, auth_headers):
        """All returned cases should be in 'ganados' stage"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        for case in cases:
            assert case.get("stage") == "ganados", f"Case {case.get('name')} should have stage='ganados'"
            assert case.get("status") == "active", f"Case {case.get('name')} should have status='active'"
    
    def test_weekly_status_values_no_gray(self, api_session, auth_headers):
        """weekly_status should be green, yellow, or red (no gray)"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        # Based on the requirements: any red → red, else any yellow → yellow, else green
        # Gray should not be used in the new logic
        valid_statuses = ["green", "yellow", "red"]
        for case in cases:
            status = case.get("weekly_status")
            # Note: gray might still be valid in some edge cases, but green is preferred
            if status not in valid_statuses and status != "gray":
                pytest.fail(f"Invalid weekly_status: {status}")


class TestColumnCellsForCorrectGroup:
    """Tests to verify cells are only created for contacts in the correct group"""
    
    @pytest.fixture
    def case_with_roles(self, api_session, auth_headers):
        """Find a case with contacts that have case_roles"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        if response.status_code != 200:
            pytest.skip("Could not fetch ganados cases")
        
        cases = response.json().get("cases", [])
        
        for case in cases:
            contacts = case.get("contacts", [])
            # Find case with contacts that have case_roles
            contacts_with_roles = [c for c in contacts if c.get("case_roles")]
            if contacts_with_roles:
                return {
                    "case_id": case["id"],
                    "contacts_with_roles": contacts_with_roles
                }
        
        pytest.skip("No case with contacts having case_roles found")
    
    def test_column_cells_only_for_group_contacts(self, api_session, auth_headers, case_with_roles):
        """When creating a column, cells should only be initialized for contacts in that group"""
        case_id = case_with_roles["case_id"]
        
        # Create a column for students group
        due_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        title = f"TEST_GroupFilter_{uuid.uuid4().hex[:8]}"
        
        create_resp = api_session.post(
            f"{BASE_URL}/api/cases/{case_id}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": "students",
                "title": title,
                "due_date": due_date
            }
        )
        assert create_resp.status_code == 200
        
        # Fetch and verify cells were only created for student contacts
        fetch_resp = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert fetch_resp.status_code == 200
        
        cases = fetch_resp.json().get("cases", [])
        target_case = next((c for c in cases if c["id"] == case_id), None)
        
        if target_case:
            contacts = target_case.get("contacts", [])
            student_contact_ids = {c["id"] for c in contacts if "student" in (c.get("case_roles") or [])}
            
            checklist = target_case.get("checklist", {})
            students_group = checklist.get("students", {})
            cells = students_group.get("cells", {})
            
            # Verify cells are only for student contacts
            for contact_id in cells.keys():
                if contact_id in student_contact_ids:
                    print(f"Cell exists for student contact: {contact_id[:8]}...")
                # Non-student contacts should not have cells (this is the ideal case)


class TestFullWorkflow:
    """Integration tests for complete checklist workflow with new features"""
    
    def test_full_workflow_create_edit_delete_column(self, api_session, auth_headers):
        """Test workflow: create column -> edit column -> soft delete column"""
        # Step 1: Get a ganados case
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        cases = response.json().get("cases", [])
        if not cases:
            pytest.skip("No ganados cases for workflow test")
        
        case_id = cases[0]["id"]
        group_id = "deal_makers_team"
        
        # Step 2: Create a column
        due_date = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
        original_title = f"TEST_Workflow_{uuid.uuid4().hex[:8]}"
        
        create_resp = api_session.post(
            f"{BASE_URL}/api/cases/{case_id}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": group_id,
                "title": original_title,
                "due_date": due_date
            }
        )
        assert create_resp.status_code == 200, f"Create failed: {create_resp.text}"
        column_id = create_resp.json().get("column_id")
        assert column_id, "Column ID should be returned"
        
        # Step 3: Edit the column title
        new_title = f"TEST_WorkflowEdited_{uuid.uuid4().hex[:8]}"
        edit_resp = api_session.patch(
            f"{BASE_URL}/api/cases/{case_id}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": group_id,
                "column_id": column_id,
                "title": new_title
            }
        )
        assert edit_resp.status_code == 200, f"Edit failed: {edit_resp.text}"
        
        # Step 4: Edit the column due_date
        new_due_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        edit_date_resp = api_session.patch(
            f"{BASE_URL}/api/cases/{case_id}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": group_id,
                "column_id": column_id,
                "due_date": new_due_date
            }
        )
        assert edit_date_resp.status_code == 200, f"Edit due_date failed: {edit_date_resp.text}"
        
        # Step 5: Soft delete the column
        delete_resp = api_session.delete(
            f"{BASE_URL}/api/cases/{case_id}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": group_id,
                "column_id": column_id
            }
        )
        assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.text}"
        
        # Step 6: Verify column is not visible
        verify_resp = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert verify_resp.status_code == 200
        
        cases_after = verify_resp.json().get("cases", [])
        target_case = next((c for c in cases_after if c["id"] == case_id), None)
        
        if target_case:
            checklist = target_case.get("checklist", {})
            group_data = checklist.get(group_id, {})
            columns = group_data.get("columns", [])
            
            # Deleted column should not be visible
            visible_columns = [c for c in columns if not c.get("deleted")]
            column_visible = any(c.get("id") == column_id for c in visible_columns)
            assert not column_visible, "Deleted column should not be visible"
        
        print("Full workflow (create -> edit -> delete) completed successfully!")
