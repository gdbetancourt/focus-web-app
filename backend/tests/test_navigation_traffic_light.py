"""
Test Navigation Structure and Traffic Light Feature
Tests for reorganized navigation (1.1 Find with Via LinkedIn and Via Google Maps)
and new traffic light logic based on weekly contacts
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTrafficLightEndpoint:
    """Tests for /api/scheduler/traffic-light endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_traffic_light_endpoint_returns_200(self):
        """Test that traffic-light endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/scheduler/traffic-light", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
    
    def test_traffic_light_has_required_keys(self):
        """Test that traffic-light returns all required status keys for new navigation"""
        response = requests.get(f"{BASE_URL}/api/scheduler/traffic-light", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        status = data.get("status", {})
        
        # Required keys for new navigation structure
        required_keys = ["1.1.1", "1.1.1.1", "1.1.1.2", "1.1.1.3", "1.1.2"]
        for key in required_keys:
            assert key in status, f"Missing required key: {key}"
    
    def test_linkedin_finders_have_contacts_info(self):
        """Test that LinkedIn finder items have contacts_this_week, goal, progress"""
        response = requests.get(f"{BASE_URL}/api/scheduler/traffic-light", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        status = data.get("status", {})
        
        linkedin_keys = ["1.1.1.1", "1.1.1.2", "1.1.1.3"]
        for key in linkedin_keys:
            item = status.get(key, {})
            assert "contacts_this_week" in item, f"{key} missing contacts_this_week"
            assert "goal" in item, f"{key} missing goal"
            assert "progress" in item, f"{key} missing progress"
            assert item.get("goal") == 50, f"{key} goal should be 50"
    
    def test_via_linkedin_parent_has_breakdown(self):
        """Test that 1.1.1 Via LinkedIn has breakdown by source"""
        response = requests.get(f"{BASE_URL}/api/scheduler/traffic-light", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        status = data.get("status", {})
        
        via_linkedin = status.get("1.1.1", {})
        assert "breakdown" in via_linkedin, "1.1.1 missing breakdown"
        breakdown = via_linkedin.get("breakdown", {})
        assert "molecules" in breakdown, "breakdown missing molecules"
        assert "posts" in breakdown, "breakdown missing posts"
        assert "position" in breakdown, "breakdown missing position"
        assert via_linkedin.get("goal") == 150, "1.1.1 goal should be 150"
    
    def test_traffic_light_status_logic(self):
        """Test traffic light status logic: green >= goal, yellow > 0, red = 0"""
        response = requests.get(f"{BASE_URL}/api/scheduler/traffic-light", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        status = data.get("status", {})
        
        for key in ["1.1.1.1", "1.1.1.2", "1.1.1.3"]:
            item = status.get(key, {})
            contacts = item.get("contacts_this_week", 0)
            item_status = item.get("status")
            
            if contacts >= 50:
                assert item_status == "green", f"{key} with {contacts} contacts should be green"
            elif contacts > 0:
                assert item_status == "yellow", f"{key} with {contacts} contacts should be yellow"
            else:
                assert item_status == "red", f"{key} with {contacts} contacts should be red"
    
    def test_google_maps_status_present(self):
        """Test that 1.1.2 Via Google Maps has status"""
        response = requests.get(f"{BASE_URL}/api/scheduler/traffic-light", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        status = data.get("status", {})
        
        google_maps = status.get("1.1.2", {})
        assert "status" in google_maps, "1.1.2 missing status"
        assert google_maps.get("status") in ["green", "yellow", "red"], "Invalid status for 1.1.2"


class TestWeeklyTasks:
    """Tests for weekly tasks endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        assert login_response.status_code == 200
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_weekly_tasks_endpoint(self):
        """Test weekly tasks endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/scheduler/weekly-tasks", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "week_key" in data
        assert "tasks" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
