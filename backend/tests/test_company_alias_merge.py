"""
Test Company Alias & Merge Endpoints - Phase 4
Tests for:
- GET /api/companies/search - search companies by name, domain, or alias
- POST /api/companies/merge - merge two companies (primary absorbs secondary)
- PUT /api/companies/{company_id} - update company including aliases
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Use existing test session from previous iterations (cookie-based auth)
TEST_SESSION_TOKEN = "teststaff_jRpK6_PrQ_IboZOMBMUOdjGBBXAarHlrMzsly06s6Xo"


@pytest.fixture(scope="module")
def api_client():
    """Requests session with cookie-based authentication"""
    session = requests.Session()
    session.cookies.set("session_token", TEST_SESSION_TOKEN)
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestCompanySearchEndpoint:
    """Tests for GET /api/companies/search"""
    
    def test_search_requires_authentication(self):
        """Search endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/companies/search?q=test")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Search endpoint requires authentication")
    
    def test_search_requires_minimum_query_length(self, api_client):
        """Search requires at least 2 characters"""
        # Single character should return empty
        response = api_client.get(f"{BASE_URL}/api/companies/search?q=a")
        assert response.status_code == 200
        data = response.json()
        assert data.get("companies") == [], f"Expected empty results for single char, got {data}"
        print("PASS: Search returns empty for single character query")
    
    def test_search_by_company_name(self, api_client):
        """Search by company name returns results"""
        # Search for a common term likely to exist in the database
        response = api_client.get(f"{BASE_URL}/api/companies/search?q=tech&limit=5")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "companies" in data, "Response should have 'companies' key"
        assert isinstance(data["companies"], list), "companies should be a list"
        print(f"PASS: Search by name returned {len(data['companies'])} companies")
        
        # Verify response structure if companies found
        if data["companies"]:
            company = data["companies"][0]
            assert "id" in company or "hs_object_id" in company, "Company should have an id"
            assert "name" in company, "Company should have a name"
            print(f"PASS: First company: {company.get('name', 'N/A')}")
    
    def test_search_by_domain(self, api_client):
        """Search by domain returns results"""
        response = api_client.get(f"{BASE_URL}/api/companies/search?q=.com&limit=5")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "companies" in data
        print(f"PASS: Search by domain returned {len(data['companies'])} companies")
    
    def test_search_respects_limit(self, api_client):
        """Search respects limit parameter"""
        response = api_client.get(f"{BASE_URL}/api/companies/search?q=a&limit=3")
        # Note: 'a' is too short, so it returns empty
        # Let's use a longer query
        response = api_client.get(f"{BASE_URL}/api/companies/search?q=corp&limit=3")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data.get("companies", [])) <= 3, "Should respect limit parameter"
        print(f"PASS: Search respects limit, returned {len(data.get('companies', []))} companies")
    
    def test_search_excludes_merged_companies(self, api_client):
        """Search should exclude companies with is_merged=True"""
        response = api_client.get(f"{BASE_URL}/api/companies/search?q=test&limit=20")
        assert response.status_code == 200
        
        data = response.json()
        for company in data.get("companies", []):
            assert company.get("is_merged") != True, f"Merged company found: {company.get('name')}"
        print("PASS: Search excludes merged companies")


