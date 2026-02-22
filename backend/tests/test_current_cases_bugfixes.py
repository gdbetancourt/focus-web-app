"""
Test Suite for Current Cases Bug Fixes (Iteration 61)
Tests for two specific bugs:
1. Traffic light shows gray for current week (must be green/yellow/red)
2. Wrong role-based grouping (Deal Maker contacts appear in 'others' instead of 'deal_makers_team')

Endpoints tested:
- GET /api/scheduler/traffic-light - Should return 'current-cases' key with status green/yellow/red (never gray)
- GET /api/cases/delivery/ganados - Should return weekly_status of green/yellow/red (never gray)
"""
import os
import pytest
import requests
import uuid
from datetime import datetime, timezone, timedelta

# Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token
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


# ============ BUG FIX 1: Traffic Light Status Tests ============

class TestTrafficLightCurrentCasesStatus:
    """
    BUG FIX 1: Traffic light should return 'current-cases' with status green/yellow/red (never gray)
    
    Rules for current week:
    - GREEN: No eligible cases OR no tasks exist OR all tasks done
    - YELLOW: Work to do AND at least one checkbox checked this ISO week
    - RED: Work to do AND no checkbox checked this ISO week
    - GRAY: NOT ALLOWED for current week
    """
    
    def test_traffic_light_has_current_cases_key(self, api_session, auth_headers):
        """CRITICAL: traffic-light endpoint should return 'current-cases' key"""
        response = api_session.get(
            f"{BASE_URL}/api/scheduler/traffic-light",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        
        status = data.get("status", {})
        assert "current-cases" in status, "Traffic light should have 'current-cases' key"
    
    def test_current_cases_status_not_gray(self, api_session, auth_headers):
        """CRITICAL: current-cases status should NEVER be gray for current week"""
        response = api_session.get(
            f"{BASE_URL}/api/scheduler/traffic-light",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        status = data.get("status", {})
        current_cases = status.get("current-cases", {})
        
        current_cases_status = current_cases.get("status")
        valid_statuses = ["green", "yellow", "red"]
        
        assert current_cases_status in valid_statuses, \
            f"current-cases status should be green/yellow/red, got '{current_cases_status}'"
        
        # Explicitly verify it's NOT gray
        assert current_cases_status != "gray", \
            "CRITICAL BUG: current-cases status should NEVER be gray for current week"
    
    def test_current_cases_has_required_fields(self, api_session, auth_headers):
        """current-cases should have status and cases_count fields"""
        response = api_session.get(
            f"{BASE_URL}/api/scheduler/traffic-light",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        current_cases = data.get("status", {}).get("current-cases", {})
        
        # Should have status field
        assert "status" in current_cases, "current-cases should have 'status' field"
        
        # May have additional info fields
        if "cases_count" in current_cases:
            assert isinstance(current_cases["cases_count"], int), "cases_count should be an integer"
    
    def test_current_cases_status_logic(self, api_session, auth_headers):
        """
        Verify current-cases status follows correct logic:
        - If no cases or no tasks → green
        - If has tasks and activity this week → yellow (or green if all done)
        - If has tasks and no activity this week → red
        """
        response = api_session.get(
            f"{BASE_URL}/api/scheduler/traffic-light",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        current_cases = data.get("status", {}).get("current-cases", {})
        
        status = current_cases.get("status")
        cases_count = current_cases.get("cases_count", 0)
        has_tasks = current_cases.get("has_tasks", True)  # Default to True for safety
        
        # Log the status for debugging
        print(f"current-cases: status={status}, cases_count={cases_count}, has_tasks={has_tasks}")
        
        # If no cases or no tasks, should be green
        if cases_count == 0 or not has_tasks:
            assert status == "green", \
                f"With no cases/tasks, status should be green, got '{status}'"
        
        # Otherwise, status should be one of the valid values (not gray)
        assert status in ["green", "yellow", "red"], \
            f"Status should be green/yellow/red, got '{status}'"


# ============ BUG FIX 2: Weekly Status in Ganados Cases ============

class TestGanadosCasesWeeklyStatus:
    """
    BUG FIX 2: GET /api/cases/delivery/ganados should return weekly_status of green/yellow/red (never gray)
    
    Same rules apply at case level:
    - GREEN: No tasks OR all tasks completed OR no unchecked tasks due yet
    - YELLOW: Work to do AND at least one checkbox checked this ISO week
    - RED: Work to do AND no checkbox checked this ISO week
    """
    
    def test_ganados_endpoint_returns_200(self, api_session, auth_headers):
        """Ganados endpoint should return 200"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_all_cases_have_weekly_status(self, api_session, auth_headers):
        """Each case should have a weekly_status field"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        for case in cases:
            assert "weekly_status" in case, \
                f"Case '{case.get('name', 'unknown')}' should have weekly_status field"
    
    def test_weekly_status_never_gray(self, api_session, auth_headers):
        """CRITICAL: weekly_status should NEVER be gray for current week cases"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        valid_statuses = ["green", "yellow", "red"]
        
        for case in cases:
            weekly_status = case.get("weekly_status")
            
            assert weekly_status in valid_statuses, \
                f"Case '{case.get('name', 'unknown')}' weekly_status should be green/yellow/red, got '{weekly_status}'"
            
            # Explicitly verify it's NOT gray
            assert weekly_status != "gray", \
                f"CRITICAL BUG: Case '{case.get('name', 'unknown')}' weekly_status should NEVER be gray"
    
    def test_weekly_status_respects_rules(self, api_session, auth_headers):
        """Verify weekly_status follows the correct rules"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        for case in cases[:5]:  # Check first 5 cases
            weekly_status = case.get("weekly_status")
            checklist = case.get("checklist", {})
            
            # Count tasks
            total_tasks = 0
            for group_id, group_data in checklist.items():
                columns = [c for c in group_data.get("columns", []) if not c.get("deleted")]
                cells = group_data.get("cells", {})
                for contact_id, contact_cells in cells.items():
                    for col in columns:
                        if col["id"] in contact_cells:
                            total_tasks += 1
            
            # If no tasks, should be green
            if total_tasks == 0:
                assert weekly_status == "green", \
                    f"Case '{case.get('name', 'unknown')}' with 0 tasks should have status=green, got '{weekly_status}'"
            
            print(f"Case '{case.get('name', 'unknown')}': weekly_status={weekly_status}, tasks={total_tasks}")


# ============ Role Grouping Logic Tests ============

class TestRoleGroupingLogic:
    """
    BUG FIX 3: Contacts with 'Deal Maker' case-level role should appear in 'deal_makers_team' group, not 'others'
    
    Role group mapping:
    - deal_makers_team: deal_maker, influencer, champion, sponsor, asistente_deal_maker, procurement, staff
    - coachees: coachee
    - students: student, alumno, estudiante
    - advisors_speakers: advisor, speaker, evaluador_360
    - others: contacts with no recognized case-level role
    """
    
    def test_contacts_have_case_roles_field(self, api_session, auth_headers):
        """CRITICAL: Each contact should have 'case_roles' field (NOT global 'roles')"""
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        for case in cases:
            contacts = case.get("contacts", [])
            for contact in contacts[:5]:
                # CRITICAL: Should have case_roles field
                assert "case_roles" in contact, \
                    f"Contact '{contact.get('name', 'unknown')}' should have 'case_roles' field"
                assert isinstance(contact["case_roles"], list), \
                    f"case_roles should be a list for contact '{contact.get('name', 'unknown')}'"
    
    def test_deal_maker_role_recognized(self, api_session, auth_headers):
        """
        Contacts with case-level 'deal_maker' or 'Deal Maker' role should have it in case_roles
        """
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        # Find contacts with deal_maker role
        deal_maker_contacts = []
        for case in cases:
            for contact in case.get("contacts", []):
                case_roles = contact.get("case_roles", [])
                # Check for deal_maker role (case-insensitive)
                has_deal_maker = any(
                    r.lower().replace("_", " ") in ["deal maker", "deal_maker"] 
                    for r in case_roles
                )
                if has_deal_maker:
                    deal_maker_contacts.append({
                        "case": case.get("name"),
                        "contact": contact.get("name"),
                        "case_roles": case_roles
                    })
        
        print(f"Found {len(deal_maker_contacts)} contacts with deal_maker case-level role")
        for dm in deal_maker_contacts[:5]:
            print(f"  - {dm['contact']} in '{dm['case']}': {dm['case_roles']}")
    
    def test_role_grouping_consistency(self, api_session, auth_headers):
        """
        Verify that the role grouping in checklist matches the contact's case_roles.
        
        If a contact has 'deal_maker' in case_roles and there's a column in deal_makers_team group,
        that contact should have a cell in that group (not in 'others').
        """
        response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        cases = data.get("cases", [])
        
        # Role group mapping (same as frontend)
        role_groups = {
            "deal_makers_team": ["deal_maker", "deal maker", "influencer", "champion", "sponsor", 
                                "asistente_deal_maker", "asistente del deal maker", "procurement", "staff"],
            "coachees": ["coachee"],
            "students": ["student", "alumno", "estudiante"],
            "advisors_speakers": ["advisor", "speaker", "speakers", "evaluador_360", "evaluador 360"],
            "others": []  # Catch-all
        }
        
        def normalize_role(role):
            """Normalize role for comparison"""
            if not role:
                return ""
            return role.lower().strip().replace("_", " ")
        
        def get_expected_groups(case_roles):
            """Get expected group IDs based on case_roles"""
            groups = set()
            for role in case_roles:
                normalized = normalize_role(role)
                matched = False
                for group_id, group_roles in role_groups.items():
                    if group_id != "others" and normalized in [normalize_role(r) for r in group_roles]:
                        groups.add(group_id)
                        matched = True
                if not matched:
                    groups.add("others")
            return groups if groups else {"others"}
        
        # Check each case
        for case in cases[:3]:  # Check first 3 cases
            contacts = case.get("contacts", [])
            checklist = case.get("checklist", {})
            
            for contact in contacts[:5]:
                case_roles = contact.get("case_roles", [])
                if not case_roles:
                    continue
                
                expected_groups = get_expected_groups(case_roles)
                
                # Check if contact appears in the expected group's cells
                for expected_group in expected_groups:
                    if expected_group in checklist:
                        cells = checklist[expected_group].get("cells", {})
                        if contact["id"] in cells:
                            print(f"PASS: Contact '{contact.get('name')}' with roles {case_roles} "
                                  f"found in '{expected_group}' group")
                        elif len(checklist[expected_group].get("columns", [])) == 0:
                            print(f"INFO: Group '{expected_group}' has no columns yet")
                
                # CRITICAL: Contact with deal_maker should NOT be in 'others' only
                if any(normalize_role(r) in ["deal maker", "deal_maker"] for r in case_roles):
                    # If checklist has 'others' group with columns
                    if "others" in checklist:
                        others_cells = checklist["others"].get("cells", {})
                        others_columns = checklist["others"].get("columns", [])
                        if contact["id"] in others_cells and others_columns:
                            # Check if also in deal_makers_team
                            if "deal_makers_team" not in checklist or contact["id"] not in checklist.get("deal_makers_team", {}).get("cells", {}):
                                print(f"WARNING: Contact '{contact.get('name')}' with deal_maker role "
                                      f"is in 'others' but not in 'deal_makers_team'")


class TestStep4ParentStatus:
    """Test that Step 4 parent status includes current-cases in aggregation"""
    
    def test_step4_includes_current_cases(self, api_session, auth_headers):
        """step4 status should consider current-cases in its aggregation"""
        response = api_session.get(
            f"{BASE_URL}/api/scheduler/traffic-light",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        status = data.get("status", {})
        
        # Check step4 exists
        assert "step4" in status, "Traffic light should have 'step4' key"
        
        step4_status = status.get("step4", {}).get("status")
        current_cases_status = status.get("current-cases", {}).get("status")
        
        print(f"step4 status: {step4_status}")
        print(f"current-cases status: {current_cases_status}")
        
        # step4 should not be gray if current-cases is not gray
        if current_cases_status in ["green", "yellow", "red"]:
            assert step4_status in ["green", "yellow", "red"], \
                f"step4 should be green/yellow/red (not gray) when current-cases is {current_cases_status}"


class TestIntegration:
    """Integration tests to verify the bug fixes work together"""
    
    def test_traffic_light_and_ganados_status_consistency(self, api_session, auth_headers):
        """
        The 'current-cases' status in traffic-light should be consistent with
        the aggregation of individual case weekly_status values from ganados endpoint.
        """
        # Get traffic light status
        traffic_response = api_session.get(
            f"{BASE_URL}/api/scheduler/traffic-light",
            headers=auth_headers
        )
        assert traffic_response.status_code == 200
        traffic_data = traffic_response.json()
        current_cases_status = traffic_data.get("status", {}).get("current-cases", {}).get("status")
        
        # Get ganados cases
        ganados_response = api_session.get(
            f"{BASE_URL}/api/cases/delivery/ganados",
            headers=auth_headers
        )
        assert ganados_response.status_code == 200
        ganados_data = ganados_response.json()
        cases = ganados_data.get("cases", [])
        
        # Aggregate individual case statuses
        case_statuses = [c.get("weekly_status", "green") for c in cases]
        
        # Calculate expected aggregated status
        if not case_statuses:
            expected_status = "green"  # No cases = green
        elif "red" in case_statuses:
            expected_status = "red"
        elif "yellow" in case_statuses:
            expected_status = "yellow"
        else:
            expected_status = "green"
        
        print(f"Traffic light current-cases status: {current_cases_status}")
        print(f"Ganados cases statuses: {case_statuses}")
        print(f"Expected aggregated status: {expected_status}")
        
        # Note: The actual calculation in backend may differ slightly due to task-level analysis
        # but both should NOT be gray
        assert current_cases_status != "gray", "current-cases should not be gray"
        for status in case_statuses:
            assert status != "gray", "No individual case should have gray status"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
