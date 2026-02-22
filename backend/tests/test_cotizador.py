"""
Cotizador API Tests - Quote generation for Leaderlix coaching programs
Tests: exchange rate, catalogs, contacts, calculate, quotes CRUD, PDF generation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCotizadorCatalogs:
    """Test catalog endpoints (no auth required for some)"""
    
    def test_get_exchange_rate(self):
        """GET /api/cotizador/exchange-rate - Get USD to MXN rate"""
        response = requests.get(f"{BASE_URL}/api/cotizador/exchange-rate")
        assert response.status_code == 200
        data = response.json()
        assert "usd_to_mxn" in data
        assert "timestamp" in data
        assert isinstance(data["usd_to_mxn"], (int, float))
        assert data["usd_to_mxn"] > 10  # Reasonable MXN rate
    
    def test_get_benefits_catalog(self):
        """GET /api/cotizador/catalog/benefits - List additional benefits"""
        response = requests.get(f"{BASE_URL}/api/cotizador/catalog/benefits")
        assert response.status_code == 200
        data = response.json()
        assert "additional_benefits" in data
        benefits = data["additional_benefits"]
        assert len(benefits) >= 5  # Should have multiple benefits
        # Verify structure
        for benefit in benefits:
            assert "id" in benefit
            assert "name" in benefit
            assert "price_usd" in benefit
    
    def test_get_thematic_axes(self):
        """GET /api/cotizador/catalog/thematic-axes - List thematic axes"""
        response = requests.get(f"{BASE_URL}/api/cotizador/catalog/thematic-axes")
        assert response.status_code == 200
        data = response.json()
        assert "thematic_axes" in data


class TestCotizadorAuth:
    """Test authenticated endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        if login_response.status_code != 200:
            pytest.skip("Authentication failed")
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_cierre_contacts(self):
        """GET /api/cotizador/contacts/cierre - Get contacts in Cierre stage"""
        response = requests.get(
            f"{BASE_URL}/api/cotizador/contacts/cierre",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "contacts" in data
        # Contacts may be empty but structure should be correct
        if len(data["contacts"]) > 0:
            contact = data["contacts"][0]
            assert "id" in contact
            assert "email" in contact


class TestCotizadorCalculate:
    """Test quote calculation with different scenarios"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        if login_response.status_code != 200:
            pytest.skip("Authentication failed")
        self.token = login_response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_calculate_single_person_special_price(self):
        """1 person should get special price of $3,000 USD"""
        response = requests.post(
            f"{BASE_URL}/api/cotizador/calculate",
            headers=self.headers,
            json={
                "group": {"direccion": 1, "management": 0, "operacion": 0},
                "currency": "USD",
                "discount_percent": 0,
                "additional_benefits": [],
                "objectives": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["coaching_subtotal"] == 3000  # Special single person price
        assert data["total_participants"] == 1
        assert data["includes_masterclass"] == False
        assert data["includes_course"] == False
    
    def test_calculate_4_persons_includes_masterclass(self):
        """4+ persons should include Masterclass"""
        response = requests.post(
            f"{BASE_URL}/api/cotizador/calculate",
            headers=self.headers,
            json={
                "group": {"direccion": 2, "management": 2, "operacion": 0},
                "currency": "USD",
                "discount_percent": 0,
                "additional_benefits": [],
                "objectives": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        # 2 x $3,500 (Dirección) + 2 x $3,000 (Management) = $13,000
        assert data["coaching_subtotal"] == 13000
        assert data["total_participants"] == 4
        assert data["includes_masterclass"] == True
        assert data["includes_course"] == False
    
    def test_calculate_8_persons_includes_course(self):
        """8+ persons should include Curso Titular"""
        response = requests.post(
            f"{BASE_URL}/api/cotizador/calculate",
            headers=self.headers,
            json={
                "group": {"direccion": 2, "management": 3, "operacion": 3},
                "currency": "USD",
                "discount_percent": 0,
                "additional_benefits": [],
                "objectives": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        # 2 x $3,500 + 3 x $3,000 + 3 x $2,500 = $23,500
        assert data["coaching_subtotal"] == 23500
        assert data["total_participants"] == 8
        assert data["includes_masterclass"] == True
        assert data["includes_course"] == True
    
    def test_calculate_with_discount(self):
        """Test discount calculation"""
        response = requests.post(
            f"{BASE_URL}/api/cotizador/calculate",
            headers=self.headers,
            json={
                "group": {"direccion": 1, "management": 1, "operacion": 0},
                "currency": "USD",
                "discount_percent": 20,
                "additional_benefits": [],
                "objectives": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        # $3,500 + $3,000 = $6,500
        assert data["subtotal_before_discount"] == 6500
        assert data["discount_percent"] == 20
        assert data["discount_amount"] == 1300  # 20% of $6,500
        assert data["subtotal"] == 5200  # $6,500 - $1,300
    
    def test_calculate_with_additional_benefits(self):
        """Test additional benefits pricing"""
        response = requests.post(
            f"{BASE_URL}/api/cotizador/calculate",
            headers=self.headers,
            json={
                "group": {"direccion": 1, "management": 0, "operacion": 0},
                "currency": "USD",
                "discount_percent": 0,
                "additional_benefits": ["advisory_board", "slideset_design"],
                "objectives": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        # Advisory Board $1,000 + Slideset Design $800 = $1,800
        assert data["benefits_total"] == 1800
        assert len(data["selected_benefits"]) == 2
    
    def test_calculate_mxn_currency(self):
        """Test MXN currency conversion"""
        response = requests.post(
            f"{BASE_URL}/api/cotizador/calculate",
            headers=self.headers,
            json={
                "group": {"direccion": 1, "management": 0, "operacion": 0},
                "currency": "MXN",
                "discount_percent": 0,
                "additional_benefits": [],
                "objectives": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["currency"] == "MXN"
        assert "exchange_rate" in data
        # MXN subtotal should be USD * exchange_rate
        expected_mxn = 3000 * data["exchange_rate"]
        assert abs(data["coaching_subtotal"] - expected_mxn) < 1  # Allow small rounding
    
    def test_calculate_iva_16_percent(self):
        """Test IVA calculation (16%)"""
        response = requests.post(
            f"{BASE_URL}/api/cotizador/calculate",
            headers=self.headers,
            json={
                "group": {"direccion": 1, "management": 0, "operacion": 0},
                "currency": "USD",
                "discount_percent": 0,
                "additional_benefits": [],
                "objectives": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        # IVA should be 16% of subtotal
        expected_iva = data["subtotal"] * 0.16
        assert abs(data["iva"] - expected_iva) < 0.01


class TestCotizadorQuotesCRUD:
    """Test quotes CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        if login_response.status_code != 200:
            pytest.skip("Authentication failed")
        self.token = login_response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        self.created_quote_ids = []
    
    def teardown_method(self, method):
        """Cleanup test quotes"""
        for quote_id in self.created_quote_ids:
            try:
                requests.delete(
                    f"{BASE_URL}/api/cotizador/quotes/{quote_id}",
                    headers=self.headers
                )
            except:
                pass
    
    def test_create_quote_and_verify(self):
        """POST /api/cotizador/quotes - Create and verify quote"""
        create_payload = {
            "client_name": "TEST_Create Quote",
            "client_email": "test_create@test.com",
            "company": "TEST_Company",
            "group": {"direccion": 1, "management": 1, "operacion": 0},
            "currency": "USD",
            "discount_percent": 10,
            "additional_benefits": [],
            "objectives": {
                "resultado_objetivo": "Test objective",
                "resultado_descripcion": "",
                "comportamiento_objetivo": "",
                "comportamiento_descripcion": "",
                "aprendizaje_objetivo": "",
                "aprendizaje_descripcion": "",
                "experiencia_objetivo": "",
                "experiencia_descripcion": ""
            },
            "leaderlix_responsible": "Test",
            "valid_until": "2026-12-31"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/cotizador/quotes",
            headers=self.headers,
            json=create_payload
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert "quote_number" in data
        assert data["client_name"] == "TEST_Create Quote"
        assert data["company"] == "TEST_Company"
        assert data["status"] == "draft"
        assert data["total_participants"] == 2
        
        self.created_quote_ids.append(data["id"])
        
        # GET to verify persistence
        get_response = requests.get(
            f"{BASE_URL}/api/cotizador/quotes/{data['id']}",
            headers=self.headers
        )
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["client_name"] == "TEST_Create Quote"
        assert fetched["discount_percent"] == 10
    
    def test_list_quotes(self):
        """GET /api/cotizador/quotes - List all quotes"""
        response = requests.get(
            f"{BASE_URL}/api/cotizador/quotes",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "quotes" in data
        assert "total" in data
    
    def test_update_quote_status(self):
        """PUT /api/cotizador/quotes/{id}/status - Update status"""
        # First create a quote
        create_response = requests.post(
            f"{BASE_URL}/api/cotizador/quotes",
            headers=self.headers,
            json={
                "client_name": "TEST_Status Update",
                "company": "TEST_Company",
                "group": {"direccion": 1, "management": 0, "operacion": 0},
                "currency": "USD",
                "discount_percent": 0,
                "additional_benefits": [],
                "objectives": {}
            }
        )
        assert create_response.status_code == 200
        quote_id = create_response.json()["id"]
        self.created_quote_ids.append(quote_id)
        
        # Update status to sent
        update_response = requests.put(
            f"{BASE_URL}/api/cotizador/quotes/{quote_id}/status?status=sent",
            headers=self.headers
        )
        assert update_response.status_code == 200
        assert update_response.json()["status"] == "sent"
        
        # Verify status persisted
        get_response = requests.get(
            f"{BASE_URL}/api/cotizador/quotes/{quote_id}",
            headers=self.headers
        )
        assert get_response.json()["status"] == "sent"
        
        # Update to accepted
        update_response = requests.put(
            f"{BASE_URL}/api/cotizador/quotes/{quote_id}/status?status=accepted",
            headers=self.headers
        )
        assert update_response.status_code == 200
        assert update_response.json()["status"] == "accepted"
    
    def test_update_status_invalid(self):
        """PUT /api/cotizador/quotes/{id}/status - Invalid status returns 400"""
        # First create a quote
        create_response = requests.post(
            f"{BASE_URL}/api/cotizador/quotes",
            headers=self.headers,
            json={
                "client_name": "TEST_Invalid Status",
                "company": "TEST_Company",
                "group": {"direccion": 1, "management": 0, "operacion": 0},
                "currency": "USD",
                "discount_percent": 0,
                "additional_benefits": [],
                "objectives": {}
            }
        )
        quote_id = create_response.json()["id"]
        self.created_quote_ids.append(quote_id)
        
        # Try invalid status
        update_response = requests.put(
            f"{BASE_URL}/api/cotizador/quotes/{quote_id}/status?status=invalid_status",
            headers=self.headers
        )
        assert update_response.status_code == 400
    
    def test_generate_pdf(self):
        """GET /api/cotizador/quotes/{id}/pdf - Generate PDF"""
        # First create a quote
        create_response = requests.post(
            f"{BASE_URL}/api/cotizador/quotes",
            headers=self.headers,
            json={
                "client_name": "TEST_PDF Generation",
                "company": "TEST_Company PDF",
                "group": {"direccion": 2, "management": 1, "operacion": 0},
                "currency": "USD",
                "discount_percent": 15,
                "additional_benefits": [],
                "objectives": {
                    "resultado_objetivo": "Test PDF objective",
                    "resultado_descripcion": "Description for PDF",
                    "comportamiento_objetivo": "",
                    "comportamiento_descripcion": "",
                    "aprendizaje_objetivo": "",
                    "aprendizaje_descripcion": "",
                    "experiencia_objetivo": "",
                    "experiencia_descripcion": ""
                },
                "leaderlix_responsible": "Perla",
                "valid_until": "2026-03-31"
            }
        )
        assert create_response.status_code == 200
        quote_id = create_response.json()["id"]
        self.created_quote_ids.append(quote_id)
        
        # Generate PDF
        pdf_response = requests.get(
            f"{BASE_URL}/api/cotizador/quotes/{quote_id}/pdf",
            headers=self.headers
        )
        assert pdf_response.status_code == 200
        assert pdf_response.headers.get("content-type") == "application/pdf"
        assert len(pdf_response.content) > 1000  # PDF should have content
    
    def test_delete_quote(self):
        """DELETE /api/cotizador/quotes/{id} - Delete quote"""
        # First create a quote
        create_response = requests.post(
            f"{BASE_URL}/api/cotizador/quotes",
            headers=self.headers,
            json={
                "client_name": "TEST_Delete Quote",
                "company": "TEST_Company",
                "group": {"direccion": 1, "management": 0, "operacion": 0},
                "currency": "USD",
                "discount_percent": 0,
                "additional_benefits": [],
                "objectives": {}
            }
        )
        quote_id = create_response.json()["id"]
        
        # Delete
        delete_response = requests.delete(
            f"{BASE_URL}/api/cotizador/quotes/{quote_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["success"] == True
        
        # Verify deleted
        get_response = requests.get(
            f"{BASE_URL}/api/cotizador/quotes/{quote_id}",
            headers=self.headers
        )
        assert get_response.status_code == 404
    
    def test_get_nonexistent_quote(self):
        """GET /api/cotizador/quotes/{id} - Nonexistent returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/cotizador/quotes/nonexistent-id-12345",
            headers=self.headers
        )
        assert response.status_code == 404


class TestCotizadorPricing:
    """Test pricing logic accuracy"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        if login_response.status_code != 200:
            pytest.skip("Authentication failed")
        self.token = login_response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_direccion_price_3500(self):
        """Dirección level should be $3,500 USD per person"""
        response = requests.post(
            f"{BASE_URL}/api/cotizador/calculate",
            headers=self.headers,
            json={
                "group": {"direccion": 2, "management": 0, "operacion": 0},
                "currency": "USD",
                "discount_percent": 0,
                "additional_benefits": [],
                "objectives": {}
            }
        )
        data = response.json()
        # 2 x $3,500 = $7,000
        assert data["coaching_subtotal"] == 7000
        assert data["coaching_breakdown"][0]["unit_price"] == 3500
    
    def test_management_price_3000(self):
        """Management level should be $3,000 USD per person"""
        response = requests.post(
            f"{BASE_URL}/api/cotizador/calculate",
            headers=self.headers,
            json={
                "group": {"direccion": 0, "management": 3, "operacion": 0},
                "currency": "USD",
                "discount_percent": 0,
                "additional_benefits": [],
                "objectives": {}
            }
        )
        data = response.json()
        # 3 x $3,000 = $9,000
        assert data["coaching_subtotal"] == 9000
        assert data["coaching_breakdown"][0]["unit_price"] == 3000
    
    def test_operacion_price_2500(self):
        """Operación level should be $2,500 USD per person"""
        response = requests.post(
            f"{BASE_URL}/api/cotizador/calculate",
            headers=self.headers,
            json={
                "group": {"direccion": 0, "management": 0, "operacion": 4},
                "currency": "USD",
                "discount_percent": 0,
                "additional_benefits": [],
                "objectives": {}
            }
        )
        data = response.json()
        # 4 x $2,500 = $10,000
        assert data["coaching_subtotal"] == 10000
        assert data["coaching_breakdown"][0]["unit_price"] == 2500
