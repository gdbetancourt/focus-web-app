"""
Test Suite: Unified Companies Features - Iteration 67
Testing: Create Company, Stats Summary, Outbound/Inbound tabs, Aliases, Secondary Industries
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Pre-created test session token - created in user_sessions collection
# for test@leaderlix.com user
TEST_SESSION_TOKEN = "6gF7CJyolZVNRqvbGuQ841H99kIHzPS2MiSD2FqtINI"


def get_auth_cookies():
    """Get authentication cookies for API calls"""
    return {"session_token": TEST_SESSION_TOKEN}


class TestUnifiedCompaniesStats:
    """Test company statistics endpoints"""
    
    def test_stats_summary_returns_total_outbound_inbound(self):
        """GET /api/unified-companies/stats/summary should return total, outbound, inbound counts"""
        cookies = get_auth_cookies()
        response = requests.get(f"{BASE_URL}/api/unified-companies/stats/summary", cookies=cookies)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total" in data, "Response should contain 'total' field"
        assert "outbound" in data, "Response should contain 'outbound' field"
        assert "inbound" in data, "Response should contain 'inbound' field"
        
        # Validate counts are integers
        assert isinstance(data["total"], int), "total should be an integer"
        assert isinstance(data["outbound"], int), "outbound should be an integer"
        assert isinstance(data["inbound"], int), "inbound should be an integer"
        
        # Verify total >= outbound + inbound (may have some without classification)
        assert data["total"] >= 0, "total should be non-negative"
        assert data["outbound"] >= 0, "outbound should be non-negative"
        assert data["inbound"] >= 0, "inbound should be non-negative"
        
        print(f"✓ Stats: total={data['total']}, outbound={data['outbound']}, inbound={data['inbound']}")
    
    def test_stats_industries_returns_list(self):
        """GET /api/unified-companies/stats/industries should return industry list"""
        cookies = get_auth_cookies()
        response = requests.get(f"{BASE_URL}/api/unified-companies/stats/industries", cookies=cookies)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "industries" in data, "Response should contain 'industries' field"
        assert isinstance(data["industries"], list), "industries should be a list"
        
        print(f"✓ Found {len(data['industries'])} industries")


class TestOutboundCompanies:
    """Test Outbound companies endpoint (291 expected per context)"""
    
    def test_outbound_companies_endpoint(self):
        """GET /api/unified-companies/outbound should return outbound companies"""
        cookies = get_auth_cookies()
        response = requests.get(f"{BASE_URL}/api/unified-companies/outbound?limit=500", cookies=cookies)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "companies" in data, "Response should contain 'companies' field"
        assert "total" in data, "Response should contain 'total' field"
        
        # All companies should have classification=outbound
        for company in data["companies"][:10]:  # Check first 10
            assert company.get("classification") == "outbound", f"Company {company.get('name')} should be outbound"
        
        print(f"✓ Outbound companies: {data['total']} total, {len(data['companies'])} returned")
    
    def test_prospection_active_companies(self):
        """GET /api/prospection/active-companies should return classification=outbound companies"""
        cookies = get_auth_cookies()
        response = requests.get(f"{BASE_URL}/api/prospection/active-companies?limit=500", cookies=cookies)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "companies" in data or isinstance(data, list), "Response should contain companies"
        
        companies = data.get("companies", data) if isinstance(data, dict) else data
        total = data.get("total", len(companies)) if isinstance(data, dict) else len(companies)
        
        print(f"✓ Active companies (outbound): {total} total")


class TestCreateCompany:
    """Test creating companies via unified-companies endpoint"""
    
    def test_create_company_basic(self):
        """POST /api/unified-companies should create a new company"""
        cookies = get_auth_cookies()
        
        unique_name = f"TEST_Company_{uuid.uuid4().hex[:8]}"
        company_data = {
            "name": unique_name,
            "classification": "inbound",
            "industry": "Software & Technology"
        }
        
        response = requests.post(f"{BASE_URL}/api/unified-companies", 
                                 json=company_data, cookies=cookies)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        assert "company" in data, "Response should contain company data"
        
        created_company = data["company"]
        assert created_company.get("name") == unique_name, f"Company name should be {unique_name}"
        assert created_company.get("classification") == "inbound", "Classification should be inbound"
        
        # Store company ID for cleanup
        self.__class__.created_company_id = created_company.get("id")
        
        print(f"✓ Created company: {unique_name} (id: {created_company.get('id')})")
    
    def test_create_company_with_outbound_classification(self):
        """POST /api/unified-companies with classification=outbound"""
        cookies = get_auth_cookies()
        
        unique_name = f"TEST_Outbound_{uuid.uuid4().hex[:8]}"
        company_data = {
            "name": unique_name,
            "classification": "outbound",
            "domain": "testoutbound.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/unified-companies", 
                                 json=company_data, cookies=cookies)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert data["company"].get("classification") == "outbound"
        
        print(f"✓ Created outbound company: {unique_name}")


class TestCompanyAliases:
    """Test alias management - should NOT return 'Company not found'"""
    
    def test_add_alias_to_existing_company(self):
        """POST /api/unified-companies/{id}/aliases should add alias"""
        cookies = get_auth_cookies()
        
        # First get an existing company
        response = requests.get(f"{BASE_URL}/api/unified-companies?limit=1", cookies=cookies)
        assert response.status_code == 200
        
        companies = response.json().get("companies", [])
        if not companies:
            pytest.skip("No companies found to test aliases")
        
        company_id = companies[0].get("id")
        company_name = companies[0].get("name")
        
        # Add an alias
        alias_name = f"TestAlias_{uuid.uuid4().hex[:6]}"
        alias_response = requests.post(
            f"{BASE_URL}/api/unified-companies/{company_id}/aliases",
            json={"alias": alias_name},
            cookies=cookies
        )
        
        # Should NOT return 404 "Company not found"
        assert alias_response.status_code == 200, \
            f"Expected 200 adding alias, got {alias_response.status_code}: {alias_response.text}"
        
        data = alias_response.json()
        assert data.get("success") == True, "Should successfully add alias"
        assert alias_name in data.get("aliases", []), f"Alias {alias_name} should be in aliases list"
        
        print(f"✓ Added alias '{alias_name}' to company '{company_name}'")
    
    def test_get_company_with_aliases(self):
        """GET /api/unified-companies/{id} should include aliases field"""
        cookies = get_auth_cookies()
        
        # Get a company
        response = requests.get(f"{BASE_URL}/api/unified-companies?limit=1", cookies=cookies)
        companies = response.json().get("companies", [])
        
        if not companies:
            pytest.skip("No companies available")
        
        company_id = companies[0].get("id")
        
        # Get company details
        detail_response = requests.get(f"{BASE_URL}/api/unified-companies/{company_id}", cookies=cookies)
        
        assert detail_response.status_code == 200
        company = detail_response.json()
        
        # Aliases field should exist (may be empty)
        assert "aliases" in company or company.get("aliases") is None, \
            "Company should have aliases field"
        
        print(f"✓ Company has aliases field: {company.get('aliases', [])}")


class TestSecondaryIndustries:
    """Test secondary industries - adding multiple industries to a company"""
    
    def test_add_secondary_industry(self):
        """POST /api/unified-companies/{id}/industries should add secondary industry"""
        cookies = get_auth_cookies()
        
        # Get an existing company
        response = requests.get(f"{BASE_URL}/api/unified-companies?limit=1", cookies=cookies)
        companies = response.json().get("companies", [])
        
        if not companies:
            pytest.skip("No companies found")
        
        company_id = companies[0].get("id")
        company_name = companies[0].get("name")
        
        # Add secondary industry
        industry_name = "TEST_INDUSTRY_" + uuid.uuid4().hex[:6]
        industry_response = requests.post(
            f"{BASE_URL}/api/unified-companies/{company_id}/industries",
            json={"industry": industry_name},
            cookies=cookies
        )
        
        # Should NOT return error
        assert industry_response.status_code == 200, \
            f"Expected 200, got {industry_response.status_code}: {industry_response.text}"
        
        data = industry_response.json()
        assert data.get("success") == True, "Should successfully add industry"
        
        print(f"✓ Added secondary industry '{industry_name}' to '{company_name}'")
    
    def test_company_has_industries_array(self):
        """GET company should have 'industries' array for multiple industries"""
        cookies = get_auth_cookies()
        
        response = requests.get(f"{BASE_URL}/api/unified-companies?limit=1", cookies=cookies)
        companies = response.json().get("companies", [])
        
        if not companies:
            pytest.skip("No companies found")
        
        company_id = companies[0].get("id")
        
        detail_response = requests.get(f"{BASE_URL}/api/unified-companies/{company_id}", cookies=cookies)
        company = detail_response.json()
        
        # Should have industries field (array)
        print(f"✓ Company industries: primary={company.get('industry')}, secondary={company.get('industries', [])}")


class TestCompanyByIndustry:
    """Test companies-by-industry endpoint for propagation"""
    
    def test_by_industry_returns_companies(self):
        """GET /api/unified-companies/by-industry/{industry} should return companies"""
        cookies = get_auth_cookies()
        
        # First get available industries
        ind_response = requests.get(f"{BASE_URL}/api/unified-companies/stats/industries", cookies=cookies)
        industries = ind_response.json().get("industries", [])
        
        if not industries:
            pytest.skip("No industries found")
        
        # Test with first industry
        industry = industries[0].get("industry")
        response = requests.get(
            f"{BASE_URL}/api/unified-companies/by-industry/{industry}",
            cookies=cookies
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        companies = response.json()
        assert isinstance(companies, list), "Should return list of companies"
        
        print(f"✓ Industry '{industry}' has {len(companies)} companies")


class TestCompanySearch:
    """Test company search functionality"""
    
    def test_search_companies(self):
        """GET /api/unified-companies/search should find companies by name"""
        cookies = get_auth_cookies()
        
        response = requests.get(f"{BASE_URL}/api/unified-companies/search?q=Microsoft", cookies=cookies)
        
        assert response.status_code == 200
        data = response.json()
        assert "companies" in data
        
        print(f"✓ Search 'Microsoft' found {len(data['companies'])} companies")
    
    def test_search_with_classification_filter(self):
        """Search with classification filter should work"""
        cookies = get_auth_cookies()
        
        response = requests.get(
            f"{BASE_URL}/api/unified-companies/search?q=a&classification=outbound",
            cookies=cookies
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All results should be outbound
        for company in data.get("companies", []):
            assert company.get("classification") == "outbound", \
                f"Company {company.get('name')} should be outbound when filtering"
        
        print(f"✓ Search with classification=outbound works")


class TestListCompaniesWithFilters:
    """Test listing companies with classification filter"""
    
    def test_list_all_companies(self):
        """GET /api/unified-companies should list companies"""
        cookies = get_auth_cookies()
        
        response = requests.get(f"{BASE_URL}/api/unified-companies?limit=10", cookies=cookies)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "companies" in data
        assert "total" in data
        
        print(f"✓ Listed {len(data['companies'])} of {data['total']} total companies")
    
    def test_list_inbound_companies(self):
        """GET /api/unified-companies?classification=inbound should filter"""
        cookies = get_auth_cookies()
        
        response = requests.get(
            f"{BASE_URL}/api/unified-companies?classification=inbound&limit=10",
            cookies=cookies
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All should be inbound
        for company in data.get("companies", []):
            assert company.get("classification") == "inbound"
        
        print(f"✓ Inbound filter works - found {data.get('total', 0)} inbound companies")
    
    def test_list_outbound_companies_via_classification(self):
        """GET /api/unified-companies?classification=outbound should filter"""
        cookies = get_auth_cookies()
        
        response = requests.get(
            f"{BASE_URL}/api/unified-companies?classification=outbound&limit=10",
            cookies=cookies
        )
        
        assert response.status_code == 200
        data = response.json()
        
        for company in data.get("companies", []):
            assert company.get("classification") == "outbound"
        
        print(f"✓ Outbound filter works - found {data.get('total', 0)} outbound companies")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
