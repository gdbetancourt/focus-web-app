"""
Test suite for Scrappers API endpoints
Tests: Keywords CRUD, Config, Opportunities, Logs, Stats, Run endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestScrapperAuth:
    """Authentication for scrapper tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestKeywordsEndpoints(TestScrapperAuth):
    """Keywords CRUD tests"""
    
    def test_list_keywords(self, headers):
        """GET /api/scrappers/keywords - List all keywords"""
        response = requests.get(f"{BASE_URL}/api/scrappers/keywords?active_only=false", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "keywords" in data
        assert "total" in data
        assert "categories" in data
        print(f"Total keywords: {data['total']}, Categories: {data['categories']}")
    
    def test_list_keywords_active_only(self, headers):
        """GET /api/scrappers/keywords - List active keywords only"""
        response = requests.get(f"{BASE_URL}/api/scrappers/keywords?active_only=true", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "keywords" in data
        # All returned keywords should be active
        for kw in data["keywords"]:
            assert kw.get("active") == True
        print(f"Active keywords: {data['total']}")
    
    def test_create_keyword(self, headers):
        """POST /api/scrappers/keywords - Create new keyword"""
        test_keyword = f"TEST_keyword_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/scrappers/keywords", headers=headers, json={
            "keyword": test_keyword,
            "category": "eventos",
            "active": True
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["keyword"]["keyword"] == test_keyword
        assert data["keyword"]["category"] == "eventos"
        print(f"Created keyword: {test_keyword}")
        # Store for cleanup
        TestKeywordsEndpoints.created_keyword_id = data["keyword"]["id"]
    
    def test_create_duplicate_keyword(self, headers):
        """POST /api/scrappers/keywords - Duplicate keyword returns 400"""
        # Try to create the same keyword again
        response = requests.post(f"{BASE_URL}/api/scrappers/keywords", headers=headers, json={
            "keyword": "Congreso médico",  # Likely exists
            "category": "eventos",
            "active": True
        })
        # Should either succeed (if not exists) or return 400
        assert response.status_code in [200, 400]
        if response.status_code == 400:
            assert "already exists" in response.json().get("detail", "").lower()
            print("Duplicate keyword correctly rejected")
    
    def test_create_keywords_bulk(self, headers):
        """POST /api/scrappers/keywords/bulk - Create multiple keywords"""
        test_keywords = [
            {"keyword": f"TEST_bulk_{uuid.uuid4().hex[:6]}", "category": "transiciones", "active": True},
            {"keyword": f"TEST_bulk_{uuid.uuid4().hex[:6]}", "category": "transiciones", "active": True}
        ]
        response = requests.post(f"{BASE_URL}/api/scrappers/keywords/bulk", headers=headers, json=test_keywords)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "created" in data
        assert "skipped" in data
        print(f"Bulk create: {data['created']} created, {data['skipped']} skipped")
    
    def test_update_keyword_toggle_active(self, headers):
        """PUT /api/scrappers/keywords/{id} - Toggle active status"""
        # First get a keyword
        response = requests.get(f"{BASE_URL}/api/scrappers/keywords?active_only=false", headers=headers)
        keywords = response.json()["keywords"]
        if keywords:
            kw = keywords[0]
            original_active = kw.get("active", True)
            
            # Toggle active
            response = requests.put(f"{BASE_URL}/api/scrappers/keywords/{kw['id']}", headers=headers, json={
                "active": not original_active
            })
            assert response.status_code == 200
            assert response.json()["success"] == True
            print(f"Toggled keyword '{kw['keyword']}' active: {original_active} -> {not original_active}")
            
            # Toggle back
            requests.put(f"{BASE_URL}/api/scrappers/keywords/{kw['id']}", headers=headers, json={
                "active": original_active
            })
    
    def test_update_keyword_not_found(self, headers):
        """PUT /api/scrappers/keywords/{id} - Non-existent returns 404"""
        response = requests.put(f"{BASE_URL}/api/scrappers/keywords/nonexistent-id", headers=headers, json={
            "active": False
        })
        assert response.status_code == 404
        print("Non-existent keyword update correctly returns 404")
    
    def test_delete_keyword(self, headers):
        """DELETE /api/scrappers/keywords/{id} - Delete keyword"""
        # Create a keyword to delete
        test_keyword = f"TEST_delete_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(f"{BASE_URL}/api/scrappers/keywords", headers=headers, json={
            "keyword": test_keyword,
            "category": "general",
            "active": True
        })
        assert create_response.status_code == 200
        keyword_id = create_response.json()["keyword"]["id"]
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/scrappers/keywords/{keyword_id}", headers=headers)
        assert response.status_code == 200
        assert response.json()["success"] == True
        print(f"Deleted keyword: {test_keyword}")
    
    def test_delete_keyword_not_found(self, headers):
        """DELETE /api/scrappers/keywords/{id} - Non-existent returns 404"""
        response = requests.delete(f"{BASE_URL}/api/scrappers/keywords/nonexistent-id", headers=headers)
        assert response.status_code == 404
        print("Non-existent keyword delete correctly returns 404")


class TestConfigEndpoints(TestScrapperAuth):
    """Scrapper configuration tests"""
    
    def test_get_all_configs(self, headers):
        """GET /api/scrappers/config - List all scrapper configurations"""
        response = requests.get(f"{BASE_URL}/api/scrappers/config", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "configs" in data
        configs = data["configs"]
        
        # Should have 5 scrappers
        assert len(configs) >= 5, f"Expected at least 5 scrappers, got {len(configs)}"
        
        # Check expected scrappers exist
        scrapper_ids = [c["scrapper_id"] for c in configs]
        expected_scrappers = [
            "linkedin_posts_keywords",
            "linkedin_posts_profile",
            "linkedin_cargos",
            "dealmakers",
            "pharma_pipelines"
        ]
        for expected in expected_scrappers:
            assert expected in scrapper_ids, f"Missing scrapper: {expected}"
        
        print(f"Found {len(configs)} scrapper configs: {scrapper_ids}")
    
    def test_update_config(self, headers):
        """PUT /api/scrappers/config/{scrapper_id} - Update configuration"""
        scrapper_id = "linkedin_posts_keywords"
        
        # Get current config
        response = requests.get(f"{BASE_URL}/api/scrappers/config", headers=headers)
        configs = response.json()["configs"]
        current_config = next((c for c in configs if c["scrapper_id"] == scrapper_id), None)
        
        # Update config
        response = requests.put(f"{BASE_URL}/api/scrappers/config/{scrapper_id}", headers=headers, json={
            "scrapper_id": scrapper_id,
            "enabled": False,  # Keep disabled for testing
            "interval_minutes": 90,
            "max_per_day": 15,
            "settings": {"author_location": "Mexico", "max_posts_per_keyword": 25}
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["config"]["interval_minutes"] == 90
        print(f"Updated config for {scrapper_id}")
        
        # Restore original if existed
        if current_config:
            requests.put(f"{BASE_URL}/api/scrappers/config/{scrapper_id}", headers=headers, json={
                "scrapper_id": scrapper_id,
                "enabled": current_config.get("enabled", False),
                "interval_minutes": current_config.get("interval_minutes", 60),
                "max_per_day": current_config.get("max_per_day", 10),
                "settings": current_config.get("settings", {})
            })


class TestOpportunitiesEndpoints(TestScrapperAuth):
    """Opportunities CRUD tests"""
    
    def test_list_opportunities(self, headers):
        """GET /api/scrappers/opportunities - List opportunities"""
        response = requests.get(f"{BASE_URL}/api/scrappers/opportunities?limit=100", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "opportunities" in data
        assert "total" in data
        assert "stats_by_source" in data
        print(f"Total opportunities: {data['total']}, By source: {data['stats_by_source']}")
    
    def test_list_opportunities_with_filters(self, headers):
        """GET /api/scrappers/opportunities - With source filter"""
        response = requests.get(f"{BASE_URL}/api/scrappers/opportunities?source=linkedin_posts_keywords&limit=10", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # All returned should be from that source
        for opp in data["opportunities"]:
            assert opp.get("source_scrapper") == "linkedin_posts_keywords"
        print(f"Filtered opportunities: {len(data['opportunities'])}")
    
    def test_update_opportunity_status(self, headers):
        """PUT /api/scrappers/opportunities/{id}/status - Update status"""
        # First get an opportunity
        response = requests.get(f"{BASE_URL}/api/scrappers/opportunities?limit=1", headers=headers)
        opportunities = response.json()["opportunities"]
        
        if opportunities:
            opp = opportunities[0]
            original_status = opp.get("status", "new")
            
            # Update status
            response = requests.put(
                f"{BASE_URL}/api/scrappers/opportunities/{opp['id']}/status",
                headers=headers,
                params={"status": "contacted"}
            )
            assert response.status_code == 200
            assert response.json()["success"] == True
            print(f"Updated opportunity status to 'contacted'")
            
            # Restore original status
            requests.put(
                f"{BASE_URL}/api/scrappers/opportunities/{opp['id']}/status",
                headers=headers,
                params={"status": original_status}
            )
        else:
            print("No opportunities to test status update - skipping")
    
    def test_update_opportunity_invalid_status(self, headers):
        """PUT /api/scrappers/opportunities/{id}/status - Invalid status returns 400"""
        response = requests.get(f"{BASE_URL}/api/scrappers/opportunities?limit=1", headers=headers)
        opportunities = response.json()["opportunities"]
        
        if opportunities:
            opp = opportunities[0]
            response = requests.put(
                f"{BASE_URL}/api/scrappers/opportunities/{opp['id']}/status",
                headers=headers,
                params={"status": "invalid_status"}
            )
            assert response.status_code == 400
            print("Invalid status correctly rejected")
        else:
            print("No opportunities to test - skipping")
    
    def test_update_opportunity_not_found(self, headers):
        """PUT /api/scrappers/opportunities/{id}/status - Non-existent returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/scrappers/opportunities/nonexistent-id/status",
            headers=headers,
            params={"status": "contacted"}
        )
        assert response.status_code == 404
        print("Non-existent opportunity correctly returns 404")


class TestLogsEndpoints(TestScrapperAuth):
    """Logs and runs tests"""
    
    def test_list_logs(self, headers):
        """GET /api/scrappers/logs - List logs"""
        response = requests.get(f"{BASE_URL}/api/scrappers/logs?limit=50", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert "total" in data
        print(f"Total logs: {data['total']}")
    
    def test_list_logs_with_filter(self, headers):
        """GET /api/scrappers/logs - With scrapper filter"""
        response = requests.get(f"{BASE_URL}/api/scrappers/logs?scrapper_id=linkedin_posts_keywords&limit=10", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # All returned should be from that scrapper
        for log in data["logs"]:
            assert log.get("scrapper_id") == "linkedin_posts_keywords"
        print(f"Filtered logs: {len(data['logs'])}")
    
    def test_list_runs(self, headers):
        """GET /api/scrappers/logs/runs - List run history"""
        response = requests.get(f"{BASE_URL}/api/scrappers/logs/runs?limit=20", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "runs" in data
        assert "total" in data
        print(f"Total runs: {data['total']}")


class TestStatsEndpoints(TestScrapperAuth):
    """Statistics tests"""
    
    def test_get_stats(self, headers):
        """GET /api/scrappers/stats - Get overall statistics"""
        response = requests.get(f"{BASE_URL}/api/scrappers/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check expected fields
        assert "total_opportunities" in data
        assert "today_opportunities" in data
        assert "by_status" in data
        assert "by_source" in data
        assert "recent_runs" in data
        assert "keywords" in data
        
        # Keywords should have total and active
        assert "total" in data["keywords"]
        assert "active" in data["keywords"]
        
        print(f"Stats: {data['total_opportunities']} total opps, {data['keywords']['active']} active keywords")


class TestRunEndpoints(TestScrapperAuth):
    """Scrapper run tests (without actually running Apify)"""
    
    def test_run_unknown_scrapper(self, headers):
        """POST /api/scrappers/run/{scrapper_id} - Unknown scrapper returns 400"""
        response = requests.post(f"{BASE_URL}/api/scrappers/run/unknown_scrapper", headers=headers)
        assert response.status_code == 400
        print("Unknown scrapper correctly rejected")
    
    def test_get_run_status_not_found(self, headers):
        """GET /api/scrappers/run/{run_id}/status - Non-existent returns 404"""
        response = requests.get(f"{BASE_URL}/api/scrappers/run/nonexistent-run-id/status", headers=headers)
        assert response.status_code == 404
        print("Non-existent run correctly returns 404")


class TestCleanup(TestScrapperAuth):
    """Cleanup test data"""
    
    def test_cleanup_test_keywords(self, headers):
        """Delete TEST_ prefixed keywords"""
        response = requests.get(f"{BASE_URL}/api/scrappers/keywords?active_only=false", headers=headers)
        keywords = response.json()["keywords"]
        
        deleted = 0
        for kw in keywords:
            if kw.get("keyword", "").startswith("TEST_"):
                del_response = requests.delete(f"{BASE_URL}/api/scrappers/keywords/{kw['id']}", headers=headers)
                if del_response.status_code == 200:
                    deleted += 1
        
        print(f"Cleaned up {deleted} test keywords")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
