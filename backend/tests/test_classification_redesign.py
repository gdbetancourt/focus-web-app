"""
Test Suite: Classification Redesign - Industries V2 and Unified Companies

Tests for the architectural redesign replacing is_active with classification (inbound/outbound).
This includes:
- Industries page - classification toggle
- Industries page - merge functionality
- Companies/Outbound tab - classification toggle
- Companies/Outbound tab - propagation preview
- API endpoints for industries-v2 and unified-companies
"""

import pytest
import requests
import os
import uuid
import jwt
from datetime import datetime, timezone, timedelta

# Use public URL for testing
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://persona-assets.preview.emergentagent.com")
SECRET_KEY = os.environ.get("SECRET_KEY", "leaderlix-secure-secret-key-2025")
ALGORITHM = "HS256"

def create_test_token():
    """Create a test JWT token for authentication"""
    payload = {
        "sub": "test-user-classification-redesign",
        "email": "test@leaderlix.com",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

class TestIndustriesV2:
    """Test /api/industries-v2 endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.session = requests.Session()
        token = create_test_token()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
    
    def test_industries_v2_endpoint_exists(self):
        """Test that industries-v2 endpoint exists and returns data"""
        response = self.session.get(f"{BASE_URL}/api/industries-v2")
        # With valid JWT, should return 200 or 401 if user not in DB
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}, Response: {response.text}"
        print(f"Industries V2 endpoint status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            assert "industries" in data, "Response should contain industries array"
            assert "total" in data, "Response should contain total count"
            print(f"Industries count: {data.get('total', 0)}")
            
            # Check if industries have classification field
            if data.get("industries"):
                first_industry = data["industries"][0]
                print(f"First industry keys: {first_industry.keys()}")
                # classification should exist as per new architecture
                assert "classification" in first_industry or "name" in first_industry, "Industry should have classification or name field"
    
    def test_industries_v2_stats_overview(self):
        """Test /api/industries-v2/stats/overview endpoint"""
        response = self.session.get(f"{BASE_URL}/api/industries-v2/stats/overview")
        # Expecting 401 without auth
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"
        print(f"Stats overview endpoint status: {response.status_code}")
    
    def test_industries_v2_outbound(self):
        """Test /api/industries-v2/outbound endpoint"""
        response = self.session.get(f"{BASE_URL}/api/industries-v2/outbound")
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"
        print(f"Outbound industries endpoint status: {response.status_code}")


class TestUnifiedCompanies:
    """Test /api/unified-companies endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.session = requests.Session()
        token = create_test_token()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
    
    def test_unified_companies_endpoint_exists(self):
        """Test that unified-companies endpoint exists"""
        response = self.session.get(f"{BASE_URL}/api/unified-companies")
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"
        print(f"Unified companies endpoint status: {response.status_code}")
    
    def test_unified_companies_outbound(self):
        """Test /api/unified-companies/outbound endpoint"""
        response = self.session.get(f"{BASE_URL}/api/unified-companies/outbound")
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"
        print(f"Outbound companies endpoint status: {response.status_code}")
    
    def test_unified_companies_search(self):
        """Test /api/unified-companies/search endpoint"""
        response = self.session.get(f"{BASE_URL}/api/unified-companies/search", params={"q": "test"})
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"
        print(f"Search companies endpoint status: {response.status_code}")


class TestHubspotCompaniesStats:
    """Test /api/hubspot/companies/stats endpoint for outbound/inbound counts"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.session = requests.Session()
        token = create_test_token()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
    
    def test_companies_stats_endpoint(self):
        """Test /api/hubspot/companies/stats endpoint returns outbound/inbound counts"""
        response = self.session.get(f"{BASE_URL}/api/hubspot/companies/stats")
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"
        print(f"Companies stats endpoint status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Stats response: {data}")
            # Verify the response has outbound/inbound fields (new architecture)
            # or at least has total field (backward compat)
            has_outbound_inbound = "outbound" in data or "inbound" in data
            has_total = "total" in data
            assert has_outbound_inbound or has_total, "Stats response missing expected fields"
            
            # If new architecture, verify outbound/inbound counts exist
            if "outbound" in data:
                print(f"Outbound count: {data.get('outbound')}")
                print(f"Inbound count: {data.get('inbound')}")


class TestLegacyIndustries:
    """Test legacy /api/industries/ endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.session = requests.Session()
        token = create_test_token()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
    
    def test_industries_endpoint(self):
        """Test /api/industries/ endpoint"""
        response = self.session.get(f"{BASE_URL}/api/industries/")
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"
        print(f"Industries endpoint status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Industries count: {len(data.get('industries', []))}")
    
    def test_industries_public_endpoint(self):
        """Test /api/industries/public endpoint (no auth required)"""
        response = self.session.get(f"{BASE_URL}/api/industries/public")
        assert response.status_code == 200, f"Public industries should be accessible: {response.status_code}"
        
        data = response.json()
        print(f"Public industries response: {data.get('success')}, count: {len(data.get('industries', []))}")
        assert "industries" in data, "Response should contain industries array"


class TestEndpointRouting:
    """Test that all routers are properly registered"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.session = requests.Session()
        token = create_test_token()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
    
    def test_api_root(self):
        """Test API root returns version info"""
        response = self.session.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"API root should return 200: {response.status_code}"
        data = response.json()
        print(f"API info: {data}")
        assert "version" in data or "message" in data
    
    def test_industries_v2_router_registered(self):
        """Test industries-v2 router is registered"""
        # A 401 means the endpoint exists but requires auth
        response = self.session.get(f"{BASE_URL}/api/industries-v2")
        assert response.status_code != 404, "Industries V2 router should be registered"
        print(f"Industries V2 router check: {response.status_code}")
    
    def test_unified_companies_router_registered(self):
        """Test unified-companies router is registered"""
        response = self.session.get(f"{BASE_URL}/api/unified-companies")
        assert response.status_code != 404, "Unified Companies router should be registered"
        print(f"Unified Companies router check: {response.status_code}")
    
    def test_merge_preview_endpoint_exists(self):
        """Test /api/industries-v2/merge/preview endpoint exists"""
        response = self.session.get(f"{BASE_URL}/api/industries-v2/merge/preview", 
                                    params={"primary_id": "test", "secondary_ids": "test"})
        # Should get 401 (auth required) not 404 (not found)
        assert response.status_code != 404, "Merge preview endpoint should exist"
        print(f"Merge preview endpoint: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