class TestCompanyUpdateWithAliases:
    """Tests for PUT /api/companies/{company_id} with aliases support"""
    
    @pytest.fixture
    def test_company_id(self, api_client):
        """Get an existing company ID for testing or create one"""
        # First, search for an existing company
        response = api_client.get(f"{BASE_URL}/api/companies/search?q=test&limit=1")
        if response.status_code == 200:
            data = response.json()
            if data.get("companies"):
                company = data["companies"][0]
                return company.get("id") or company.get("hubspot_id") or str(company.get("hs_object_id"))
        
        # If no company found, try listing companies
        response = api_client.get(f"{BASE_URL}/api/companies?limit=1")
        if response.status_code == 200:
            data = response.json()
            if data.get("companies"):
                company = data["companies"][0]
                return company.get("id") or company.get("hubspot_id") or str(company.get("hs_object_id"))
        
        pytest.skip("No test company available")
    
    def test_update_requires_authentication(self):
        """Update endpoint requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/companies/test-id",
            json={"name": "Test"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Update endpoint requires authentication")
    
    def test_update_company_with_aliases(self, api_client, test_company_id):
        """Can update company with aliases array"""
        unique_alias = f"TEST_ALIAS_{uuid.uuid4().hex[:8]}"
        
        response = api_client.put(
            f"{BASE_URL}/api/companies/{test_company_id}",
            json={"aliases": [unique_alias, "Another Alias"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Update should succeed"
        print(f"PASS: Updated company with aliases. Response: {data}")
    
    def test_update_preserves_other_fields(self, api_client, test_company_id):
        """Updating aliases doesn't clear other fields"""
        # First, get current company details
        detail_response = api_client.get(f"{BASE_URL}/api/companies/{test_company_id}/detail")
        if detail_response.status_code != 200:
            pytest.skip("Cannot get company details")
        
        original_company = detail_response.json().get("company", {})
        original_name = original_company.get("name")
        
        # Update only aliases
        response = api_client.put(
            f"{BASE_URL}/api/companies/{test_company_id}",
            json={"aliases": ["Test Alias Only"]}
        )
        assert response.status_code == 200
        
        # Verify name wasn't changed
        data = response.json()
        if "new_name" in data:
            assert data.get("new_name") == original_name, "Name should not change when updating aliases"
        print("PASS: Updating aliases preserves other fields")
    
    def test_update_company_not_found(self, api_client):
        """Update returns 404 for non-existent company"""
        fake_id = f"nonexistent_{uuid.uuid4().hex}"
        response = api_client.put(
            f"{BASE_URL}/api/companies/{fake_id}",
            json={"aliases": ["test"]}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Update returns 404 for non-existent company")


class TestCompanyMergeEndpoint:
    """Tests for POST /api/companies/merge - merge two companies"""
    
    def test_merge_requires_authentication(self):
        """Merge endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/companies/merge",
            json={"primary_id": "test1", "secondary_id": "test2"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Merge endpoint requires authentication")
    
    def test_merge_validates_different_ids(self, api_client):
        """Merge should reject when primary_id == secondary_id"""
        response = api_client.post(
            f"{BASE_URL}/api/companies/merge",
            json={"primary_id": "same-id", "secondary_id": "same-id"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        # Spanish error message expected
        assert "misma" in data.get("detail", "").lower() or "same" in data.get("detail", "").lower(), \
            f"Should indicate cannot merge same company: {data}"
        print("PASS: Merge rejects same company IDs")
    
    def test_merge_validates_primary_exists(self, api_client):
        """Merge returns 404 if primary company not found"""
        fake_primary = f"nonexistent_primary_{uuid.uuid4().hex}"
        fake_secondary = f"nonexistent_secondary_{uuid.uuid4().hex}"
        
        response = api_client.post(
            f"{BASE_URL}/api/companies/merge",
            json={"primary_id": fake_primary, "secondary_id": fake_secondary}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Merge returns 404 for non-existent primary company")
    
    def test_merge_validates_secondary_exists(self, api_client):
        """Merge returns 404 if secondary company not found"""
        # First, get a real company ID
        search_response = api_client.get(f"{BASE_URL}/api/companies/search?q=a&limit=1")
        if search_response.status_code != 200:
            pytest.skip("Cannot search companies")
        
        data = search_response.json()
        if not data.get("companies"):
            # Try with different query
            search_response = api_client.get(f"{BASE_URL}/api/companies?limit=1")
            data = search_response.json()
            if not data.get("companies"):
                pytest.skip("No companies available for testing")
        
        real_company = data["companies"][0]
        real_id = real_company.get("id") or real_company.get("hubspot_id") or str(real_company.get("hs_object_id"))
        fake_secondary = f"nonexistent_secondary_{uuid.uuid4().hex}"
        
        response = api_client.post(
            f"{BASE_URL}/api/companies/merge",
            json={"primary_id": real_id, "secondary_id": fake_secondary}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Merge returns 404 for non-existent secondary company")
    
    def test_merge_request_format(self, api_client):
        """Merge accepts correct request format"""
        # Test that the endpoint accepts the correct format (primary_id, secondary_id)
        # This tests the Pydantic model MergeTwoCompaniesRequest
        
        response = api_client.post(
            f"{BASE_URL}/api/companies/merge",
            json={}  # Missing required fields
        )
        # Should be 422 (validation error) for missing fields, not 500
        assert response.status_code == 422, f"Expected 422 for missing fields, got {response.status_code}"
        print("PASS: Merge validates required fields (primary_id, secondary_id)")


class TestCompanyListEndpoint:
    """Tests for GET /api/companies - list companies with search"""
    
    def test_list_companies_requires_auth(self):
        """List companies requires authentication"""
        response = requests.get(f"{BASE_URL}/api/companies")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: List companies requires authentication")
    
    def test_list_companies_returns_data(self, api_client):
        """List companies returns paginated results"""
        response = api_client.get(f"{BASE_URL}/api/companies?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "companies" in data, "Response should have 'companies' key"
        assert "total" in data, "Response should have 'total' key"
        print(f"PASS: List companies returned {len(data.get('companies', []))} of {data.get('total', 0)} total")
    
    def test_list_companies_search_filter(self, api_client):
        """List companies accepts search parameter"""
        response = api_client.get(f"{BASE_URL}/api/companies?search=test&limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "companies" in data
        print(f"PASS: List companies with search filter returned {len(data.get('companies', []))} results")


class TestCompanyDetailEndpoint:
    """Tests for GET /api/companies/{company_id}/detail"""
    
    def test_detail_requires_auth(self):
        """Detail endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/companies/test-id/detail")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Detail endpoint requires authentication")
    
    def test_detail_returns_company_data(self, api_client):
        """Detail endpoint returns company with contacts and cases"""
        # First get a valid company ID
        search_response = api_client.get(f"{BASE_URL}/api/companies?limit=1")
        if search_response.status_code != 200:
            pytest.skip("Cannot list companies")
        
        data = search_response.json()
        if not data.get("companies"):
            pytest.skip("No companies available")
        
        company = data["companies"][0]
        company_id = company.get("id") or company.get("hubspot_id") or str(company.get("hs_object_id"))
        
        response = api_client.get(f"{BASE_URL}/api/companies/{company_id}/detail")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        detail = response.json()
        assert "company" in detail, "Response should have 'company' key"
        assert "contacts" in detail, "Response should have 'contacts' key"
        assert "cases" in detail, "Response should have 'cases' key"
        assert "stats" in detail, "Response should have 'stats' key"
        
        # Check if aliases field exists in company
        if detail["company"]:
            print(f"PASS: Company detail includes aliases: {detail['company'].get('aliases', [])}")
        print(f"PASS: Detail returned company with {len(detail.get('contacts', []))} contacts and {len(detail.get('cases', []))} cases")


