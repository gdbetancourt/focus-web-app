"""
Test suite for CSV Import endpoint
Tests: POST /api/hubspot/contacts/import-csv
Features: Import contacts, duplicate detection, buyer persona classification
"""
import pytest
import requests
import os
import uuid

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


class TestCSVImportEndpoint:
    """Test CSV import endpoint"""
    
    def test_import_single_contact(self, auth_headers):
        """POST /api/hubspot/contacts/import-csv - import single contact"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/hubspot/contacts/import-csv",
            headers=auth_headers,
            json={
                "contacts": [
                    {
                        "email": f"test_single_{unique_id}@example.com",
                        "firstname": "Test",
                        "lastname": "Single",
                        "company": "Test Company",
                        "jobtitle": "Director de Marketing",
                        "phone": "+52 55 1234 5678"
                    }
                ],
                "classify": True
            }
        )
        assert response.status_code == 200, f"Import failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("imported") == 1
        assert data.get("duplicates") == 0
        assert data.get("errors") == 0
        print(f"✓ Single contact imported successfully")
    
    def test_import_multiple_contacts(self, auth_headers):
        """POST /api/hubspot/contacts/import-csv - import multiple contacts"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/hubspot/contacts/import-csv",
            headers=auth_headers,
            json={
                "contacts": [
                    {
                        "email": f"test_multi1_{unique_id}@example.com",
                        "firstname": "Carlos",
                        "lastname": "Martinez",
                        "company": "Bayer",
                        "jobtitle": "Director de Marketing",
                        "phone": "+52 55 1111 2222"
                    },
                    {
                        "email": f"test_multi2_{unique_id}@example.com",
                        "firstname": "Ana",
                        "lastname": "Lopez",
                        "company": "Novartis",
                        "jobtitle": "Gerente de RRHH",
                        "phone": "+52 55 3333 4444"
                    },
                    {
                        "email": f"test_multi3_{unique_id}@example.com",
                        "firstname": "Pedro",
                        "lastname": "Sanchez",
                        "company": "Santander",
                        "jobtitle": "Director Comercial",
                        "phone": "+52 55 5555 6666"
                    }
                ],
                "classify": True
            }
        )
        assert response.status_code == 200, f"Import failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("imported") == 3
        assert data.get("duplicates") == 0
        print(f"✓ Multiple contacts imported: {data.get('imported')} imported, {data.get('classified')} classified")
    
    def test_duplicate_detection(self, auth_headers):
        """POST /api/hubspot/contacts/import-csv - detect duplicates"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"test_dup_{unique_id}@example.com"
        
        # First import
        response1 = requests.post(
            f"{BASE_URL}/api/hubspot/contacts/import-csv",
            headers=auth_headers,
            json={
                "contacts": [
                    {
                        "email": email,
                        "firstname": "Duplicate",
                        "lastname": "Test",
                        "company": "Test Company",
                        "jobtitle": "Manager",
                        "phone": "+52 55 0000 0000"
                    }
                ],
                "classify": True
            }
        )
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1.get("imported") == 1
        
        # Second import with same email
        response2 = requests.post(
            f"{BASE_URL}/api/hubspot/contacts/import-csv",
            headers=auth_headers,
            json={
                "contacts": [
                    {
                        "email": email,
                        "firstname": "Duplicate",
                        "lastname": "Test",
                        "company": "Test Company",
                        "jobtitle": "Manager",
                        "phone": "+52 55 0000 0000"
                    }
                ],
                "classify": True
            }
        )
        assert response2.status_code == 200
        
        data2 = response2.json()
        assert data2.get("success") == True
        assert data2.get("imported") == 0, "Duplicate should not be imported"
        assert data2.get("duplicates") == 1, "Should detect 1 duplicate"
        print(f"✓ Duplicate detection working: {data2.get('duplicates')} duplicates detected")
    
    def test_classification_marketing_director(self, auth_headers):
        """Test classification for Director de Marketing"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/hubspot/contacts/import-csv",
            headers=auth_headers,
            json={
                "contacts": [
                    {
                        "email": f"test_mkt_{unique_id}@example.com",
                        "firstname": "Marketing",
                        "lastname": "Director",
                        "company": "Pfizer",
                        "jobtitle": "Director de Marketing",
                        "phone": "+52 55 1234 5678"
                    }
                ],
                "classify": True
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("classified") >= 1, "Contact should be classified"
        print(f"✓ Marketing Director classified: {data.get('classified')} classified")
    
    def test_classification_rrhh_manager(self, auth_headers):
        """Test classification for Gerente de RRHH"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/hubspot/contacts/import-csv",
            headers=auth_headers,
            json={
                "contacts": [
                    {
                        "email": f"test_rrhh_{unique_id}@example.com",
                        "firstname": "RRHH",
                        "lastname": "Manager",
                        "company": "BBVA",
                        "jobtitle": "Gerente de Recursos Humanos",
                        "phone": "+52 55 1234 5678"
                    }
                ],
                "classify": True
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("classified") >= 1, "Contact should be classified"
        print(f"✓ RRHH Manager classified: {data.get('classified')} classified")
    
    def test_classification_commercial_director(self, auth_headers):
        """Test classification for Director Comercial"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/hubspot/contacts/import-csv",
            headers=auth_headers,
            json={
                "contacts": [
                    {
                        "email": f"test_com_{unique_id}@example.com",
                        "firstname": "Commercial",
                        "lastname": "Director",
                        "company": "Walmart",
                        "jobtitle": "Director Comercial",
                        "phone": "+52 55 1234 5678"
                    }
                ],
                "classify": True
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("classified") >= 1, "Contact should be classified"
        print(f"✓ Commercial Director classified: {data.get('classified')} classified")
    
    def test_import_without_classification(self, auth_headers):
        """POST /api/hubspot/contacts/import-csv - import without classification"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/hubspot/contacts/import-csv",
            headers=auth_headers,
            json={
                "contacts": [
                    {
                        "email": f"test_noclassify_{unique_id}@example.com",
                        "firstname": "No",
                        "lastname": "Classify",
                        "company": "Test Company",
                        "jobtitle": "Manager",
                        "phone": "+52 55 0000 0000"
                    }
                ],
                "classify": False
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("imported") == 1
        print(f"✓ Import without classification: {data.get('imported')} imported")
    
    def test_import_with_missing_optional_fields(self, auth_headers):
        """POST /api/hubspot/contacts/import-csv - import with missing optional fields"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/hubspot/contacts/import-csv",
            headers=auth_headers,
            json={
                "contacts": [
                    {
                        "email": f"test_minimal_{unique_id}@example.com",
                        "firstname": "",
                        "lastname": "",
                        "company": "",
                        "jobtitle": "",
                        "phone": ""
                    }
                ],
                "classify": True
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("imported") == 1
        print(f"✓ Import with minimal data: {data.get('imported')} imported")
    
    def test_import_requires_authentication(self):
        """POST /api/hubspot/contacts/import-csv - requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/hubspot/contacts/import-csv",
            headers={"Content-Type": "application/json"},
            json={
                "contacts": [
                    {
                        "email": "test@example.com",
                        "firstname": "Test",
                        "lastname": "User",
                        "company": "Test",
                        "jobtitle": "Test",
                        "phone": "123"
                    }
                ],
                "classify": True
            }
        )
        assert response.status_code == 401, "Should require authentication"
        print("✓ Authentication required for import endpoint")


class TestContactsEndpoint:
    """Test contacts endpoint to verify imported contacts"""
    
    def test_get_contacts(self, auth_headers):
        """GET /api/hubspot/contacts - get all contacts"""
        response = requests.get(f"{BASE_URL}/api/hubspot/contacts", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET contacts: {len(data)} contacts found")
    
    def test_verify_imported_contacts_exist(self, auth_headers):
        """Verify that imported contacts exist in the database"""
        response = requests.get(f"{BASE_URL}/api/hubspot/contacts", headers=auth_headers)
        assert response.status_code == 200
        
        contacts = response.json()
        csv_imported = [c for c in contacts if c.get("email", "").startswith("test_")]
        
        print(f"✓ Found {len(csv_imported)} test contacts from CSV import")
        assert len(csv_imported) > 0, "Should have imported test contacts"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
