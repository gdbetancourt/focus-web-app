"""
Email Rules API Tests - Testing E1-E10 rule configuration and email queue
Tests: get all rules, update rules, toggle rules, queue status, queue processing
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestEmailRulesNoAuth:
    """Test endpoints without authentication (should require auth)"""
    
    def test_get_rules_requires_auth(self):
        """GET /api/email-rules/ - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/email-rules/")
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_queue_status_requires_auth(self):
        """GET /api/email-rules/queue/status - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/email-rules/queue/status")
        assert response.status_code == 401


class TestEmailRulesAuth:
    """Test authenticated email rules endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        if login_response.status_code != 200:
            pytest.skip("Authentication failed - Google OAuth required")
        self.token = login_response.json().get("access_token", "")
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def test_get_all_rules(self):
        """GET /api/email-rules/ - List all email rules (E1-E10)"""
        response = requests.get(
            f"{BASE_URL}/api/email-rules/",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "rules" in data
        assert "total" in data
        
        # Should have 10 rules (E1-E10)
        rules = data["rules"]
        assert len(rules) >= 10, f"Expected at least 10 rules, got {len(rules)}"
        
        # Verify rule structure
        for rule in rules:
            assert "id" in rule, "Rule should have id"
            assert "name" in rule, "Rule should have name"
            assert "enabled" in rule, "Rule should have enabled flag"
            assert "cadence_days" in rule, "Rule should have cadence_days"
            
        # Verify specific rules exist
        rule_ids = [r["id"] for r in rules]
        for expected_id in ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10"]:
            assert expected_id in rule_ids, f"Rule {expected_id} not found"
    
    def test_get_specific_rule(self):
        """GET /api/email-rules/{rule_id} - Get specific rule"""
        response = requests.get(
            f"{BASE_URL}/api/email-rules/E1",
            headers=self.headers
        )
        assert response.status_code == 200
        rule = response.json()
        assert rule["id"] == "E1"
        assert "name" in rule
        assert "description" in rule
        assert "enabled" in rule
        assert "target_stages" in rule
    
    def test_update_rule_description(self):
        """PUT /api/email-rules/{rule_id} - Update rule configuration"""
        # Get current rule first
        get_response = requests.get(
            f"{BASE_URL}/api/email-rules/E1",
            headers=self.headers
        )
        if get_response.status_code != 200:
            pytest.skip("Could not get rule E1")
        
        original_description = get_response.json().get("description", "")
        
        # Update description
        new_description = "TEST: Updated description for E1"
        update_response = requests.put(
            f"{BASE_URL}/api/email-rules/E1",
            headers=self.headers,
            json={"description": new_description}
        )
        assert update_response.status_code == 200
        updated_rule = update_response.json()
        assert updated_rule["description"] == new_description
        
        # Restore original description
        requests.put(
            f"{BASE_URL}/api/email-rules/E1",
            headers=self.headers,
            json={"description": original_description}
        )
    
    def test_toggle_rule(self):
        """POST /api/email-rules/{rule_id}/toggle - Toggle rule enabled state"""
        # Get current state
        get_response = requests.get(
            f"{BASE_URL}/api/email-rules/E1",
            headers=self.headers
        )
        if get_response.status_code != 200:
            pytest.skip("Could not get rule E1")
        
        original_enabled = get_response.json().get("enabled", True)
        
        # Toggle
        toggle_response = requests.post(
            f"{BASE_URL}/api/email-rules/E1/toggle",
            headers=self.headers
        )
        assert toggle_response.status_code == 200
        toggle_data = toggle_response.json()
        assert toggle_data["rule_id"] == "E1"
        assert toggle_data["enabled"] == (not original_enabled)
        
        # Toggle back
        requests.post(
            f"{BASE_URL}/api/email-rules/E1/toggle",
            headers=self.headers
        )
    
    def test_get_queue_status(self):
        """GET /api/email-rules/queue/status - Get email queue status"""
        response = requests.get(
            f"{BASE_URL}/api/email-rules/queue/status",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "stats" in data, "Response should include stats"
        stats = data["stats"]
        assert "pending" in stats, "Stats should have pending count"
        assert "sent_today" in stats, "Stats should have sent_today count"
        assert "failed" in stats, "Stats should have failed count"
        
        # Verify counts are non-negative integers
        assert isinstance(stats["pending"], int) and stats["pending"] >= 0
        assert isinstance(stats["sent_today"], int) and stats["sent_today"] >= 0
        assert isinstance(stats["failed"], int) and stats["failed"] >= 0
    
    def test_process_queue_manual(self):
        """POST /api/email-rules/queue/process - Manually process queue"""
        response = requests.post(
            f"{BASE_URL}/api/email-rules/queue/process?max_emails=1",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "success" in data
        assert data["success"] == True
        assert "processed" in data
        
        # Verify processed contains expected keys
        processed = data["processed"]
        assert "sent" in processed or isinstance(processed, dict)
    
    def test_get_rule_stats(self):
        """GET /api/email-rules/stats/summary - Get statistics for all rules"""
        response = requests.get(
            f"{BASE_URL}/api/email-rules/stats/summary",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "queue" in data, "Response should include queue stats"
        # last_7_days may be empty if no emails sent
        assert "last_7_days" in data, "Response should include last_7_days"
    
    def test_rule_validation(self):
        """PUT /api/email-rules/{rule_id} - Test validation on update"""
        # Try to update with invalid data (rule that doesn't exist)
        response = requests.put(
            f"{BASE_URL}/api/email-rules/INVALID_RULE",
            headers=self.headers,
            json={"description": "Test"}
        )
        # Should return 404 for non-existent rule
        assert response.status_code == 404
    
    def test_update_rule_cadence(self):
        """PUT /api/email-rules/{rule_id} - Update cadence days"""
        # Get E4 rule (repurchase rule with 90-day cadence)
        get_response = requests.get(
            f"{BASE_URL}/api/email-rules/E4",
            headers=self.headers
        )
        if get_response.status_code != 200:
            pytest.skip("Could not get rule E4")
        
        original_cadence = get_response.json().get("cadence_days", 90)
        
        # Update cadence
        new_cadence = 60
        update_response = requests.put(
            f"{BASE_URL}/api/email-rules/E4",
            headers=self.headers,
            json={"cadence_days": new_cadence}
        )
        assert update_response.status_code == 200
        assert update_response.json()["cadence_days"] == new_cadence
        
        # Restore original
        requests.put(
            f"{BASE_URL}/api/email-rules/E4",
            headers=self.headers,
            json={"cadence_days": original_cadence}
        )
    
    def test_update_rule_target_roles(self):
        """PUT /api/email-rules/{rule_id} - Update target roles"""
        get_response = requests.get(
            f"{BASE_URL}/api/email-rules/E3",
            headers=self.headers
        )
        if get_response.status_code != 200:
            pytest.skip("Could not get rule E3")
        
        original_roles = get_response.json().get("target_roles", [])
        
        # Update roles
        new_roles = ["coachee", "test_role"]
        update_response = requests.put(
            f"{BASE_URL}/api/email-rules/E3",
            headers=self.headers,
            json={"target_roles": new_roles}
        )
        assert update_response.status_code == 200
        assert update_response.json()["target_roles"] == new_roles
        
        # Restore original
        requests.put(
            f"{BASE_URL}/api/email-rules/E3",
            headers=self.headers,
            json={"target_roles": original_roles}
        )


class TestEmailIndividual:
    """Test email individual endpoints (E1-E5 legacy)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        if login_response.status_code != 200:
            pytest.skip("Authentication failed - Google OAuth required")
        self.token = login_response.json().get("access_token", "")
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def test_get_email_contacts(self):
        """GET /api/email-individual/contacts - Get contacts needing emails"""
        response = requests.get(
            f"{BASE_URL}/api/email-individual/contacts",
            headers=self.headers
        )
        # Should work even if no contacts match criteria
        assert response.status_code == 200
        data = response.json()
        
        assert "contacts" in data
        assert "count" in data
        assert "summary" in data
        assert "rules" in data
        
        # Verify summary includes all rule types
        summary = data["summary"]
        for rule_type in ["E1", "E2", "E3", "E4", "E5"]:
            assert rule_type in summary, f"Summary should include {rule_type}"
    
    def test_get_email_stats(self):
        """GET /api/email-individual/stats - Get email statistics"""
        response = requests.get(
            f"{BASE_URL}/api/email-individual/stats",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "today" in data
        today = data["today"]
        assert "total" in today
        assert "E1" in today
        assert "E2" in today
        assert "E3" in today
        assert "E4" in today
    
    def test_get_email_metrics_dashboard(self):
        """GET /api/email-individual/metrics/dashboard - Get metrics dashboard"""
        response = requests.get(
            f"{BASE_URL}/api/email-individual/metrics/dashboard?days=7",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "period_days" in data
        assert "total" in data
        assert "by_rule" in data
        assert "daily" in data
        assert "insights" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