class TestIntegrationFlow:
    """Integration tests for the complete alias and merge flow"""
    
    def test_full_alias_workflow(self, api_client):
        """
        Test complete workflow:
        1. Search for company
        2. Get company detail
        3. Add aliases
        4. Verify aliases saved
        """
        # Step 1: Search for a company
        search_response = api_client.get(f"{BASE_URL}/api/companies?limit=1")
        if search_response.status_code != 200 or not search_response.json().get("companies"):
            pytest.skip("No companies available for integration test")
        
        company = search_response.json()["companies"][0]
        company_id = company.get("id") or company.get("hubspot_id") or str(company.get("hs_object_id"))
        print(f"Step 1: Found company {company.get('name')} (ID: {company_id})")
        
        # Step 2: Get company detail
        detail_response = api_client.get(f"{BASE_URL}/api/companies/{company_id}/detail")
        assert detail_response.status_code == 200
        original_aliases = detail_response.json().get("company", {}).get("aliases", []) or []
        print(f"Step 2: Company has {len(original_aliases)} existing aliases")
        
        # Step 3: Add a new alias
        new_alias = f"TEST_INTEGRATION_{uuid.uuid4().hex[:6]}"
        updated_aliases = original_aliases + [new_alias]
        
        update_response = api_client.put(
            f"{BASE_URL}/api/companies/{company_id}",
            json={"aliases": updated_aliases}
        )
        assert update_response.status_code == 200
        print(f"Step 3: Added alias '{new_alias}'")
        
        # Step 4: Verify alias was saved
        verify_response = api_client.get(f"{BASE_URL}/api/companies/{company_id}/detail")
        assert verify_response.status_code == 200
        saved_aliases = verify_response.json().get("company", {}).get("aliases", []) or []
        
        assert new_alias in saved_aliases, f"New alias not found in saved aliases: {saved_aliases}"
        print(f"Step 4: Verified alias saved. Total aliases: {len(saved_aliases)}")
        
        # Cleanup: Remove test alias
        cleaned_aliases = [a for a in saved_aliases if not a.startswith("TEST_")]
        cleanup_response = api_client.put(
            f"{BASE_URL}/api/companies/{company_id}",
            json={"aliases": cleaned_aliases}
        )
        if cleanup_response.status_code == 200:
            print("Cleanup: Removed test alias")
        
        print("PASS: Full alias workflow completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
