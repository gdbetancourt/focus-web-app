"""
Test suite for Certificados (Certificate Generator) API endpoints
Tests: catalog endpoints, contact search, certificate CRUD, PDF generation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "perla@leaderlix.com"
TEST_PASSWORD = "Leaderlix2025"

# Test contact for certificate generation
TEST_CONTACT_EMAIL = "adolfo.trejo@hotmail.com"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestCatalogEndpoints:
    """Test catalog endpoints (no auth required)"""
    
    def test_get_programs_catalog(self, api_client):
        """GET /api/certificados/catalog/programs - Returns 14 programs"""
        response = api_client.get(f"{BASE_URL}/api/certificados/catalog/programs")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "programs" in data
        programs = data["programs"]
        assert len(programs) == 14, f"Expected 14 programs, got {len(programs)}"
        
        # Verify program structure
        for program in programs:
            assert "id" in program
            assert "name" in program
        
        # Verify some specific programs exist
        program_ids = [p["id"] for p in programs]
        assert "storyselling" in program_ids
        assert "datastory" in program_ids
        assert "masterclass" in program_ids
    
    def test_get_levels_catalog(self, api_client):
        """GET /api/certificados/catalog/levels - Returns 4 levels"""
        response = api_client.get(f"{BASE_URL}/api/certificados/catalog/levels")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "levels" in data
        levels = data["levels"]
        assert len(levels) == 4, f"Expected 4 levels, got {len(levels)}"
        
        # Verify level structure
        for level in levels:
            assert "id" in level
            assert "name" in level
            assert "description" in level
        
        # Verify specific levels
        level_ids = [l["id"] for l in levels]
        assert "commitment" in level_ids
        assert "mastery" in level_ids
        assert "performance" in level_ids
        assert "results" in level_ids


class TestContactSearch:
    """Test contact search endpoint"""
    
    def test_search_contact_found(self, api_client):
        """GET /api/certificados/search-contact - Contact found"""
        response = api_client.get(
            f"{BASE_URL}/api/certificados/search-contact",
            params={"email": TEST_CONTACT_EMAIL}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["found"] is True
        assert "contact" in data
        
        contact = data["contact"]
        assert contact["email"] == TEST_CONTACT_EMAIL
        assert "firstname" in contact
        assert "lastname" in contact
        assert contact["firstname"] == "Adolfo"
        assert contact["lastname"] == "Trejo"
    
    def test_search_contact_not_found(self, api_client):
        """GET /api/certificados/search-contact - Contact not found returns 404"""
        response = api_client.get(
            f"{BASE_URL}/api/certificados/search-contact",
            params={"email": "nonexistent@test.com"}
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "no encontrado" in data["detail"].lower()


class TestCertificateGeneration:
    """Test certificate generation and validation"""
    
    def test_generate_certificate_success(self, authenticated_client):
        """POST /api/certificados/generate - Create certificate successfully"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/certificados/generate",
            json={
                "email": TEST_CONTACT_EMAIL,
                "program_id": "escucha_activa",
                "level": "commitment",
                "hours": 12
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert "certificate_number" in data
        assert "contact_name" in data
        assert "contact_email" in data
        assert "program_name" in data
        assert "level" in data
        assert "hours" in data
        assert "issue_date" in data
        assert "status" in data
        
        # Verify values
        assert data["contact_email"] == TEST_CONTACT_EMAIL
        assert data["contact_name"] == "Adolfo Trejo"
        assert data["hours"] == 12
        assert data["status"] == "issued"
        assert data["certificate_number"].startswith("CERT-2026-")
        
        # Store for cleanup
        TestCertificateGeneration.created_cert_id = data["id"]
    
    def test_generate_certificate_invalid_program(self, authenticated_client):
        """POST /api/certificados/generate - Invalid program returns 400"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/certificados/generate",
            json={
                "email": TEST_CONTACT_EMAIL,
                "program_id": "invalid_program",
                "level": "commitment",
                "hours": 12
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "programa" in data["detail"].lower() or "inválido" in data["detail"].lower()
    
    def test_generate_certificate_invalid_level(self, authenticated_client):
        """POST /api/certificados/generate - Invalid level returns 400"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/certificados/generate",
            json={
                "email": TEST_CONTACT_EMAIL,
                "program_id": "datastory",
                "level": "invalid_level",
                "hours": 12
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "nivel" in data["detail"].lower() or "inválido" in data["detail"].lower()
    
    def test_generate_certificate_contact_not_found(self, authenticated_client):
        """POST /api/certificados/generate - Contact not found returns 404"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/certificados/generate",
            json={
                "email": "nonexistent@test.com",
                "program_id": "datastory",
                "level": "commitment",
                "hours": 12
            }
        )
        
        assert response.status_code == 404


class TestCertificateList:
    """Test certificate listing"""
    
    def test_list_certificates(self, authenticated_client):
        """GET /api/certificados/list - Returns certificates list"""
        response = authenticated_client.get(f"{BASE_URL}/api/certificados/list")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "certificates" in data
        assert "total" in data
        assert isinstance(data["certificates"], list)
        assert data["total"] >= 1  # At least the one we created
        
        # Verify certificate structure
        if data["certificates"]:
            cert = data["certificates"][0]
            assert "id" in cert
            assert "certificate_number" in cert
            assert "contact_name" in cert
            assert "program_name" in cert
            assert "level" in cert
            assert "hours" in cert
            assert "issue_date" in cert


class TestCertificateGet:
    """Test getting specific certificate"""
    
    def test_get_certificate_success(self, authenticated_client):
        """GET /api/certificados/{id} - Returns certificate details"""
        # First get list to find a certificate ID
        list_response = authenticated_client.get(f"{BASE_URL}/api/certificados/list")
        certs = list_response.json()["certificates"]
        
        if certs:
            cert_id = certs[0]["id"]
            response = authenticated_client.get(f"{BASE_URL}/api/certificados/{cert_id}")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["id"] == cert_id
            assert "certificate_number" in data
            assert "contact_name" in data
            assert "program_name" in data
    
    def test_get_certificate_not_found(self, authenticated_client):
        """GET /api/certificados/{id} - Non-existent returns 404"""
        response = authenticated_client.get(f"{BASE_URL}/api/certificados/nonexistent-id")
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data


class TestCertificatePDF:
    """Test PDF generation"""
    
    def test_generate_pdf_success(self, authenticated_client):
        """GET /api/certificados/{id}/pdf - Returns PDF file"""
        # First get list to find a certificate ID
        list_response = authenticated_client.get(f"{BASE_URL}/api/certificados/list")
        certs = list_response.json()["certificates"]
        
        if certs:
            cert_id = certs[0]["id"]
            response = authenticated_client.get(f"{BASE_URL}/api/certificados/{cert_id}/pdf")
            
            assert response.status_code == 200
            assert response.headers.get("content-type") == "application/pdf"
            assert "content-disposition" in response.headers
            assert "attachment" in response.headers["content-disposition"]
            assert len(response.content) > 0  # PDF has content
    
    def test_generate_pdf_not_found(self, authenticated_client):
        """GET /api/certificados/{id}/pdf - Non-existent returns 404"""
        response = authenticated_client.get(f"{BASE_URL}/api/certificados/nonexistent-id/pdf")
        
        assert response.status_code == 404


class TestCertificateDelete:
    """Test certificate deletion"""
    
    def test_delete_certificate_success(self, authenticated_client):
        """DELETE /api/certificados/{id} - Deletes certificate"""
        # First create a certificate to delete
        create_response = authenticated_client.post(
            f"{BASE_URL}/api/certificados/generate",
            json={
                "email": TEST_CONTACT_EMAIL,
                "program_id": "arquetipos",
                "level": "performance",
                "hours": 8
            }
        )
        
        assert create_response.status_code == 200
        cert_id = create_response.json()["id"]
        
        # Delete it
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/certificados/{cert_id}")
        
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert data["success"] is True
        
        # Verify it's deleted
        get_response = authenticated_client.get(f"{BASE_URL}/api/certificados/{cert_id}")
        assert get_response.status_code == 404
    
    def test_delete_certificate_not_found(self, authenticated_client):
        """DELETE /api/certificados/{id} - Non-existent returns 404"""
        response = authenticated_client.delete(f"{BASE_URL}/api/certificados/nonexistent-id")
        
        assert response.status_code == 404


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_certificates(self, authenticated_client):
        """Clean up certificates created during testing"""
        # Get all certificates
        response = authenticated_client.get(f"{BASE_URL}/api/certificados/list")
        certs = response.json()["certificates"]
        
        # Delete certificates created by tests (escucha_activa program)
        for cert in certs:
            if cert.get("program_id") == "escucha_activa":
                authenticated_client.delete(f"{BASE_URL}/api/certificados/{cert['id']}")
        
        # Verify cleanup
        assert True  # Cleanup completed
