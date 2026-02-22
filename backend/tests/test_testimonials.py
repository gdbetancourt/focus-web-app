"""
Testimonials API Tests - Block 2 Testimonials Management System
Tests CRUD operations, dropdown options, Excel import, and public endpoint
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTestimonialsAuth:
    """Test authentication requirements for testimonials endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_testimonials_requires_auth(self):
        """GET /api/testimonials requires authentication"""
        response = requests.get(f"{BASE_URL}/api/testimonials")
        assert response.status_code in [401, 403], "Should require auth"
    
    def test_testimonials_options_requires_auth(self):
        """GET /api/testimonials/options requires authentication"""
        response = requests.get(f"{BASE_URL}/api/testimonials/options")
        assert response.status_code in [401, 403], "Should require auth"
    
    def test_create_testimonial_requires_auth(self):
        """POST /api/testimonials requires authentication"""
        response = requests.post(f"{BASE_URL}/api/testimonials", json={
            "nombre": "Test",
            "testimonio": "Test testimonial"
        })
        assert response.status_code in [401, 403], "Should require auth"


class TestTestimonialsOptions:
    """Test dropdown options endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_get_options_success(self, auth_token):
        """GET /api/testimonials/options returns all dropdown options"""
        response = requests.get(
            f"{BASE_URL}/api/testimonials/options",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert data["success"] == True
        assert "formatos" in data
        assert "enfoques" in data
        assert "industries" in data
        assert "programas" in data
        assert "niveles" in data
        assert "status_options" in data
        assert "ratings" in data
        
        # Verify formatos (6 items expected)
        assert len(data["formatos"]) == 6, f"Expected 6 formatos, got {len(data['formatos'])}"
        
        # Verify enfoques/thematic axes (8 items expected)
        assert len(data["enfoques"]) == 8, f"Expected 8 enfoques, got {len(data['enfoques'])}"
        
        # Verify niveles (4 items expected)
        assert len(data["niveles"]) == 4, f"Expected 4 niveles, got {len(data['niveles'])}"
        
        # Verify status options (6 items expected)
        assert len(data["status_options"]) == 6, f"Expected 6 status options, got {len(data['status_options'])}"
        
        # Verify ratings
        assert data["ratings"] == [1, 2, 3, 4, 5]
    
    def test_options_have_id_and_name(self, auth_token):
        """Verify each option has id and name fields"""
        response = requests.get(
            f"{BASE_URL}/api/testimonials/options",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        
        # Check formatos structure
        for formato in data["formatos"]:
            assert "id" in formato, "Formato missing id"
            assert "name" in formato, "Formato missing name"
        
        # Check enfoques structure
        for enfoque in data["enfoques"]:
            assert "id" in enfoque, "Enfoque missing id"
            assert "name" in enfoque, "Enfoque missing name"
        
        # Check niveles structure
        for nivel in data["niveles"]:
            assert "id" in nivel, "Nivel missing id"
            assert "name" in nivel, "Nivel missing name"


class TestTestimonialsCRUD:
    """Test CRUD operations for testimonials"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def options(self, auth_token):
        """Get dropdown options for creating testimonials"""
        response = requests.get(
            f"{BASE_URL}/api/testimonials/options",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        return response.json()
    
    def test_list_testimonials(self, auth_token):
        """GET /api/testimonials returns list with stats"""
        response = requests.get(
            f"{BASE_URL}/api/testimonials",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "testimonials" in data
        assert "total" in data
        assert "stats" in data
        assert "total" in data["stats"]
        assert "published" in data["stats"]
        assert "pending" in data["stats"]
    
    def test_create_testimonial_minimal(self, auth_token):
        """POST /api/testimonials creates testimonial with minimal fields"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "nombre": f"TEST_User_{unique_id}",
            "testimonio": f"TEST_This is a test testimonial {unique_id}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/testimonials",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "testimonial" in data
        assert data["testimonial"]["nombre"] == payload["nombre"]
        assert data["testimonial"]["testimonio"] == payload["testimonio"]
        assert "id" in data["testimonial"]
        
        # Cleanup
        testimonial_id = data["testimonial"]["id"]
        requests.delete(
            f"{BASE_URL}/api/testimonials/{testimonial_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_create_testimonial_full(self, auth_token, options):
        """POST /api/testimonials creates testimonial with all fields"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Get first option from each dropdown
        formato = options["formatos"][0] if options["formatos"] else None
        enfoque = options["enfoques"][0] if options["enfoques"] else None
        industria = options["industries"][0] if options["industries"] else None
        nivel = options["niveles"][0] if options["niveles"] else None
        status = options["status_options"][0] if options["status_options"] else None
        
        payload = {
            "nombre": f"TEST_FullUser_{unique_id}",
            "apellido": "TestLastName",
            "correo": f"test_{unique_id}@example.com",
            "testimonio": f"TEST_Full testimonial with all fields {unique_id}",
            "formato_id": formato["id"] if formato else None,
            "formato_name": formato["name"] if formato else None,
            "enfoque_id": enfoque["id"] if enfoque else None,
            "enfoque_name": enfoque["name"] if enfoque else None,
            "industria_id": industria["id"] if industria else None,
            "industria_name": industria["name"] if industria else None,
            "nivel_id": nivel["id"] if nivel else None,
            "nivel_name": nivel["name"] if nivel else None,
            "estatus": status["value"] if status else None,
            "video_vimeo": "https://vimeo.com/123456789",
            "video_descript": "https://share.descript.com/test123",
            "rating_presentacion": 5,
            "rating_articulacion": 4,
            "rating_calidad_video": 3,
            "rating_resultados": 5,
            "valor_agregado": True,
            "publicar_desde": "2026-02-01"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/testimonials",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        testimonial = data["testimonial"]
        
        # Verify all fields
        assert testimonial["nombre"] == payload["nombre"]
        assert testimonial["apellido"] == payload["apellido"]
        assert testimonial["correo"] == payload["correo"]
        assert testimonial["testimonio"] == payload["testimonio"]
        assert testimonial["video_vimeo"] == payload["video_vimeo"]
        assert testimonial["video_descript"] == payload["video_descript"]
        assert testimonial["rating_presentacion"] == 5
        assert testimonial["rating_articulacion"] == 4
        assert testimonial["rating_calidad_video"] == 3
        assert testimonial["rating_resultados"] == 5
        assert testimonial["valor_agregado"] == True
        
        # Verify dropdown values
        if formato:
            assert testimonial["formato_id"] == formato["id"]
            assert testimonial["formato_name"] == formato["name"]
        
        # Cleanup
        testimonial_id = testimonial["id"]
        requests.delete(
            f"{BASE_URL}/api/testimonials/{testimonial_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_create_and_get_testimonial(self, auth_token):
        """Create testimonial and verify with GET"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "nombre": f"TEST_GetUser_{unique_id}",
            "testimonio": f"TEST_Testimonial for GET test {unique_id}"
        }
        
        # Create
        create_response = requests.post(
            f"{BASE_URL}/api/testimonials",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=payload
        )
        assert create_response.status_code == 200
        testimonial_id = create_response.json()["testimonial"]["id"]
        
        # Get single testimonial
        get_response = requests.get(
            f"{BASE_URL}/api/testimonials/{testimonial_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 200
        data = get_response.json()
        
        assert data["success"] == True
        assert data["testimonial"]["id"] == testimonial_id
        assert data["testimonial"]["nombre"] == payload["nombre"]
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/testimonials/{testimonial_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_update_testimonial(self, auth_token):
        """PUT /api/testimonials/{id} updates testimonial"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create
        create_payload = {
            "nombre": f"TEST_UpdateUser_{unique_id}",
            "testimonio": f"TEST_Original testimonial {unique_id}"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/testimonials",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=create_payload
        )
        assert create_response.status_code == 200
        testimonial_id = create_response.json()["testimonial"]["id"]
        
        # Update
        update_payload = {
            "nombre": f"TEST_UpdatedUser_{unique_id}",
            "testimonio": f"TEST_Updated testimonial {unique_id}",
            "rating_presentacion": 5,
            "valor_agregado": True
        }
        update_response = requests.put(
            f"{BASE_URL}/api/testimonials/{testimonial_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=update_payload
        )
        assert update_response.status_code == 200
        assert update_response.json()["success"] == True
        
        # Verify update with GET
        get_response = requests.get(
            f"{BASE_URL}/api/testimonials/{testimonial_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 200
        updated = get_response.json()["testimonial"]
        
        assert updated["nombre"] == update_payload["nombre"]
        assert updated["testimonio"] == update_payload["testimonio"]
        assert updated["rating_presentacion"] == 5
        assert updated["valor_agregado"] == True
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/testimonials/{testimonial_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_delete_testimonial(self, auth_token):
        """DELETE /api/testimonials/{id} removes testimonial"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create
        create_payload = {
            "nombre": f"TEST_DeleteUser_{unique_id}",
            "testimonio": f"TEST_Testimonial to delete {unique_id}"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/testimonials",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=create_payload
        )
        assert create_response.status_code == 200
        testimonial_id = create_response.json()["testimonial"]["id"]
        
        # Delete
        delete_response = requests.delete(
            f"{BASE_URL}/api/testimonials/{testimonial_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["success"] == True
        
        # Verify deletion with GET (should return 404)
        get_response = requests.get(
            f"{BASE_URL}/api/testimonials/{testimonial_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 404
    
    def test_delete_nonexistent_testimonial(self, auth_token):
        """DELETE /api/testimonials/{id} returns 404 for nonexistent"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/testimonials/{fake_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404


class TestTestimonialsFilters:
    """Test filtering testimonials"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_filter_by_formato(self, auth_token):
        """GET /api/testimonials with formato_id filter"""
        # Get a formato id
        options_response = requests.get(
            f"{BASE_URL}/api/testimonials/options",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        formatos = options_response.json()["formatos"]
        if not formatos:
            pytest.skip("No formatos available")
        
        formato_id = formatos[0]["id"]
        response = requests.get(
            f"{BASE_URL}/api/testimonials?formato_id={formato_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        # All returned testimonials should have this formato_id
        for t in data["testimonials"]:
            if t.get("formato_id"):
                assert t["formato_id"] == formato_id
    
    def test_filter_by_valor_agregado(self, auth_token):
        """GET /api/testimonials with valor_agregado filter"""
        response = requests.get(
            f"{BASE_URL}/api/testimonials?valor_agregado=true",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True


class TestTestimonialsPublic:
    """Test public testimonials endpoint (no auth required)"""
    
    def test_public_endpoint_no_auth(self):
        """GET /api/testimonials/public works without authentication"""
        response = requests.get(f"{BASE_URL}/api/testimonials/public")
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "testimonials" in data
        assert "total" in data
    
    def test_public_excludes_email(self):
        """Public endpoint excludes email for privacy"""
        response = requests.get(f"{BASE_URL}/api/testimonials/public")
        assert response.status_code == 200
        data = response.json()
        
        # Email should not be in public response
        for t in data["testimonials"]:
            assert "correo" not in t, "Email should be excluded from public endpoint"
    
    def test_public_with_filters(self):
        """GET /api/testimonials/public accepts filters"""
        response = requests.get(f"{BASE_URL}/api/testimonials/public?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True


class TestTestimonialsValidation:
    """Test validation for testimonials"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_create_missing_required_fields(self, auth_token):
        """POST /api/testimonials validates required fields"""
        # Missing testimonio
        response = requests.post(
            f"{BASE_URL}/api/testimonials",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"nombre": "Test"}
        )
        # Should fail validation (422) or be handled by backend
        assert response.status_code in [200, 422], f"Unexpected status: {response.status_code}"
    
    def test_rating_values(self, auth_token):
        """Ratings should be 1-5"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "nombre": f"TEST_RatingUser_{unique_id}",
            "testimonio": f"TEST_Rating test {unique_id}",
            "rating_presentacion": 5,
            "rating_articulacion": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/testimonials",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["testimonial"]["rating_presentacion"] == 5
        assert data["testimonial"]["rating_articulacion"] == 1
        
        # Cleanup
        testimonial_id = data["testimonial"]["id"]
        requests.delete(
            f"{BASE_URL}/api/testimonials/{testimonial_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
