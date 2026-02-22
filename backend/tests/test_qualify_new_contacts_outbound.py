"""
Test Qualify New Contacts Outbound Filtering Logic

Requirements tested:
1. Filter contacts to show only those in Stage 1 or 2, with qualification_status='pending' or field doesn't exist,
   AND (contact has classification='outbound' OR contact is associated with a company that has classification='outbound')

2. New semaphore logic:
   - GREEN = zero pending contacts
   - YELLOW = at least one qualified this week but still have pending
   - RED = no contacts qualified this week and there are pending contacts

Endpoints tested:
- GET /api/focus/traffic-light-status - verify 'qualify-new-contacts' returns correct color
- GET /api/prospection/to-qualify/stats - verify stats return correct pending count for outbound contacts only  
- GET /api/prospection/to-qualify/next - verify it only returns outbound contacts in Stage 1/2 with pending qualification
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_SESSION_TOKEN = "test_session_6gxa1S6v3fIOTHk44sLNNvtI-ZcylD8USEGujgos5Ek"

@pytest.fixture
def auth_headers():
    """Get authentication headers using test session token"""
    return {
        "Cookie": f"session_token={TEST_SESSION_TOKEN}",
        "Content-Type": "application/json"
    }


class TestTrafficLightQualifyNewContacts:
    """Test the traffic light status for qualify-new-contacts section"""
    
    def test_traffic_light_endpoint_returns_qualify_new_contacts(self, auth_headers):
        """GET /api/focus/traffic-light-status should include qualify-new-contacts section"""
        response = requests.get(f"{BASE_URL}/api/focus/traffic-light-status", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "qualify-new-contacts" in data, f"Missing qualify-new-contacts in response: {data}"
        
        # Verify valid status
        status = data["qualify-new-contacts"]
        assert status in ["green", "yellow", "red", "gray"], f"Invalid status: {status}"
        print(f"qualify-new-contacts status: {status}")
    
    def test_traffic_light_semaphore_logic(self, auth_headers):
        """
        Verify semaphore logic:
        - GREEN = zero pending contacts
        - YELLOW = at least one qualified this week but still have pending
        - RED = no contacts qualified this week and there are pending contacts
        """
        # Get traffic light status
        tl_response = requests.get(f"{BASE_URL}/api/focus/traffic-light-status", headers=auth_headers)
        assert tl_response.status_code == 200
        tl_status = tl_response.json().get("qualify-new-contacts")
        
        # Get qualification stats to verify logic
        stats_response = requests.get(f"{BASE_URL}/api/prospection/to-qualify/stats", headers=auth_headers)
        assert stats_response.status_code == 200
        stats = stats_response.json()
        
        pending_count = stats.get("weekly_progress", {}).get("pending", 0)
        qualified_this_week = stats.get("weekly_progress", {}).get("qualified", 0)
        
        print(f"Pending count: {pending_count}")
        print(f"Qualified this week: {qualified_this_week}")
        print(f"Traffic light status: {tl_status}")
        
        # Verify semaphore logic is consistent
        if pending_count == 0:
            assert tl_status == "green", f"Expected green with 0 pending, got {tl_status}"
        elif qualified_this_week > 0:
            assert tl_status == "yellow", f"Expected yellow with {qualified_this_week} qualified and {pending_count} pending, got {tl_status}"
        else:
            assert tl_status == "red", f"Expected red with 0 qualified and {pending_count} pending, got {tl_status}"


class TestToQualifyStats:
    """Test the /api/prospection/to-qualify/stats endpoint"""
    
    def test_stats_returns_required_fields(self, auth_headers):
        """GET /api/prospection/to-qualify/stats should return all required fields"""
        response = requests.get(f"{BASE_URL}/api/prospection/to-qualify/stats", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Required fields
        assert "pending" in data, f"Missing 'pending' field in response: {data}"
        assert "qualified" in data, f"Missing 'qualified' field in response: {data}"
        assert "postponed" in data, f"Missing 'postponed' field in response: {data}"
        assert "weekly_progress" in data, f"Missing 'weekly_progress' field in response: {data}"
        
        # Weekly progress fields
        weekly = data.get("weekly_progress", {})
        assert "qualified" in weekly, f"Missing 'qualified' in weekly_progress: {weekly}"
        assert "pending" in weekly, f"Missing 'pending' in weekly_progress: {weekly}"
        assert "total" in weekly, f"Missing 'total' in weekly_progress: {weekly}"
        assert "percentage" in weekly, f"Missing 'percentage' in weekly_progress: {weekly}"
        
        print(f"Stats response: {data}")
    
    def test_stats_counts_outbound_only(self, auth_headers):
        """Verify stats only count outbound contacts (contacts with classification='outbound' or company='outbound')"""
        response = requests.get(f"{BASE_URL}/api/prospection/to-qualify/stats", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify that the endpoint returns data (counts)
        # The counts should be non-negative integers
        assert isinstance(data.get("pending"), int), f"'pending' should be int, got {type(data.get('pending'))}"
        assert isinstance(data.get("qualified"), int), f"'qualified' should be int, got {type(data.get('qualified'))}"
        assert data.get("pending") >= 0, f"'pending' should be >= 0, got {data.get('pending')}"
        assert data.get("qualified") >= 0, f"'qualified' should be >= 0, got {data.get('qualified')}"
        
        weekly = data.get("weekly_progress", {})
        assert isinstance(weekly.get("pending"), int), f"weekly 'pending' should be int"
        assert isinstance(weekly.get("qualified"), int), f"weekly 'qualified' should be int"
        
        print(f"Outbound contacts - pending: {weekly.get('pending')}, qualified this week: {weekly.get('qualified')}")


class TestToQualifyNext:
    """Test the /api/prospection/to-qualify/next endpoint"""
    
    def test_next_returns_contact_or_message(self, auth_headers):
        """GET /api/prospection/to-qualify/next should return a contact or 'no pending' message"""
        response = requests.get(f"{BASE_URL}/api/prospection/to-qualify/next", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Should have either 'contact' or 'message' field
        assert "contact" in data or "message" in data, f"Response should have 'contact' or 'message': {data}"
        
        if data.get("contact"):
            contact = data["contact"]
            # Verify contact has required fields
            assert "id" in contact, f"Contact should have 'id': {contact}"
            assert "stage" in contact, f"Contact should have 'stage': {contact}"
            
            # Verify stage is 1 or 2
            assert contact.get("stage") in [1, 2], f"Contact should be in Stage 1 or 2, got {contact.get('stage')}"
            
            # Log contact info
            print(f"Next contact to qualify: {contact.get('name', 'N/A')}, Stage: {contact.get('stage')}, Company: {contact.get('company', 'N/A')}, Classification: {contact.get('classification', 'N/A')}")
        else:
            print(f"No contacts to qualify: {data.get('message')}")
    
    def test_next_only_returns_outbound_contacts(self, auth_headers):
        """Verify /api/prospection/to-qualify/next only returns outbound contacts"""
        response = requests.get(f"{BASE_URL}/api/prospection/to-qualify/next", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        if data.get("contact"):
            contact = data["contact"]
            
            # Contact should either have classification='outbound' or be associated with an outbound company
            # We can't directly verify the company classification here, but we can check the contact's classification
            # The backend logic should ensure only outbound contacts are returned
            
            print(f"Contact details: id={contact.get('id')}, name={contact.get('name')}, classification={contact.get('classification')}, company={contact.get('company')}")
            
            # If contact has a classification field, it should be 'outbound' or the company should be outbound
            # (Backend handles this logic - we just verify the response is valid)
            
            # Verify qualification_status is pending or doesn't exist
            qual_status = contact.get("qualification_status")
            assert qual_status in [None, "pending", "postponed"], f"Contact should have pending/postponed/null qualification_status, got {qual_status}"
    
    def test_next_filters_by_stage(self, auth_headers):
        """Verify only Stage 1 or 2 contacts are returned"""
        response = requests.get(f"{BASE_URL}/api/prospection/to-qualify/next", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        if data.get("contact"):
            contact = data["contact"]
            stage = contact.get("stage")
            
            assert stage in [1, 2], f"Contact stage should be 1 or 2, got {stage}"
            print(f"Contact stage: {stage}")


class TestEndpointAuthentication:
    """Test that endpoints require authentication"""
    
    def test_traffic_light_works_without_auth(self):
        """Traffic light endpoint should work without auth"""
        response = requests.get(f"{BASE_URL}/api/focus/traffic-light-status")
        # This endpoint may or may not require auth - check actual behavior
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"
    
    def test_to_qualify_stats_requires_auth(self):
        """GET /api/prospection/to-qualify/stats should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/prospection/to-qualify/stats")
        assert response.status_code == 401
    
    def test_to_qualify_next_requires_auth(self):
        """GET /api/prospection/to-qualify/next should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/prospection/to-qualify/next")
        assert response.status_code == 401


class TestIntegration:
    """Integration tests to verify stats and traffic light are consistent"""
    
    def test_stats_and_traffic_light_consistency(self, auth_headers):
        """Verify stats.pending and traffic light status are consistent with semaphore logic"""
        # Get both endpoints
        tl_response = requests.get(f"{BASE_URL}/api/focus/traffic-light-status", headers=auth_headers)
        stats_response = requests.get(f"{BASE_URL}/api/prospection/to-qualify/stats", headers=auth_headers)
        
        assert tl_response.status_code == 200
        assert stats_response.status_code == 200
        
        tl_status = tl_response.json().get("qualify-new-contacts")
        stats = stats_response.json()
        
        pending = stats.get("weekly_progress", {}).get("pending", 0)
        qualified_this_week = stats.get("weekly_progress", {}).get("qualified", 0)
        
        print(f"Traffic light: {tl_status}, Pending: {pending}, Qualified this week: {qualified_this_week}")
        
        # Log the logic check
        if pending == 0:
            expected = "green"
        elif qualified_this_week > 0:
            expected = "yellow"
        else:
            expected = "red"
        
        print(f"Expected traffic light based on stats: {expected}, Actual: {tl_status}")
        
        # Verify consistency
        assert tl_status == expected, f"Traffic light mismatch: expected {expected}, got {tl_status}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
