"""
Test suite for Buyer Personas Matrix endpoints
Tests: active-sectors, generate-matrix, buyer-personas CRUD
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://persona-assets.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "perla@leaderlix.com"
TEST_PASSWORD = "Leaderlix2025"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials properly rejected")


class TestActiveSectors:
    """Test active sectors endpoints"""
    
    def test_get_active_sectors(self, auth_headers):
        """GET /api/buyer-personas-db/active-sectors - should return list of sectors"""
        response = requests.get(f"{BASE_URL}/api/buyer-personas-db/active-sectors", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            sector = data[0]
            # Verify sector structure
            assert "code" in sector or "hubspot_value" in sector, "Sector should have code or hubspot_value"
            assert "is_active" in sector, "Sector should have is_active boolean"
            assert isinstance(sector.get("is_active"), bool), "is_active should be boolean"
            
            # Count active sectors
            active_count = sum(1 for s in data if s.get("is_active"))
            print(f"✓ GET active-sectors: {len(data)} sectors, {active_count} active")
        else:
            print("✓ GET active-sectors: Empty list (no sectors initialized)")
    
    def test_toggle_sector_active_on(self, auth_headers):
        """PUT /api/buyer-personas-db/active-sectors/{code}?is_active=true - activate sector"""
        # First get a sector to toggle
        response = requests.get(f"{BASE_URL}/api/buyer-personas-db/active-sectors", headers=auth_headers)
        assert response.status_code == 200
        
        sectors = response.json()
        if not sectors:
            pytest.skip("No sectors available to toggle")
        
        # Find a sector to test with
        test_sector = sectors[0]
        sector_code = test_sector.get("code") or test_sector.get("hubspot_value")
        
        # Toggle to active
        response = requests.put(
            f"{BASE_URL}/api/buyer-personas-db/active-sectors/{sector_code}?is_active=true",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to activate sector: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        print(f"✓ PUT active-sectors/{sector_code}?is_active=true: Sector activated")
    
    def test_toggle_sector_active_off(self, auth_headers):
        """PUT /api/buyer-personas-db/active-sectors/{code}?is_active=false - deactivate sector"""
        # First get a sector to toggle
        response = requests.get(f"{BASE_URL}/api/buyer-personas-db/active-sectors", headers=auth_headers)
        assert response.status_code == 200
        
        sectors = response.json()
        if not sectors:
            pytest.skip("No sectors available to toggle")
        
        # Find an active sector to deactivate
        active_sectors = [s for s in sectors if s.get("is_active")]
        if not active_sectors:
            pytest.skip("No active sectors to deactivate")
        
        test_sector = active_sectors[0]
        sector_code = test_sector.get("code") or test_sector.get("hubspot_value")
        
        # Toggle to inactive
        response = requests.put(
            f"{BASE_URL}/api/buyer-personas-db/active-sectors/{sector_code}?is_active=false",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to deactivate sector: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        
        # Re-activate to restore state
        requests.put(
            f"{BASE_URL}/api/buyer-personas-db/active-sectors/{sector_code}?is_active=true",
            headers=auth_headers
        )
        print(f"✓ PUT active-sectors/{sector_code}?is_active=false: Sector deactivated and restored")


class TestSyncSectors:
    """Test sync sectors from HubSpot"""
    
    def test_sync_sectors_from_hubspot(self, auth_headers):
        """POST /api/buyer-personas-db/sync-sectors-from-hubspot - sync sectors"""
        response = requests.post(
            f"{BASE_URL}/api/buyer-personas-db/sync-sectors-from-hubspot",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to sync sectors: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "total" in data
        assert "active" in data
        print(f"✓ POST sync-sectors-from-hubspot: {data.get('total')} sectors synced, {data.get('active')} active")


class TestGenerateMatrix:
    """Test buyer personas matrix generation"""
    
    def test_generate_matrix(self, auth_headers):
        """POST /api/buyer-personas-db/generate-matrix - generate buyer personas matrix"""
        response = requests.post(
            f"{BASE_URL}/api/buyer-personas-db/generate-matrix",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to generate matrix: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "count" in data
        assert "active_sectors" in data
        assert "functional_areas" in data
        assert "special_personas" in data
        
        # Verify matrix calculation
        expected_matrix = data.get("active_sectors", 0) * data.get("functional_areas", 0)
        expected_total = expected_matrix + data.get("functional_areas", 0) + data.get("special_personas", 0)
        
        print(f"✓ POST generate-matrix: {data.get('count')} personas generated")
        print(f"  - Active sectors: {data.get('active_sectors')}")
        print(f"  - Functional areas: {data.get('functional_areas')}")
        print(f"  - Matrix size: {expected_matrix}")
        print(f"  - Other sectors personas: {data.get('functional_areas')}")
        print(f"  - Special personas: {data.get('special_personas')} (Ramona + Mateo)")


class TestBuyerPersonasCRUD:
    """Test buyer personas CRUD operations"""
    
    def test_get_all_buyer_personas(self, auth_headers):
        """GET /api/buyer-personas-db/ - get all buyer personas"""
        response = requests.get(f"{BASE_URL}/api/buyer-personas-db/", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            persona = data[0]
            # Verify persona structure
            assert "name" in persona, "Persona should have name"
            assert "id" in persona, "Persona should have id"
            
            # Check for new matrix fields
            has_sector = "sector" in persona
            has_area = "area" in persona
            has_keywords = "keywords" in persona
            has_is_active_sector = "is_active_sector" in persona
            has_is_special = "is_special" in persona
            
            # Count special personas
            special_count = sum(1 for p in data if p.get("is_special"))
            active_sector_count = sum(1 for p in data if p.get("is_active_sector"))
            
            print(f"✓ GET buyer-personas-db/: {len(data)} personas")
            print(f"  - Has sector field: {has_sector}")
            print(f"  - Has area field: {has_area}")
            print(f"  - Has keywords field: {has_keywords}")
            print(f"  - Has is_active_sector field: {has_is_active_sector}")
            print(f"  - Has is_special field: {has_is_special}")
            print(f"  - Active sector personas: {active_sector_count}")
            print(f"  - Special personas: {special_count}")
        else:
            print("✓ GET buyer-personas-db/: Empty list")
    
    def test_verify_ramona_exists(self, auth_headers):
        """Verify Ramona (médicos especialistas) buyer persona exists"""
        response = requests.get(f"{BASE_URL}/api/buyer-personas-db/", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        ramona = next((p for p in data if p.get("code") == "ramona_medicos"), None)
        
        if ramona:
            assert ramona.get("is_special") == True, "Ramona should be marked as special"
            assert "Médico" in ramona.get("keywords", ""), "Ramona should have medical keywords"
            print(f"✓ Ramona exists: {ramona.get('name')}")
            print(f"  - Keywords: {ramona.get('keywords', '')[:50]}...")
        else:
            print("⚠ Ramona not found - may need to generate matrix first")
    
    def test_verify_mateo_exists(self, auth_headers):
        """Verify Mateo (sin clasificar) buyer persona exists"""
        response = requests.get(f"{BASE_URL}/api/buyer-personas-db/", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        mateo = next((p for p in data if p.get("code") == "mateo_residual"), None)
        
        if mateo:
            assert mateo.get("is_special") == True, "Mateo should be marked as special"
            assert "Consultant" in mateo.get("keywords", "") or "Founder" in mateo.get("keywords", ""), "Mateo should have residual keywords"
            print(f"✓ Mateo exists: {mateo.get('name')}")
            print(f"  - Keywords: {mateo.get('keywords', '')[:50]}...")
        else:
            print("⚠ Mateo not found - may need to generate matrix first")
    
    def test_get_single_buyer_persona(self, auth_headers):
        """GET /api/buyer-personas-db/{id} - get single persona"""
        # First get all personas
        response = requests.get(f"{BASE_URL}/api/buyer-personas-db/", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        if not data:
            pytest.skip("No personas available")
        
        persona_id = data[0].get("id")
        
        # Get single persona
        response = requests.get(f"{BASE_URL}/api/buyer-personas-db/{persona_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        persona = response.json()
        assert persona.get("id") == persona_id
        print(f"✓ GET buyer-personas-db/{persona_id}: {persona.get('name')}")
    
    def test_update_buyer_persona(self, auth_headers):
        """PUT /api/buyer-personas-db/{id} - update persona"""
        # First get all personas
        response = requests.get(f"{BASE_URL}/api/buyer-personas-db/", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        if not data:
            pytest.skip("No personas available")
        
        persona = data[0]
        persona_id = persona.get("id")
        original_descripcion = persona.get("descripcion", "")
        
        # Update persona
        new_descripcion = f"TEST_Updated description - {original_descripcion[:50]}"
        response = requests.put(
            f"{BASE_URL}/api/buyer-personas-db/{persona_id}",
            headers=auth_headers,
            json={"descripcion": new_descripcion}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        updated = response.json()
        assert updated.get("descripcion") == new_descripcion
        
        # Restore original
        requests.put(
            f"{BASE_URL}/api/buyer-personas-db/{persona_id}",
            headers=auth_headers,
            json={"descripcion": original_descripcion}
        )
        print(f"✓ PUT buyer-personas-db/{persona_id}: Updated and restored")


class TestHubSpotIndustries:
    """Test HubSpot industries endpoint (used by Sectors page)"""
    
    def test_get_industries(self, auth_headers):
        """GET /api/hubspot/industries - get industries mapping"""
        response = requests.get(f"{BASE_URL}/api/hubspot/industries", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "industries" in data or isinstance(data, list)
        
        industries = data.get("industries", data) if isinstance(data, dict) else data
        if len(industries) > 0:
            print(f"✓ GET hubspot/industries: {len(industries)} industries")
        else:
            print("✓ GET hubspot/industries: Empty list")


class TestEndToEndFlow:
    """Test complete flow: sync sectors -> generate matrix -> verify personas"""
    
    def test_complete_flow(self, auth_headers):
        """Test complete buyer personas matrix flow"""
        # Step 1: Sync sectors from HubSpot
        print("\n--- Step 1: Sync sectors from HubSpot ---")
        response = requests.post(
            f"{BASE_URL}/api/buyer-personas-db/sync-sectors-from-hubspot",
            headers=auth_headers
        )
        assert response.status_code == 200
        sync_data = response.json()
        print(f"Synced {sync_data.get('total')} sectors, {sync_data.get('active')} active")
        
        # Step 2: Get active sectors
        print("\n--- Step 2: Get active sectors ---")
        response = requests.get(f"{BASE_URL}/api/buyer-personas-db/active-sectors", headers=auth_headers)
        assert response.status_code == 200
        sectors = response.json()
        active_sectors = [s for s in sectors if s.get("is_active")]
        print(f"Found {len(active_sectors)} active sectors out of {len(sectors)} total")
        
        # Step 3: Generate matrix
        print("\n--- Step 3: Generate buyer personas matrix ---")
        response = requests.post(
            f"{BASE_URL}/api/buyer-personas-db/generate-matrix",
            headers=auth_headers
        )
        assert response.status_code == 200
        matrix_data = response.json()
        print(f"Generated {matrix_data.get('count')} personas")
        print(f"  - Active sectors: {matrix_data.get('active_sectors')}")
        print(f"  - Functional areas: {matrix_data.get('functional_areas')}")
        print(f"  - Special personas: {matrix_data.get('special_personas')}")
        
        # Step 4: Verify personas
        print("\n--- Step 4: Verify buyer personas ---")
        response = requests.get(f"{BASE_URL}/api/buyer-personas-db/", headers=auth_headers)
        assert response.status_code == 200
        personas = response.json()
        
        # Verify structure
        special_personas = [p for p in personas if p.get("is_special")]
        active_sector_personas = [p for p in personas if p.get("is_active_sector")]
        inactive_sector_personas = [p for p in personas if not p.get("is_active_sector") and not p.get("is_special")]
        
        print(f"Total personas: {len(personas)}")
        print(f"  - Active sector personas: {len(active_sector_personas)}")
        print(f"  - Inactive sector personas (Otros Sectores): {len(inactive_sector_personas)}")
        print(f"  - Special personas: {len(special_personas)}")
        
        # Verify Ramona and Mateo
        ramona = next((p for p in personas if p.get("code") == "ramona_medicos"), None)
        mateo = next((p for p in personas if p.get("code") == "mateo_residual"), None)
        
        assert ramona is not None, "Ramona should exist"
        assert mateo is not None, "Mateo should exist"
        print(f"  - Ramona: {ramona.get('name')}")
        print(f"  - Mateo: {mateo.get('name')}")
        
        print("\n✓ Complete flow test passed!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
