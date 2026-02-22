"""
Test Admin Operations Endpoints
- Pre-import readiness check
- Duplicate email detection
- Phone reset (destructive operation)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminOperations:
    """Test admin operations endpoints for contacts management"""
    
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
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    # ============ PRE-IMPORT CHECK TESTS ============
    
    def test_pre_import_check_returns_200(self):
        """Test GET /api/contacts/admin/pre-import-check returns 200"""
        response = self.session.get(f"{BASE_URL}/api/contacts/admin/pre-import-check")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_pre_import_check_response_structure(self):
        """Test pre-import check returns expected fields"""
        response = self.session.get(f"{BASE_URL}/api/contacts/admin/pre-import-check")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields exist
        assert "is_ready_for_import" in data, "Missing is_ready_for_import field"
        assert "blockers" in data, "Missing blockers field"
        assert "warnings" in data, "Missing warnings field"
        assert "stats" in data, "Missing stats field"
        assert "import_config" in data, "Missing import_config field"
        
        # Check stats structure
        stats = data["stats"]
        assert "total_contacts" in stats, "Missing total_contacts in stats"
        assert "contacts_with_phones" in stats, "Missing contacts_with_phones in stats"
        assert "duplicate_email_groups" in stats, "Missing duplicate_email_groups in stats"
        
        # Check import_config structure
        config = data["import_config"]
        assert "merge_strategy" in config, "Missing merge_strategy in import_config"
        assert config["merge_strategy"] == "EMAIL", "Expected merge_strategy to be EMAIL"
    
    def test_pre_import_check_stats_values(self):
        """Test pre-import check returns valid stats values"""
        response = self.session.get(f"{BASE_URL}/api/contacts/admin/pre-import-check")
        assert response.status_code == 200
        
        data = response.json()
        stats = data["stats"]
        
        # Verify stats are non-negative integers
        assert isinstance(stats["total_contacts"], int), "total_contacts should be int"
        assert stats["total_contacts"] >= 0, "total_contacts should be non-negative"
        
        assert isinstance(stats["contacts_with_phones"], int), "contacts_with_phones should be int"
        assert stats["contacts_with_phones"] >= 0, "contacts_with_phones should be non-negative"
        
        assert isinstance(stats["duplicate_email_groups"], int), "duplicate_email_groups should be int"
        assert stats["duplicate_email_groups"] >= 0, "duplicate_email_groups should be non-negative"
        
        print(f"Stats: total={stats['total_contacts']}, with_phones={stats['contacts_with_phones']}, duplicates={stats['duplicate_email_groups']}")
    
    # ============ DUPLICATE EMAIL CHECK TESTS ============
    
    def test_duplicate_email_check_returns_200(self):
        """Test GET /api/contacts/admin/duplicate-email-check returns 200"""
        response = self.session.get(f"{BASE_URL}/api/contacts/admin/duplicate-email-check")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_duplicate_email_check_response_structure(self):
        """Test duplicate email check returns expected fields"""
        response = self.session.get(f"{BASE_URL}/api/contacts/admin/duplicate-email-check")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields exist
        assert "total_duplicate_groups" in data, "Missing total_duplicate_groups field"
        assert "total_affected_contacts" in data, "Missing total_affected_contacts field"
        assert "duplicate_groups" in data, "Missing duplicate_groups field"
        assert "has_duplicates" in data, "Missing has_duplicates field"
        assert "recommendation" in data, "Missing recommendation field"
        
        # Verify types
        assert isinstance(data["total_duplicate_groups"], int), "total_duplicate_groups should be int"
        assert isinstance(data["total_affected_contacts"], int), "total_affected_contacts should be int"
        assert isinstance(data["duplicate_groups"], list), "duplicate_groups should be list"
        assert isinstance(data["has_duplicates"], bool), "has_duplicates should be bool"
        assert isinstance(data["recommendation"], str), "recommendation should be string"
    
    def test_duplicate_email_check_group_structure(self):
        """Test duplicate email groups have correct structure if any exist"""
        response = self.session.get(f"{BASE_URL}/api/contacts/admin/duplicate-email-check")
        assert response.status_code == 200
        
        data = response.json()
        
        if data["has_duplicates"] and len(data["duplicate_groups"]) > 0:
            group = data["duplicate_groups"][0]
            assert "email" in group, "Missing email in duplicate group"
            assert "count" in group, "Missing count in duplicate group"
            assert "contacts" in group, "Missing contacts in duplicate group"
            assert group["count"] > 1, "Duplicate group should have count > 1"
            
            # Check contact structure
            if len(group["contacts"]) > 0:
                contact = group["contacts"][0]
                assert "id" in contact, "Missing id in contact"
                assert "name" in contact, "Missing name in contact"
        
        print(f"Duplicate groups: {data['total_duplicate_groups']}, affected contacts: {data['total_affected_contacts']}")
    
    # ============ PHONE RESET TESTS ============
    
    def test_phone_reset_rejects_wrong_confirmation(self):
        """Test POST /api/contacts/admin/reset-phones rejects wrong confirmation text"""
        response = self.session.post(
            f"{BASE_URL}/api/contacts/admin/reset-phones",
            json={"confirmation_text": "WRONG TEXT"}
        )
        
        # Should return 400 for wrong confirmation
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Missing error detail"
        assert "RESET PHONES" in data["detail"], "Error should mention required confirmation text"
    
    def test_phone_reset_rejects_empty_confirmation(self):
        """Test POST /api/contacts/admin/reset-phones rejects empty confirmation"""
        response = self.session.post(
            f"{BASE_URL}/api/contacts/admin/reset-phones",
            json={"confirmation_text": ""}
        )
        
        # Should return 400 for empty confirmation
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_phone_reset_rejects_case_mismatch(self):
        """Test POST /api/contacts/admin/reset-phones rejects case mismatch"""
        response = self.session.post(
            f"{BASE_URL}/api/contacts/admin/reset-phones",
            json={"confirmation_text": "reset phones"}  # lowercase
        )
        
        # Should return 400 for case mismatch
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_phone_reset_rejects_partial_match(self):
        """Test POST /api/contacts/admin/reset-phones rejects partial match"""
        response = self.session.post(
            f"{BASE_URL}/api/contacts/admin/reset-phones",
            json={"confirmation_text": "RESET"}  # partial
        )
        
        # Should return 400 for partial match
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_phone_reset_requires_body(self):
        """Test POST /api/contacts/admin/reset-phones requires request body"""
        response = self.session.post(
            f"{BASE_URL}/api/contacts/admin/reset-phones"
        )
        
        # Should return 422 for missing body
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
    
    # ============ ADMIN OPERATIONS LIST TESTS ============
    
    def test_list_admin_operations_returns_200(self):
        """Test GET /api/contacts/admin/operations returns 200"""
        response = self.session.get(f"{BASE_URL}/api/contacts/admin/operations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_list_admin_operations_response_structure(self):
        """Test admin operations list returns expected structure"""
        response = self.session.get(f"{BASE_URL}/api/contacts/admin/operations")
        assert response.status_code == 200
        
        data = response.json()
        
        assert "operations" in data, "Missing operations field"
        assert "count" in data, "Missing count field"
        assert isinstance(data["operations"], list), "operations should be list"
        assert isinstance(data["count"], int), "count should be int"
    
    # ============ AUTHENTICATION TESTS ============
    
    def test_pre_import_check_requires_auth(self):
        """Test pre-import check requires authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/contacts/admin/pre-import-check")
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_duplicate_email_check_requires_auth(self):
        """Test duplicate email check requires authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/contacts/admin/duplicate-email-check")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_phone_reset_requires_auth(self):
        """Test phone reset requires authentication"""
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        response = no_auth_session.post(
            f"{BASE_URL}/api/contacts/admin/reset-phones",
            json={"confirmation_text": "RESET PHONES"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
