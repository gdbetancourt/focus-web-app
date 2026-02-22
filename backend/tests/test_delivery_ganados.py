"""
Test suite for Stage 4 "Ganados" Delivery Cases
Tests endpoints:
- GET /api/cases/delivery/ganados - Get cases in stage 'ganados' with contacts and checklist
- POST /api/cases/{case_id}/checklist/columns - Create checklist column/task for a group
- PATCH /api/cases/{case_id}/checklist/cell - Update checkbox (check/uncheck task)
- PATCH /api/cases/{case_id}/status - Change case status to 'concluidos'
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


class TestDeliveryGanados:
    """Tests for GET /api/cases/delivery/ganados"""
    
    def test_ganados_requires_authentication(self, api_session):
        """Should return 401 without authentication"""
        response = api_session.get(f"{BASE_URL}/api/cases/delivery/ganados")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
    
    def test_ganados_returns_cases_list(self, api_session, auth_headers):
        """Should return list of cases in 'ganados' stage with status 'active'"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "cases" in data, "Response should have 'cases' key"
        assert isinstance(data["cases"], list), "Cases should be a list"
    
    def test_ganados_cases_have_required_fields(self, api_session, auth_headers):
        """Each case should have required fields: id, name, stage, status, contacts, checklist"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        if len(cases) > 0:
            case = cases[0]
            # Required fields
            assert "id" in case, "Case should have 'id'"
            assert "name" in case, "Case should have 'name'"
            assert "stage" in case, "Case should have 'stage'"
            assert "status" in case, "Case should have 'status'"
            assert "contacts" in case, "Case should have 'contacts'"
            assert "checklist" in case, "Case should have 'checklist'"
            assert "weekly_status" in case, "Case should have 'weekly_status'"
            
            # Verify stage and status values
            assert case["stage"] == "ganados", f"Stage should be 'ganados', got {case['stage']}"
            assert case["status"] == "active", f"Status should be 'active', got {case['status']}"
    
    def test_ganados_cases_contacts_structure(self, api_session, auth_headers):
        """Contacts should have proper structure with id, name, email, roles"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        # Find a case with contacts
        case_with_contacts = None
        for case in cases:
            if case.get("contacts") and len(case.get("contacts", [])) > 0:
                case_with_contacts = case
                break
        
        if case_with_contacts:
            contact = case_with_contacts["contacts"][0]
            assert "id" in contact, "Contact should have 'id'"
            assert "name" in contact or "first_name" in contact, "Contact should have 'name' or 'first_name'"
            # roles is optional but should be a list if present
            if "roles" in contact:
                assert isinstance(contact["roles"], list), "Roles should be a list"
    
    def test_ganados_weekly_status_values(self, api_session, auth_headers):
        """weekly_status should be one of: green, yellow, red, gray"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        valid_statuses = ["green", "yellow", "red", "gray"]
        for case in cases:
            status = case.get("weekly_status")
            assert status in valid_statuses, f"weekly_status should be one of {valid_statuses}, got {status}"


class TestChecklistColumns:
    """Tests for POST /api/cases/{case_id}/checklist/columns"""
    
    @pytest.fixture
    def ganados_case(self, api_session, auth_headers):
        """Get a ganados case with contacts for testing"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        if response.status_code != 200:
            pytest.skip("Could not fetch ganados cases")
        
        cases = response.json().get("cases", [])
        # Find a case with contacts
        for case in cases:
            if case.get("contacts") and len(case.get("contacts", [])) > 0:
                return case
        
        if cases:
            return cases[0]
        pytest.skip("No ganados cases available for testing")
    
    def test_create_column_requires_authentication(self, api_session):
        """Should return 401 without authentication"""
        response = api_session.post(
            f"{BASE_URL}/api/cases/some-id/checklist/columns",
            json={
                "group_id": "deal_makers_team",
                "title": "Test Task",
                "due_date": datetime.now(timezone.utc).isoformat()
            }
        )
        assert response.status_code == 401
    
    def test_create_column_success(self, api_session, auth_headers, ganados_case):
        """Should create a new checklist column/task"""
        case_id = ganados_case["id"]
        due_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        
        response = api_session.post(
            f"{BASE_URL}/api/cases/{case_id}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": "deal_makers_team",
                "title": f"TEST_Task_{uuid.uuid4().hex[:8]}",
                "due_date": due_date
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "column_id" in data, "Response should have column_id"
    
    def test_create_column_validates_fields(self, api_session, auth_headers, ganados_case):
        """Should require group_id, title, and due_date"""
        case_id = ganados_case["id"]
        
        # Missing title
        response = api_session.post(
            f"{BASE_URL}/api/cases/{case_id}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": "deal_makers_team",
                "due_date": datetime.now(timezone.utc).isoformat()
            }
        )
        assert response.status_code == 422, "Should return 422 for missing title"
        
        # Missing group_id
        response = api_session.post(
            f"{BASE_URL}/api/cases/{case_id}/checklist/columns",
            headers=auth_headers,
            json={
                "title": "Test Task",
                "due_date": datetime.now(timezone.utc).isoformat()
            }
        )
        assert response.status_code == 422, "Should return 422 for missing group_id"
    
    def test_create_column_persists_in_checklist(self, api_session, auth_headers, ganados_case):
        """Created column should appear in case checklist when fetched"""
        case_id = ganados_case["id"]
        due_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        title = f"TEST_Persist_{uuid.uuid4().hex[:8]}"
        
        # Create column
        create_response = api_session.post(
            f"{BASE_URL}/api/cases/{case_id}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": "coachees",
                "title": title,
                "due_date": due_date
            }
        )
        assert create_response.status_code == 200
        column_id = create_response.json().get("column_id")
        
        # Fetch cases again and verify column exists
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        cases = response.json().get("cases", [])
        target_case = next((c for c in cases if c["id"] == case_id), None)
        assert target_case is not None, "Case should still exist"
        
        checklist = target_case.get("checklist", {})
        coachees_group = checklist.get("coachees", {})
        columns = coachees_group.get("columns", [])
        
        column_found = any(c.get("id") == column_id for c in columns)
        assert column_found, f"Created column {column_id} should be in checklist"


