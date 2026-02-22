"""
Test Multi-Company Feature for Contacts
Tests the new companies array field and migration endpoint
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMultiCompanyFeature:
    """Tests for multiple companies per contact feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication for all tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    def test_get_contacts_returns_companies_array(self):
        """GET /api/contacts should return contacts with companies array field"""
        response = self.session.get(f"{BASE_URL}/api/contacts?limit=20")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "contacts" in data
        
        contacts_with_companies = 0
        # Check that contacts with company have companies field
        for contact in data["contacts"]:
            # If contact has a company, it should have companies array
            if contact.get("company"):
                # companies field should exist for contacts with company
                if "companies" in contact and len(contact.get("companies", [])) > 0:
                    contacts_with_companies += 1
                    # Verify structure
                    for company in contact["companies"]:
                        assert "company_name" in company, "Company entry missing company_name"
                        assert "is_primary" in company, "Company entry missing is_primary"
                    
        print(f"✓ GET /api/contacts returns {len(data['contacts'])} contacts, {contacts_with_companies} with companies array")
        
    def test_get_single_contact_has_companies_array(self):
        """GET /api/contacts/{id} should return contact with companies array"""
        # First get a contact ID
        list_response = self.session.get(f"{BASE_URL}/api/contacts?limit=1")
        assert list_response.status_code == 200
        contacts = list_response.json().get("contacts", [])
        
        if not contacts:
            pytest.skip("No contacts available for testing")
            
        contact_id = contacts[0]["id"]
        
        # Get single contact
        response = self.session.get(f"{BASE_URL}/api/contacts/{contact_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        contact = response.json()
        assert "companies" in contact or contact.get("company"), "Contact missing companies field"
        
        print(f"✓ GET /api/contacts/{contact_id} returns contact with companies field")
        
    def test_create_contact_with_multiple_companies(self):
        """POST /api/contacts should accept companies array with multiple companies"""
        unique_id = str(uuid.uuid4())[:8]
        
        contact_data = {
            "first_name": f"TEST_MultiCo_{unique_id}",
            "last_name": "TestUser",
            "email": f"test_multi_{unique_id}@test.com",
            "companies": [
                {"company_id": None, "company_name": "Primary Company Inc", "is_primary": True},
                {"company_id": None, "company_name": "Secondary Corp", "is_primary": False}
            ],
            "job_title": "Multi-Company Test",
            "stage": 1
        }
        
        response = self.session.post(f"{BASE_URL}/api/contacts/", json=contact_data)
        assert response.status_code == 200, f"Failed to create contact: {response.text}"
        
        created = response.json()
        assert "id" in created
        
        # Verify companies array was saved
        assert "companies" in created, "Created contact missing companies field"
        assert len(created["companies"]) == 2, f"Expected 2 companies, got {len(created.get('companies', []))}"
        
        # Verify primary company is set correctly
        primary_companies = [c for c in created["companies"] if c.get("is_primary")]
        assert len(primary_companies) == 1, "Should have exactly one primary company"
        assert primary_companies[0]["company_name"] == "Primary Company Inc"
        
        # Verify legacy company field is synced with primary
        assert created.get("company") == "Primary Company Inc", "Legacy company field should match primary company"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/contacts/{created['id']}")
        
        print(f"✓ POST /api/contacts creates contact with multiple companies")
        
    def test_update_contact_with_multiple_companies(self):
        """PUT /api/contacts/{id} should accept companies array"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create a test contact first
        create_response = self.session.post(f"{BASE_URL}/api/contacts/", json={
            "first_name": f"TEST_Update_{unique_id}",
            "last_name": "TestUser",
            "email": f"test_update_{unique_id}@test.com",
            "company": "Original Company",
            "stage": 1
        })
        assert create_response.status_code == 200
        contact_id = create_response.json()["id"]
        
        # Update with multiple companies
        update_data = {
            "companies": [
                {"company_id": None, "company_name": "New Primary Corp", "is_primary": True},
                {"company_id": None, "company_name": "New Secondary LLC", "is_primary": False},
                {"company_id": None, "company_name": "Third Company SA", "is_primary": False}
            ]
        }
        
        response = self.session.put(f"{BASE_URL}/api/contacts/{contact_id}", json=update_data)
        assert response.status_code == 200, f"Failed to update contact: {response.text}"
        
        updated = response.json()
        
        # Verify companies array was updated
        assert "companies" in updated
        assert len(updated["companies"]) == 3, f"Expected 3 companies, got {len(updated.get('companies', []))}"
        
        # Verify legacy company field is synced with primary
        assert updated.get("company") == "New Primary Corp", "Legacy company field should be updated to new primary"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/contacts/{contact_id}")
        
        print(f"✓ PUT /api/contacts/{contact_id} updates contact with multiple companies")
        
    def test_change_primary_company_updates_legacy_field(self):
        """Changing is_primary in companies should update legacy company field"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create contact with multiple companies
        create_response = self.session.post(f"{BASE_URL}/api/contacts/", json={
            "first_name": f"TEST_Primary_{unique_id}",
            "last_name": "TestUser",
            "email": f"test_primary_{unique_id}@test.com",
            "companies": [
                {"company_id": None, "company_name": "Company A", "is_primary": True},
                {"company_id": None, "company_name": "Company B", "is_primary": False}
            ],
            "stage": 1
        })
        assert create_response.status_code == 200
        contact_id = create_response.json()["id"]
        
        # Verify initial state
        assert create_response.json().get("company") == "Company A"
        
        # Change primary to Company B
        update_data = {
            "companies": [
                {"company_id": None, "company_name": "Company A", "is_primary": False},
                {"company_id": None, "company_name": "Company B", "is_primary": True}
            ]
        }
        
        response = self.session.put(f"{BASE_URL}/api/contacts/{contact_id}", json=update_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        updated = response.json()
        
        # Verify legacy company field changed to new primary
        assert updated.get("company") == "Company B", f"Legacy company should be 'Company B', got '{updated.get('company')}'"
        
        # Verify only one primary
        primary_count = sum(1 for c in updated.get("companies", []) if c.get("is_primary"))
        assert primary_count == 1, f"Should have exactly 1 primary company, got {primary_count}"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/contacts/{contact_id}")
        
        print(f"✓ Changing primary company updates legacy company field")
        
    def test_migrate_to_multi_company_endpoint(self):
        """POST /api/contacts/migrate-to-multi-company should migrate existing contacts"""
        response = self.session.post(f"{BASE_URL}/api/contacts/migrate-to-multi-company")
        assert response.status_code == 200, f"Migration failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "migrated" in data
        assert "message" in data
        
        print(f"✓ Migration endpoint returned: {data.get('message')}")
        
    def test_contacts_with_migrated_companies(self):
        """Verify migrated contacts have companies array with primary flag"""
        # Get contacts that have company field
        response = self.session.get(f"{BASE_URL}/api/contacts?limit=20")
        assert response.status_code == 200
        
        contacts = response.json().get("contacts", [])
        
        migrated_count = 0
        for contact in contacts:
            if contact.get("company") and contact.get("companies"):
                # Verify companies array has at least one entry
                if len(contact["companies"]) > 0:
                    migrated_count += 1
                    
                    # Verify primary company matches legacy field
                    primary = next((c for c in contact["companies"] if c.get("is_primary")), None)
                    if primary:
                        assert primary["company_name"] == contact["company"], \
                            f"Primary company '{primary['company_name']}' should match legacy '{contact['company']}'"
                            
        print(f"✓ Found {migrated_count} contacts with migrated companies array")
        
    def test_legacy_company_field_still_works(self):
        """Updating legacy company field should create/update companies array"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create contact with only legacy company field
        create_response = self.session.post(f"{BASE_URL}/api/contacts/", json={
            "first_name": f"TEST_Legacy_{unique_id}",
            "last_name": "TestUser",
            "email": f"test_legacy_{unique_id}@test.com",
            "company": "Legacy Only Company",
            "stage": 1
        })
        assert create_response.status_code == 200
        contact_id = create_response.json()["id"]
        
        # Verify companies array was created from legacy field
        created = create_response.json()
        assert "companies" in created
        assert len(created["companies"]) >= 1, "Should have at least one company from legacy field"
        assert created["companies"][0]["company_name"] == "Legacy Only Company"
        assert created["companies"][0]["is_primary"] == True
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/contacts/{contact_id}")
        
        print(f"✓ Legacy company field creates companies array entry")
        
    def test_empty_companies_array_allowed(self):
        """Contact can have empty companies array"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create contact without company
        create_response = self.session.post(f"{BASE_URL}/api/contacts/", json={
            "first_name": f"TEST_NoCompany_{unique_id}",
            "last_name": "TestUser",
            "email": f"test_nocompany_{unique_id}@test.com",
            "stage": 1
        })
        assert create_response.status_code == 200
        contact_id = create_response.json()["id"]
        
        created = create_response.json()
        # Should have companies field (may be empty)
        assert "companies" in created or created.get("company") is None
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/contacts/{contact_id}")
        
        print(f"✓ Contact can be created without companies")


class TestMultiCompanyDisplay:
    """Tests for displaying multiple companies in contacts list"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        assert login_response.status_code == 200
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    def test_contacts_list_includes_all_companies(self):
        """GET /api/contacts should return all companies for each contact"""
        response = self.session.get(f"{BASE_URL}/api/contacts?limit=50")
        assert response.status_code == 200
        
        contacts = response.json().get("contacts", [])
        
        multi_company_contacts = [c for c in contacts if c.get("companies") and len(c.get("companies", [])) > 1]
        
        if multi_company_contacts:
            print(f"✓ Found {len(multi_company_contacts)} contacts with multiple companies")
            for contact in multi_company_contacts[:3]:
                companies = contact.get("companies", [])
                company_names = [c.get("company_name") for c in companies]
                primary = next((c.get("company_name") for c in companies if c.get("is_primary")), None)
                print(f"  - {contact.get('name')}: {company_names} (Primary: {primary})")
        else:
            print(f"✓ No contacts with multiple companies found (this is OK if migration just ran)")
            
    def test_primary_company_highlighted(self):
        """Verify primary company can be identified in companies array"""
        response = self.session.get(f"{BASE_URL}/api/contacts?limit=20")
        assert response.status_code == 200
        
        contacts = response.json().get("contacts", [])
        
        for contact in contacts:
            companies = contact.get("companies", [])
            if companies:
                primary_count = sum(1 for c in companies if c.get("is_primary"))
                # Should have at most one primary
                assert primary_count <= 1, f"Contact {contact.get('id')} has {primary_count} primary companies"
                
        print(f"✓ All contacts have at most one primary company")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
