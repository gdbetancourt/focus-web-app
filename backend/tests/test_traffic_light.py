"""
Traffic Light System Tests
Tests the hierarchical traffic light status endpoint for all navigation sections
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTrafficLightEndpoint:
    """Test the /api/scheduler/traffic-light endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication for all tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_traffic_light_endpoint_returns_200(self):
        """Test that traffic light endpoint returns 200"""
        response = self.session.get(f"{BASE_URL}/api/scheduler/traffic-light")
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "status" in data
        assert "timestamp" in data
        assert "week_key" in data
    
    def test_traffic_light_has_all_step_sections(self):
        """Test that all step sections (step1-5) have traffic light status"""
        response = self.session.get(f"{BASE_URL}/api/scheduler/traffic-light")
        data = response.json()
        status = data.get("status", {})
        
        # Verify all step sections exist
        for step in ["step1", "step2", "step3", "step4", "step5"]:
            assert step in status, f"Missing {step} in traffic light status"
            assert "status" in status[step], f"Missing status field in {step}"
            assert status[step]["status"] in ["green", "yellow", "red", "gray"], f"Invalid status for {step}"
    
    def test_traffic_light_has_foundations_section(self):
        """Test that foundations section has traffic light status"""
        response = self.session.get(f"{BASE_URL}/api/scheduler/traffic-light")
        data = response.json()
        status = data.get("status", {})
        
        # Verify foundations parent
        assert "foundations" in status, "Missing foundations in traffic light status"
        
        # Verify foundations subsections
        foundations_subsections = [
            "foundations-who-bp",
            "foundations-who-companies",
            "foundations-what",
            "foundations-how",
            "foundations-howmuch"
        ]
        for subsection in foundations_subsections:
            assert subsection in status, f"Missing {subsection} in traffic light status"
            assert "status" in status[subsection], f"Missing status field in {subsection}"
    
    def test_traffic_light_has_infostructure_section(self):
        """Test that infostructure section has traffic light status"""
        response = self.session.get(f"{BASE_URL}/api/scheduler/traffic-light")
        data = response.json()
        status = data.get("status", {})
        
        # Verify infostructure parent
        assert "infostructure" in status, "Missing infostructure in traffic light status"
        
        # Verify infostructure subsections
        infostructure_subsections = [
            "pharma",
            "med-societies",
            "med-specialties",
            "keywords",
            "sources"
        ]
        for subsection in infostructure_subsections:
            assert subsection in status, f"Missing {subsection} in traffic light status"
            assert "status" in status[subsection], f"Missing status field in {subsection}"
    
    def test_step1_parent_aggregation(self):
        """Test that step1 aggregates status from children (1.1, 1.2, 1.3)"""
        response = self.session.get(f"{BASE_URL}/api/scheduler/traffic-light")
        data = response.json()
        status = data.get("status", {})
        
        # Verify step1 children exist
        assert "1.1" in status, "Missing 1.1 in traffic light status"
        assert "1.2" in status, "Missing 1.2 in traffic light status"
        assert "1.3" in status, "Missing 1.3 in traffic light status"
        
        # Verify step1 parent exists
        assert "step1" in status, "Missing step1 in traffic light status"
        
        # Verify aggregation logic: parent should be worst of children (red > yellow > green)
        children_statuses = [
            status.get("1.1", {}).get("status"),
            status.get("1.2", {}).get("status"),
            status.get("1.3", {}).get("status")
        ]
        non_gray = [s for s in children_statuses if s != "gray"]
        
        parent_status = status.get("step1", {}).get("status")
        
        if "red" in non_gray:
            assert parent_status == "red", f"step1 should be red when any child is red, got {parent_status}"
        elif "yellow" in non_gray:
            assert parent_status == "yellow", f"step1 should be yellow when any child is yellow, got {parent_status}"
        elif all(s == "green" for s in non_gray) and non_gray:
            assert parent_status == "green", f"step1 should be green when all children are green, got {parent_status}"
    
    def test_coming_soon_items_have_gray_status(self):
        """Test that Coming Soon items have gray status"""
        response = self.session.get(f"{BASE_URL}/api/scheduler/traffic-light")
        data = response.json()
        status = data.get("status", {})
        
        # List of Coming Soon items based on the requirements
        coming_soon_items = [
            "1.2.1",  # Viral Videos
            "1.2.2",  # Long Form Video Search
            "1.2.3",  # GEO
            "1.2.4",  # SEO
            "1.3.4",  # Social Media Followers
            "2.1.2",  # Booklets & Cases
            "5.2",    # Students for Recommendations
            "1.1.2",  # Via Google Maps
        ]
        
        for item in coming_soon_items:
            assert item in status, f"Missing {item} in traffic light status"
            item_status = status[item].get("status")
            assert item_status == "gray", f"Coming Soon item {item} should have gray status, got {item_status}"
            # Verify reason is coming_soon
            assert status[item].get("reason") == "coming_soon", f"Coming Soon item {item} should have reason 'coming_soon'"
    
    def test_linkedin_finders_have_progress_data(self):
        """Test that LinkedIn finder items have progress data"""
        response = self.session.get(f"{BASE_URL}/api/scheduler/traffic-light")
        data = response.json()
        status = data.get("status", {})
        
        linkedin_items = ["1.1.1.1", "1.1.1.2", "1.1.1.3"]
        
        for item in linkedin_items:
            assert item in status, f"Missing {item} in traffic light status"
            item_data = status[item]
            assert "contacts_this_week" in item_data, f"Missing contacts_this_week in {item}"
            assert "goal" in item_data, f"Missing goal in {item}"
            assert "progress" in item_data, f"Missing progress in {item}"
            assert item_data["goal"] == 50, f"Goal for {item} should be 50"
    
    def test_via_linkedin_parent_has_breakdown(self):
        """Test that 1.1.1 Via LinkedIn has breakdown data"""
        response = self.session.get(f"{BASE_URL}/api/scheduler/traffic-light")
        data = response.json()
        status = data.get("status", {})
        
        assert "1.1.1" in status, "Missing 1.1.1 in traffic light status"
        via_linkedin = status["1.1.1"]
        
        assert "breakdown" in via_linkedin, "Missing breakdown in 1.1.1"
        assert "molecules" in via_linkedin["breakdown"], "Missing molecules in breakdown"
        assert "posts" in via_linkedin["breakdown"], "Missing posts in breakdown"
        assert "position" in via_linkedin["breakdown"], "Missing position in breakdown"
        assert via_linkedin["goal"] == 150, "Goal for 1.1.1 should be 150 (50 x 3)"
    
    def test_status_values_are_valid(self):
        """Test that all status values are valid (green, yellow, red, gray)"""
        response = self.session.get(f"{BASE_URL}/api/scheduler/traffic-light")
        data = response.json()
        status = data.get("status", {})
        
        valid_statuses = ["green", "yellow", "red", "gray"]
        
        for key, value in status.items():
            if isinstance(value, dict) and "status" in value:
                assert value["status"] in valid_statuses, f"Invalid status '{value['status']}' for {key}"
    
    def test_foundations_parent_aggregation(self):
        """Test that foundations parent aggregates from children"""
        response = self.session.get(f"{BASE_URL}/api/scheduler/traffic-light")
        data = response.json()
        status = data.get("status", {})
        
        # Verify foundations-who parent
        assert "foundations-who" in status, "Missing foundations-who in traffic light status"
        
        # Verify foundations parent
        assert "foundations" in status, "Missing foundations in traffic light status"
        
        # Check that foundations has a valid status
        assert status["foundations"]["status"] in ["green", "yellow", "red", "gray"]
    
    def test_infostructure_parent_aggregation(self):
        """Test that infostructure parent aggregates from children"""
        response = self.session.get(f"{BASE_URL}/api/scheduler/traffic-light")
        data = response.json()
        status = data.get("status", {})
        
        # Verify infostructure parent
        assert "infostructure" in status, "Missing infostructure in traffic light status"
        
        # Check that infostructure has a valid status
        assert status["infostructure"]["status"] in ["green", "yellow", "red", "gray"]
        
        # Verify aggregation: if any child is red, parent should be red
        children = ["pharma", "med-societies", "med-specialties", "keywords", "sources"]
        children_statuses = [status.get(c, {}).get("status") for c in children]
        non_gray = [s for s in children_statuses if s != "gray"]
        
        parent_status = status["infostructure"]["status"]
        if "red" in non_gray:
            assert parent_status == "red", f"infostructure should be red when any child is red"


class TestTrafficLightAuthentication:
    """Test authentication requirements for traffic light endpoint"""
    
    def test_traffic_light_requires_auth(self):
        """Test that traffic light endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/scheduler/traffic-light")
        assert response.status_code == 401, "Traffic light endpoint should require authentication"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
