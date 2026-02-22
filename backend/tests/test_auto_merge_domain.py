"""
Test suite for Phase 8 - Auto-Merge by Domain functionality
Tests endpoints:
- GET /api/companies/auto-merge/stats
- GET /api/companies/auto-merge/preview
- POST /api/companies/auto-merge/run (dry_run=true only)
- GET /api/companies/auto-merge/history
"""
import os
import pytest
import requests

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


class TestAutoMergeStats:
    """Tests for GET /api/companies/auto-merge/stats"""
    
    def test_stats_requires_authentication(self, api_session):
        """Should return 401 without authentication"""
        response = api_session.get(f"{BASE_URL}/api/companies/auto-merge/stats")
        assert response.status_code == 401
        assert "Not authenticated" in response.json().get("detail", "")
    
    def test_stats_returns_duplicate_domain_info(self, api_session, auth_headers):
        """Should return statistics about duplicate domains"""
        response = api_session.get(
            f"{BASE_URL}/api/companies/auto-merge/stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify response structure
        assert "duplicate_domain_groups" in data
        assert "total_companies_with_duplicates" in data
        assert "potential_merges" in data
        assert "top_duplicate_domains" in data
        
        # Verify data types
        assert isinstance(data["duplicate_domain_groups"], int)
        assert isinstance(data["total_companies_with_duplicates"], int)
        assert isinstance(data["potential_merges"], int)
        assert isinstance(data["top_duplicate_domains"], list)
        
        # Verify we have duplicate domains (based on known data)
        assert data["duplicate_domain_groups"] > 0
        assert data["potential_merges"] > 0
    
    def test_stats_top_domains_structure(self, api_session, auth_headers):
        """Should return top domains with correct structure"""
        response = api_session.get(
            f"{BASE_URL}/api/companies/auto-merge/stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        top_domains = data.get("top_duplicate_domains", [])
        
        if len(top_domains) > 0:
            first_domain = top_domains[0]
            assert "domain" in first_domain
            assert "count" in first_domain
            assert isinstance(first_domain["domain"], str)
            assert isinstance(first_domain["count"], int)
            assert first_domain["count"] >= 2  # Duplicate means at least 2


class TestAutoMergePreview:
    """Tests for GET /api/companies/auto-merge/preview"""
    
    def test_preview_requires_authentication(self, api_session):
        """Should return 401 without authentication"""
        response = api_session.get(f"{BASE_URL}/api/companies/auto-merge/preview")
        assert response.status_code == 401
    
    def test_preview_returns_groups(self, api_session, auth_headers):
        """Should return preview of duplicate domain groups"""
        response = api_session.get(
            f"{BASE_URL}/api/companies/auto-merge/preview?limit=5",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify response structure
        assert "duplicate_domain_groups" in data
        assert "total_companies_affected" in data
        assert "potential_merges" in data
        assert "groups" in data
        assert isinstance(data["groups"], list)
    
    def test_preview_respects_limit(self, api_session, auth_headers):
        """Should respect the limit parameter"""
        limit = 3
        response = api_session.get(
            f"{BASE_URL}/api/companies/auto-merge/preview?limit={limit}",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["groups"]) <= limit
    
    def test_preview_group_structure(self, api_session, auth_headers):
        """Should return groups with primary and secondaries"""
        response = api_session.get(
            f"{BASE_URL}/api/companies/auto-merge/preview?limit=5",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        groups = data.get("groups", [])
        
        if len(groups) > 0:
            first_group = groups[0]
            # Verify group structure
            assert "domain" in first_group
            assert "company_count" in first_group
            assert "primary" in first_group
            assert "secondaries" in first_group
            
            # Verify primary company structure
            primary = first_group["primary"]
            if primary:
                assert "id" in primary
                assert "name" in primary
                assert "score" in primary
            
            # Verify secondaries structure
            secondaries = first_group["secondaries"]
            assert isinstance(secondaries, list)
            if len(secondaries) > 0:
                secondary = secondaries[0]
                assert "id" in secondary
                assert "name" in secondary
                assert "score" in secondary
            
            # company_count should be at least 2 (duplicate)
            assert first_group["company_count"] >= 2


class TestAutoMergeRun:
    """Tests for POST /api/companies/auto-merge/run"""
    
    def test_run_requires_authentication(self, api_session):
        """Should return 401 without authentication"""
        response = api_session.post(
            f"{BASE_URL}/api/companies/auto-merge/run",
            json={"max_merges": 5, "dry_run": True}
        )
        assert response.status_code == 401
    
    def test_dry_run_returns_preview(self, api_session, auth_headers):
        """Dry run should return what would be merged without making changes"""
        response = api_session.post(
            f"{BASE_URL}/api/companies/auto-merge/run",
            headers=auth_headers,
            json={"max_merges": 5, "dry_run": True}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify dry run response structure
        assert "operation_id" in data
        assert "operation_type" in data
        assert data["operation_type"] == "auto_domain_merge"
        assert "dry_run" in data
        assert data["dry_run"] == True
        assert "merges_performed" in data
        assert "merge_details" in data
        assert "status" in data
        assert data["status"] == "completed"
    
    def test_dry_run_respects_max_merges(self, api_session, auth_headers):
        """Dry run should respect max_merges parameter"""
        max_merges = 3
        response = api_session.post(
            f"{BASE_URL}/api/companies/auto-merge/run",
            headers=auth_headers,
            json={"max_merges": max_merges, "dry_run": True}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Should not exceed max_merges
        assert data["merges_performed"] <= max_merges
    
    def test_dry_run_merge_details_structure(self, api_session, auth_headers):
        """Merge details should have correct structure"""
        response = api_session.post(
            f"{BASE_URL}/api/companies/auto-merge/run",
            headers=auth_headers,
            json={"max_merges": 5, "dry_run": True}
        )
        assert response.status_code == 200
        
        data = response.json()
        merge_details = data.get("merge_details", [])
        
        if len(merge_details) > 0:
            first_merge = merge_details[0]
            # Verify merge detail structure
            assert "domain" in first_merge
            assert "primary_id" in first_merge
            assert "primary_name" in first_merge
            assert "secondary_id" in first_merge
            assert "secondary_name" in first_merge
            assert "dry_run" in first_merge
            assert first_merge["dry_run"] == True
    
    def test_dry_run_does_not_modify_data(self, api_session, auth_headers):
        """Dry run should not modify any data in the database"""
        # Get stats before dry run
        stats_before = api_session.get(
            f"{BASE_URL}/api/companies/auto-merge/stats",
            headers=auth_headers
        ).json()
        
        # Run dry run
        response = api_session.post(
            f"{BASE_URL}/api/companies/auto-merge/run",
            headers=auth_headers,
            json={"max_merges": 10, "dry_run": True}
        )
        assert response.status_code == 200
        
        # Get stats after dry run
        stats_after = api_session.get(
            f"{BASE_URL}/api/companies/auto-merge/stats",
            headers=auth_headers
        ).json()
        
        # Stats should be the same (no data was modified)
        assert stats_before["duplicate_domain_groups"] == stats_after["duplicate_domain_groups"]
        assert stats_before["potential_merges"] == stats_after["potential_merges"]
    
    def test_dry_run_default_value(self, api_session, auth_headers):
        """Without dry_run parameter, should default to True (safe mode)"""
        # Note: Per API design, dry_run defaults to True if not specified
        # However, the endpoint requires the parameter in the body
        # Let's test what happens when we send just max_merges
        response = api_session.post(
            f"{BASE_URL}/api/companies/auto-merge/run",
            headers=auth_headers,
            json={"max_merges": 3}
        )
        # Should still work - dry_run defaults to True in Pydantic model
        assert response.status_code == 200
        data = response.json()
        # Should be a dry run (default)
        assert data.get("dry_run", True) == True


class TestAutoMergeHistory:
    """Tests for GET /api/companies/auto-merge/history"""
    
    def test_history_requires_authentication(self, api_session):
        """Should return 401 without authentication"""
        response = api_session.get(f"{BASE_URL}/api/companies/auto-merge/history")
        assert response.status_code == 401
    
    def test_history_returns_operations(self, api_session, auth_headers):
        """Should return history of auto-merge operations"""
        response = api_session.get(
            f"{BASE_URL}/api/companies/auto-merge/history?limit=10",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify response structure
        assert "operations" in data
        assert "count" in data
        assert isinstance(data["operations"], list)
        assert isinstance(data["count"], int)
    
    def test_history_respects_limit(self, api_session, auth_headers):
        """Should respect the limit parameter"""
        limit = 5
        response = api_session.get(
            f"{BASE_URL}/api/companies/auto-merge/history?limit={limit}",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["operations"]) <= limit


class TestAutoMergeIntegration:
    """Integration tests for auto-merge workflow"""
    
    def test_stats_and_preview_consistency(self, api_session, auth_headers):
        """Stats and preview should show consistent data"""
        # Get stats
        stats_response = api_session.get(
            f"{BASE_URL}/api/companies/auto-merge/stats",
            headers=auth_headers
        )
        stats = stats_response.json()
        
        # Get preview with same limit as stats top domains
        preview_response = api_session.get(
            f"{BASE_URL}/api/companies/auto-merge/preview?limit=10",
            headers=auth_headers
        )
        preview = preview_response.json()
        
        # Both should have data if stats show duplicates
        if stats["duplicate_domain_groups"] > 0:
            assert preview["duplicate_domain_groups"] > 0
    
    def test_dry_run_matches_preview(self, api_session, auth_headers):
        """Dry run should reference same domains as preview"""
        # Get preview
        preview_response = api_session.get(
            f"{BASE_URL}/api/companies/auto-merge/preview?limit=5",
            headers=auth_headers
        )
        preview = preview_response.json()
        preview_domains = {g["domain"] for g in preview["groups"]}
        
        # Run dry run
        dry_run_response = api_session.post(
            f"{BASE_URL}/api/companies/auto-merge/run",
            headers=auth_headers,
            json={"max_merges": 10, "dry_run": True}
        )
        dry_run = dry_run_response.json()
        dry_run_domains = {m["domain"] for m in dry_run["merge_details"]}
        
        # Dry run domains should be subset of (or overlap with) preview domains
        # They process in same order, so first domains should match
        if len(dry_run_domains) > 0 and len(preview_domains) > 0:
            # At least one domain should be in common
            assert len(dry_run_domains & preview_domains) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