class TestChecklistCell:
    """Tests for PATCH /api/cases/{case_id}/checklist/cell"""
    
    @pytest.fixture
    def ganados_case_with_checklist(self, api_session, auth_headers):
        """Get or create a ganados case with checklist column for testing"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        if response.status_code != 200:
            pytest.skip("Could not fetch ganados cases")
        
        cases = response.json().get("cases", [])
        
        # Find a case with contacts and existing checklist
        for case in cases:
            contacts = case.get("contacts", [])
            checklist = case.get("checklist", {})
            
            if contacts and checklist:
                # Find a group with columns
                for group_id, group_data in checklist.items():
                    columns = group_data.get("columns", [])
                    if columns:
                        return {
                            "case": case,
                            "group_id": group_id,
                            "column_id": columns[0]["id"],
                            "contact_id": contacts[0]["id"]
                        }
        
        # If no existing checklist, create one
        for case in cases:
            contacts = case.get("contacts", [])
            if contacts:
                # Create a column first
                due_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
                create_response = api_session.post(
                    f"{BASE_URL}/api/cases/{case['id']}/checklist/columns",
                    headers=auth_headers,
                    json={
                        "group_id": "deal_makers_team",
                        "title": f"TEST_Cell_{uuid.uuid4().hex[:8]}",
                        "due_date": due_date
                    }
                )
                if create_response.status_code == 200:
                    return {
                        "case": case,
                        "group_id": "deal_makers_team",
                        "column_id": create_response.json().get("column_id"),
                        "contact_id": contacts[0]["id"]
                    }
        
        pytest.skip("No suitable case with contacts for cell testing")
    
    def test_update_cell_requires_authentication(self, api_session):
        """Should return 401 without authentication"""
        response = api_session.patch(
            f"{BASE_URL}/api/cases/some-id/checklist/cell",
            json={
                "group_id": "deal_makers_team",
                "contact_id": "some-contact",
                "column_id": "some-column",
                "checked": True
            }
        )
        assert response.status_code == 401
    
    def test_update_cell_check_success(self, api_session, auth_headers, ganados_case_with_checklist):
        """Should update cell to checked=True"""
        data = ganados_case_with_checklist
        case_id = data["case"]["id"]
        
        response = api_session.patch(
            f"{BASE_URL}/api/cases/{case_id}/checklist/cell",
            headers=auth_headers,
            json={
                "group_id": data["group_id"],
                "contact_id": data["contact_id"],
                "column_id": data["column_id"],
                "checked": True
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get("success") == True, "Response should have success=True"
    
    def test_update_cell_uncheck_success(self, api_session, auth_headers, ganados_case_with_checklist):
        """Should update cell to checked=False"""
        data = ganados_case_with_checklist
        case_id = data["case"]["id"]
        
        response = api_session.patch(
            f"{BASE_URL}/api/cases/{case_id}/checklist/cell",
            headers=auth_headers,
            json={
                "group_id": data["group_id"],
                "contact_id": data["contact_id"],
                "column_id": data["column_id"],
                "checked": False
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get("success") == True
    
    def test_update_cell_validates_required_fields(self, api_session, auth_headers, ganados_case_with_checklist):
        """Should require group_id, contact_id, column_id, checked"""
        data = ganados_case_with_checklist
        case_id = data["case"]["id"]
        
        # Missing checked
        response = api_session.patch(
            f"{BASE_URL}/api/cases/{case_id}/checklist/cell",
            headers=auth_headers,
            json={
                "group_id": data["group_id"],
                "contact_id": data["contact_id"],
                "column_id": data["column_id"]
            }
        )
        assert response.status_code == 422, "Should return 422 for missing 'checked'"
    
    def test_update_cell_nonexistent_checklist(self, api_session, auth_headers):
        """Should return 404 for non-existent case"""
        response = api_session.patch(
            f"{BASE_URL}/api/cases/nonexistent-case-id/checklist/cell",
            headers=auth_headers,
            json={
                "group_id": "deal_makers_team",
                "contact_id": "some-contact",
                "column_id": "some-column",
                "checked": True
            }
        )
        assert response.status_code == 404, f"Expected 404 for non-existent case, got {response.status_code}"


class TestCaseStatus:
    """Tests for PATCH /api/cases/{case_id}/status"""
    
    @pytest.fixture
    def ganados_case(self, api_session, auth_headers):
        """Get a ganados case for testing"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        if response.status_code != 200:
            pytest.skip("Could not fetch ganados cases")
        
        cases = response.json().get("cases", [])
        if not cases:
            pytest.skip("No ganados cases available")
        
        return cases[0]
    
    def test_update_status_requires_authentication(self, api_session):
        """Should return 401 without authentication"""
        response = api_session.patch(
            f"{BASE_URL}/api/cases/some-id/status",
            json={"status": "concluidos"}
        )
        assert response.status_code == 401
    
    def test_update_status_to_concluidos(self, api_session, auth_headers, ganados_case):
        """Should update case status to 'concluidos'"""
        case_id = ganados_case["id"]
        case_name = ganados_case.get("name", "Unknown")
        
        # Update status to concluidos
        response = api_session.patch(
            f"{BASE_URL}/api/cases/{case_id}/status",
            headers=auth_headers,
            json={"status": "concluidos"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get("success") == True, "Response should have success=True"
        assert "concluidos" in result.get("message", "").lower(), f"Message should mention concluidos"
        
        # Revert back to active for future tests
        revert_response = api_session.patch(
            f"{BASE_URL}/api/cases/{case_id}/status",
            headers=auth_headers,
            json={"status": "active"}
        )
        assert revert_response.status_code == 200, f"Failed to revert case {case_name} back to active"
    
    def test_update_status_validates_status_value(self, api_session, auth_headers, ganados_case):
        """Should reject invalid status values"""
        case_id = ganados_case["id"]
        
        response = api_session.patch(
            f"{BASE_URL}/api/cases/{case_id}/status",
            headers=auth_headers,
            json={"status": "invalid_status"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid status, got {response.status_code}"
    
    def test_update_status_nonexistent_case(self, api_session, auth_headers):
        """Should return 404 for non-existent case"""
        response = api_session.patch(
            f"{BASE_URL}/api/cases/nonexistent-case-id/status",
            headers=auth_headers,
            json={"status": "concluidos"}
        )
        assert response.status_code == 404


class TestGanadosCasesCount:
    """Test to verify ganados cases exist as expected"""
    
    def test_ganados_cases_exist(self, api_session, auth_headers):
        """Should have ganados cases (main agent mentioned 11 exist)"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        # Main agent mentioned 11 cases exist
        print(f"Found {len(cases)} ganados cases")
        assert len(cases) > 0, "Should have at least some ganados cases"


class TestChecklistIntegration:
    """Integration tests for the complete checklist flow"""
    
    def test_full_checklist_workflow(self, api_session, auth_headers):
        """Test full workflow: get cases -> create column -> check cell -> uncheck cell"""
        # Step 1: Get ganados cases
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        cases = response.json().get("cases", [])
        if not cases:
            pytest.skip("No ganados cases for integration test")
        
        # Find case with contacts
        target_case = None
        for case in cases:
            if case.get("contacts") and len(case.get("contacts", [])) > 0:
                target_case = case
                break
        
        if not target_case:
            pytest.skip("No case with contacts for integration test")
        
        case_id = target_case["id"]
        contact_id = target_case["contacts"][0]["id"]
        group_id = "students"  # Use students group for test
        
        # Step 2: Create a new column
        due_date = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
        title = f"TEST_Integration_{uuid.uuid4().hex[:8]}"
        
        create_response = api_session.post(
            f"{BASE_URL}/api/cases/{case_id}/checklist/columns",
            headers=auth_headers,
            json={
                "group_id": group_id,
                "title": title,
                "due_date": due_date
            }
        )
        assert create_response.status_code == 200, f"Failed to create column: {create_response.text}"
        column_id = create_response.json().get("column_id")
        assert column_id, "Column ID should be returned"
        
        # Step 3: Check the cell
        check_response = api_session.patch(
            f"{BASE_URL}/api/cases/{case_id}/checklist/cell",
            headers=auth_headers,
            json={
                "group_id": group_id,
                "contact_id": contact_id,
                "column_id": column_id,
                "checked": True
            }
        )
        assert check_response.status_code == 200, f"Failed to check cell: {check_response.text}"
        
        # Step 4: Verify cell is checked by fetching cases
        verify_response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert verify_response.status_code == 200
        
        # Find our case and verify cell state
        cases_after = verify_response.json().get("cases", [])
        our_case = next((c for c in cases_after if c["id"] == case_id), None)
        assert our_case, "Case should still exist"
        
        checklist = our_case.get("checklist", {})
        group_data = checklist.get(group_id, {})
        cells = group_data.get("cells", {})
        contact_cells = cells.get(contact_id, {})
        cell = contact_cells.get(column_id, {})
        
        assert cell.get("checked") == True, "Cell should be checked after update"
        
        # Step 5: Uncheck the cell
        uncheck_response = api_session.patch(
            f"{BASE_URL}/api/cases/{case_id}/checklist/cell",
            headers=auth_headers,
            json={
                "group_id": group_id,
                "contact_id": contact_id,
                "column_id": column_id,
                "checked": False
            }
        )
        assert uncheck_response.status_code == 200, f"Failed to uncheck cell: {uncheck_response.text}"
        
        print("Full checklist workflow completed successfully!")
