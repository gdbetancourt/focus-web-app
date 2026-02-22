"""
Test Companies Router Migration to Unified Collections
-------------------------------------------------------
Tests the migration of /api/companies router endpoints from legacy collections 
(hubspot_companies, active_companies, companies) to unified_companies.

P2 Maintenance Task - All 44 legacy references removed.

Key Endpoints Tested:
1. GET /api/companies - List companies
2. GET /api/companies/search?q=test - Search companies
3. GET /api/companies/{id}/detail - Company detail
4. POST /api/companies - Create company
5. PUT /api/companies/{id} - Update company
6. GET /api/companies/merge-candidates/semaphore - Merge semaphore
7. GET /api/companies/merge-candidates/cache-status - Cache status
8. GET /api/focus/traffic-light-status - Traffic light (merge-companies section)
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://persona-assets.preview.emergentagent.com').rstrip('/')

# Test data prefix for cleanup
TEST_PREFIX = "TEST_COMPANIES_MIGRATION_"

# Test session token
TEST_SESSION_TOKEN = "test_session_6gxa1S6v3fIOTHk44sLNNvtI-ZcylD8USEGujgos5Ek"


@pytest.fixture(scope="module")
def auth_headers():
    """Returns headers with session cookie"""
    return {
        "Content-Type": "application/json",
        "Cookie": f"session_token={TEST_SESSION_TOKEN}"
    }


session = requests.Session()


class TestCompaniesListEndpoint:
    """Test GET /api/companies - List companies endpoint"""
    
    def test_list_companies_returns_200(self, auth_headers):
        """GET /api/companies should return 200"""
        response = session.get(f"{BASE_URL}/api/companies?limit=10", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "companies" in data, "Response should have 'companies' field"
        assert "total" in data, "Response should have 'total' field"
        assert isinstance(data["companies"], list), "Companies should be a list"
        print(f"✓ GET /api/companies: Found {data['total']} total companies, returned {len(data['companies'])}")
    
    def test_list_companies_with_search_filter(self, auth_headers):
        """GET /api/companies with search parameter should filter results"""
        response = session.get(f"{BASE_URL}/api/companies?search=test&limit=10", headers=auth_headers)
        
        assert response.status_code == 200, f"Search filter failed: {response.text}"
        data = response.json()
        
        assert "companies" in data, "Response should have 'companies' field"
        print(f"✓ GET /api/companies with search: Found {len(data['companies'])} matching companies")
    
    def test_list_companies_pagination(self, auth_headers):
        """GET /api/companies should support pagination"""
        response = session.get(f"{BASE_URL}/api/companies?limit=5&skip=0", headers=auth_headers)
        
        assert response.status_code == 200, f"Pagination failed: {response.text}"
        data = response.json()
        
        assert data["limit"] == 5, "Limit should be respected"
        assert data["skip"] == 0, "Skip should be respected"
        print(f"✓ GET /api/companies pagination works - limit={data['limit']}, skip={data['skip']}")


class TestCompaniesSearchEndpoint:
    """Test GET /api/companies/search - Search companies endpoint"""
    
    def test_search_companies_returns_200(self, auth_headers):
        """GET /api/companies/search?q=test should return 200"""
        response = session.get(f"{BASE_URL}/api/companies/search?q=test", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "companies" in data, "Response should have 'companies' field"
        assert isinstance(data["companies"], list), "Companies should be a list"
        print(f"✓ GET /api/companies/search?q=test: Found {len(data['companies'])} matching companies")
    
    def test_search_companies_minimum_query(self, auth_headers):
        """GET /api/companies/search with 1 char should return empty (min 2 chars)"""
        response = session.get(f"{BASE_URL}/api/companies/search?q=a", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200: {response.text}"
        data = response.json()
        
        assert data.get("companies") == [], "Single char query should return empty"
        print(f"✓ GET /api/companies/search single char returns empty as expected")
    
    def test_search_companies_exclude_id(self, auth_headers):
        """GET /api/companies/search with exclude_id should work"""
        response = session.get(f"{BASE_URL}/api/companies/search?q=company&exclude_id=fake_id_123", headers=auth_headers)
        
        assert response.status_code == 200, f"Exclude ID failed: {response.text}"
        data = response.json()
        
        # Should not contain company with exclude_id
        for company in data["companies"]:
            assert company.get("id") != "fake_id_123", "Excluded ID should not appear"
        print(f"✓ GET /api/companies/search with exclude_id works")


class TestCompanyDetailEndpoint:
    """Test GET /api/companies/{id}/detail - Company detail endpoint"""
    
    def test_company_detail_with_real_company(self, auth_headers):
        """GET /api/companies/{id}/detail should return company details"""
        # First get a valid company ID
        list_response = session.get(f"{BASE_URL}/api/companies?limit=1", headers=auth_headers)
        assert list_response.status_code == 200, f"Failed to get companies list: {list_response.text}"
        
        companies = list_response.json().get("companies", [])
        if not companies:
            pytest.skip("No companies available for detail test")
        
        company_id = companies[0].get("id") or companies[0].get("hs_object_id") or companies[0].get("hubspot_id")
        assert company_id, "Company should have an ID"
        
        # Get detail
        response = session.get(f"{BASE_URL}/api/companies/{company_id}/detail", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "company" in data, "Response should have 'company' field"
        assert "contacts" in data, "Response should have 'contacts' field"
        assert "cases" in data, "Response should have 'cases' field"
        assert "stats" in data, "Response should have 'stats' field"
        print(f"✓ GET /api/companies/{company_id}/detail: Got company '{data['company'].get('name')}'")
    
    def test_company_detail_not_found(self, auth_headers):
        """GET /api/companies/{id}/detail with invalid ID should return 404"""
        response = session.get(f"{BASE_URL}/api/companies/invalid_company_id_12345/detail", headers=auth_headers)
        
        assert response.status_code == 404, f"Expected 404 for invalid company, got {response.status_code}"
        print(f"✓ GET /api/companies/invalid_id/detail returns 404 as expected")


class TestCreateCompanyEndpoint:
    """Test POST /api/companies - Create company endpoint"""
    
    def test_create_company_success(self, auth_headers):
        """POST /api/companies should create a new company"""
        unique_name = f"{TEST_PREFIX}Company_{uuid.uuid4().hex[:8]}"
        
        response = session.post(f"{BASE_URL}/api/companies", headers=auth_headers, json={
            "name": unique_name,
            "domain": "test-migration.example.com",
            "industry": "Test Migration Industry"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") is True, "Success should be True"
        assert data.get("created") is True, "Created should be True for new company"
        assert data.get("company", {}).get("name") == unique_name, "Company name should match"
        print(f"✓ POST /api/companies: Created company '{unique_name}'")
        
        return data.get("company", {}).get("id")
    
    def test_create_company_duplicate_returns_existing(self, auth_headers):
        """POST /api/companies with existing name should return existing company"""
        # First create a company
        unique_name = f"{TEST_PREFIX}Duplicate_{uuid.uuid4().hex[:8]}"
        
        first_response = session.post(f"{BASE_URL}/api/companies", headers=auth_headers, json={
            "name": unique_name
        })
        assert first_response.status_code == 200, f"First creation failed: {first_response.text}"
        first_data = first_response.json()
        assert first_data.get("created") is True
        
        # Try to create again with same name
        second_response = session.post(f"{BASE_URL}/api/companies", headers=auth_headers, json={
            "name": unique_name
        })
        assert second_response.status_code == 200, f"Second creation failed: {second_response.text}"
        second_data = second_response.json()
        
        assert second_data.get("created") is False, "Should return existing company"
        assert "already exists" in second_data.get("message", "").lower(), "Message should indicate duplicate"
        print(f"✓ POST /api/companies: Duplicate company returns existing as expected")


class TestUpdateCompanyEndpoint:
    """Test PUT /api/companies/{id} - Update company endpoint"""
    
    def test_update_company_success(self, auth_headers):
        """PUT /api/companies/{id} should update company"""
        # First create a company to update
        unique_name = f"{TEST_PREFIX}Update_{uuid.uuid4().hex[:8]}"
        create_response = session.post(f"{BASE_URL}/api/companies", headers=auth_headers, json={
            "name": unique_name
        })
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        company_id = create_response.json().get("company", {}).get("id")
        assert company_id, "Company ID should be returned"
        
        # Update the company
        new_industry = "Updated Test Industry"
        update_response = session.put(f"{BASE_URL}/api/companies/{company_id}", headers=auth_headers, json={
            "industry": new_industry
        })
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        update_data = update_response.json()
        
        assert update_data.get("success") is True, "Success should be True"
        print(f"✓ PUT /api/companies/{company_id}: Updated company industry")
    
    def test_update_company_not_found(self, auth_headers):
        """PUT /api/companies/{id} with invalid ID should return 404"""
        response = session.put(f"{BASE_URL}/api/companies/invalid_company_id_12345", headers=auth_headers, json={
            "industry": "Should Fail"
        })
        
        assert response.status_code == 404, f"Expected 404 for invalid company, got {response.status_code}"
        print(f"✓ PUT /api/companies/invalid_id returns 404 as expected")


class TestMergeCandidatesSemaphore:
    """Test GET /api/companies/merge-candidates/semaphore endpoint"""
    
    def test_semaphore_returns_valid_status(self, auth_headers):
        """GET /api/companies/merge-candidates/semaphore should return valid status"""
        response = session.get(f"{BASE_URL}/api/companies/merge-candidates/semaphore", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check required fields
        assert "status" in data, "Response should have 'status' field"
        assert data["status"] in ["red", "yellow", "green", "gray"], f"Status should be valid, got {data['status']}"
        assert "pending_count" in data, "Response should have 'pending_count' field"
        assert "iso_year" in data, "Response should have 'iso_year' field"
        assert "iso_week" in data, "Response should have 'iso_week' field"
        
        print(f"✓ GET /api/companies/merge-candidates/semaphore: status={data['status']}, pending={data['pending_count']}")


class TestMergeCandidatesCacheStatus:
    """Test GET /api/companies/merge-candidates/cache-status endpoint"""
    
    def test_cache_status_returns_valid_data(self, auth_headers):
        """GET /api/companies/merge-candidates/cache-status should return cache info"""
        response = session.get(f"{BASE_URL}/api/companies/merge-candidates/cache-status", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check required fields
        assert "cache_exists" in data, "Response should have 'cache_exists' field"
        assert "domain_count" in data, "Response should have 'domain_count' field"
        assert "name_count" in data, "Response should have 'name_count' field"
        assert "total_count" in data, "Response should have 'total_count' field"
        assert "needs_refresh" in data, "Response should have 'needs_refresh' field"
        
        print(f"✓ GET /api/companies/merge-candidates/cache-status: cache_exists={data['cache_exists']}, total={data['total_count']}")


class TestTrafficLightStatus:
    """Test GET /api/focus/traffic-light-status for merge-companies section"""
    
    def test_traffic_light_includes_merge_companies(self, auth_headers):
        """GET /api/focus/traffic-light-status should include merge-companies section"""
        response = session.get(f"{BASE_URL}/api/focus/traffic-light-status", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check merge-companies section exists
        assert "merge-companies" in data, "Response should have 'merge-companies' section"
        merge_status = data["merge-companies"]
        
        # Status should be valid
        assert merge_status in ["red", "yellow", "green", "gray"], f"merge-companies status should be valid, got {merge_status}"
        
        print(f"✓ GET /api/focus/traffic-light-status: merge-companies={merge_status}")


class TestAdditionalCompanyEndpoints:
    """Test additional company endpoints to ensure migration completeness"""
    
    def test_auto_merge_preview(self, auth_headers):
        """GET /api/companies/auto-merge/preview should work"""
        response = session.get(f"{BASE_URL}/api/companies/auto-merge/preview?limit=5", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "duplicate_domain_groups" in data, "Response should have duplicate_domain_groups"
        assert "groups" in data, "Response should have groups field"
        print(f"✓ GET /api/companies/auto-merge/preview: {data['duplicate_domain_groups']} domain groups found")
    
    def test_auto_merge_stats(self, auth_headers):
        """GET /api/companies/auto-merge/stats should work"""
        response = session.get(f"{BASE_URL}/api/companies/auto-merge/stats", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "duplicate_domain_groups" in data, "Response should have duplicate_domain_groups"
        assert "potential_merges" in data, "Response should have potential_merges"
        print(f"✓ GET /api/companies/auto-merge/stats: {data['potential_merges']} potential merges")
    
    def test_admin_find_duplicates(self, auth_headers):
        """GET /api/companies/admin/find-duplicates should work"""
        response = session.get(f"{BASE_URL}/api/companies/admin/find-duplicates?limit=5", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "total_groups" in data, "Response should have total_groups"
        assert "groups" in data, "Response should have groups"
        print(f"✓ GET /api/companies/admin/find-duplicates: {data['total_groups']} duplicate groups found")
    
    def test_domain_duplicates_endpoint(self, auth_headers):
        """GET /api/companies/merge-candidates/domain-duplicates should work"""
        response = session.get(f"{BASE_URL}/api/companies/merge-candidates/domain-duplicates?limit=5", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "groups" in data, "Response should have groups"
        assert "total" in data, "Response should have total"
        print(f"✓ GET /api/companies/merge-candidates/domain-duplicates: {data['total']} groups")
    
    def test_similar_names_endpoint(self, auth_headers):
        """GET /api/companies/merge-candidates/similar-names should work"""
        response = session.get(f"{BASE_URL}/api/companies/merge-candidates/similar-names?limit=5", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "groups" in data, "Response should have groups"
        assert "total" in data, "Response should have total"
        print(f"✓ GET /api/companies/merge-candidates/similar-names: {data['total']} groups")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
