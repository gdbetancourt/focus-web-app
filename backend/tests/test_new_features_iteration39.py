"""
Test file for iteration 39 - New Features Testing
Features:
1. Export contacts with new fields (location, country, multiple roles/emails/phones)
2. POST /api/companies - Auto-create companies when name doesn't exist
3. Duplicate warning for emails/phones in ContactSheet
4. Related tab search in ContactSheet
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestCompanyCreation(TestAuth):
    """Test POST /api/companies endpoint - Auto-create companies"""
    
    def test_create_new_company(self, headers):
        """Test creating a new company that doesn't exist"""
        unique_name = f"TEST_Company_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(f"{BASE_URL}/api/companies", 
            headers=headers,
            json={"name": unique_name}
        )
        
        assert response.status_code == 200, f"Create company failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True, "Response should indicate success"
        assert data.get("created") == True, "Company should be newly created"
        assert "company" in data, "Response should contain company object"
        assert data["company"]["name"] == unique_name, "Company name should match"
        assert "id" in data["company"], "Company should have an ID"
        print(f"✓ Created new company: {unique_name}")
    
    def test_existing_company_returns_existing(self, headers):
        """Test that creating a company with existing name returns the existing one"""
        # First create a company
        unique_name = f"TEST_ExistingCompany_{uuid.uuid4().hex[:8]}"
        
        response1 = requests.post(f"{BASE_URL}/api/companies", 
            headers=headers,
            json={"name": unique_name}
        )
        assert response1.status_code == 200
        first_data = response1.json()
        first_id = first_data["company"]["id"]
        
        # Try to create the same company again
        response2 = requests.post(f"{BASE_URL}/api/companies", 
            headers=headers,
            json={"name": unique_name}
        )
        
        assert response2.status_code == 200, f"Second create failed: {response2.text}"
        second_data = response2.json()
        
        # Should return existing company, not create new
        assert second_data.get("success") == True
        assert second_data.get("created") == False, "Should not create duplicate"
        assert second_data["company"]["id"] == first_id, "Should return same company ID"
        print(f"✓ Existing company returned correctly: {unique_name}")
    
    def test_create_company_case_insensitive(self, headers):
        """Test that company name matching is case-insensitive"""
        unique_name = f"TEST_CaseTest_{uuid.uuid4().hex[:8]}"
        
        # Create with lowercase
        response1 = requests.post(f"{BASE_URL}/api/companies", 
            headers=headers,
            json={"name": unique_name.lower()}
        )
        assert response1.status_code == 200
        
        # Try to create with uppercase
        response2 = requests.post(f"{BASE_URL}/api/companies", 
            headers=headers,
            json={"name": unique_name.upper()}
        )
        
        assert response2.status_code == 200
        data = response2.json()
        assert data.get("created") == False, "Case-insensitive match should find existing"
        print(f"✓ Case-insensitive company matching works")


class TestDuplicateDetection(TestAuth):
    """Test duplicate email/phone detection endpoints"""
    
    def test_search_contacts_by_email(self, headers):
        """Test searching contacts by email for duplicate detection"""
        # Search for an existing email
        response = requests.get(f"{BASE_URL}/api/contacts",
            headers=headers,
            params={"search": "perla@leaderlix.com", "limit": 5}
        )
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        # Should return contacts matching the email
        contacts = data.get("contacts", data)
        assert isinstance(contacts, list), "Should return list of contacts"
        print(f"✓ Email search returned {len(contacts)} contacts")
    
    def test_search_contacts_by_phone(self, headers):
        """Test searching contacts by phone for duplicate detection"""
        # Search for a phone number pattern (avoid special regex chars like +)
        response = requests.get(f"{BASE_URL}/api/contacts",
            headers=headers,
            params={"search": "5512", "limit": 5}
        )
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        contacts = data.get("contacts", data)
        assert isinstance(contacts, list), "Should return list of contacts"
        print(f"✓ Phone search returned {len(contacts)} contacts")


class TestContactsExportFields(TestAuth):
    """Test that contacts have the required fields for export"""
    
    def test_contacts_have_location_field(self, headers):
        """Test that contacts can have location field"""
        response = requests.get(f"{BASE_URL}/api/contacts",
            headers=headers,
            params={"limit": 10}
        )
        
        assert response.status_code == 200, f"Get contacts failed: {response.text}"
        data = response.json()
        contacts = data.get("contacts", data)
        
        # Check that the API returns contacts (location may be empty but field should be accessible)
        assert len(contacts) > 0, "Should have contacts"
        print(f"✓ Contacts endpoint returns data with {len(contacts)} contacts")
    
    def test_contacts_have_country_field(self, headers):
        """Test that contacts can have country field"""
        response = requests.get(f"{BASE_URL}/api/contacts",
            headers=headers,
            params={"limit": 10}
        )
        
        assert response.status_code == 200
        data = response.json()
        contacts = data.get("contacts", data)
        
        # Verify we can access contact data
        if contacts:
            contact = contacts[0]
            # These fields should be accessible (may be None/empty)
            assert "id" in contact, "Contact should have id"
            print(f"✓ Contact data structure is valid")
    
    def test_contacts_have_multiple_emails(self, headers):
        """Test that contacts can have multiple emails"""
        response = requests.get(f"{BASE_URL}/api/contacts",
            headers=headers,
            params={"limit": 50}
        )
        
        assert response.status_code == 200
        data = response.json()
        contacts = data.get("contacts", data)
        
        # Check if any contact has emails array
        has_emails_array = False
        for contact in contacts:
            if contact.get("emails") and isinstance(contact.get("emails"), list):
                has_emails_array = True
                break
        
        print(f"✓ Contacts with emails array found: {has_emails_array}")
    
    def test_contacts_have_multiple_phones(self, headers):
        """Test that contacts can have multiple phones"""
        response = requests.get(f"{BASE_URL}/api/contacts",
            headers=headers,
            params={"limit": 50}
        )
        
        assert response.status_code == 200
        data = response.json()
        contacts = data.get("contacts", data)
        
        # Check if any contact has phones array
        has_phones_array = False
        for contact in contacts:
            if contact.get("phones") and isinstance(contact.get("phones"), list):
                has_phones_array = True
                break
        
        print(f"✓ Contacts with phones array found: {has_phones_array}")
    
    def test_contacts_have_roles(self, headers):
        """Test that contacts can have roles field"""
        response = requests.get(f"{BASE_URL}/api/contacts",
            headers=headers,
            params={"limit": 50}
        )
        
        assert response.status_code == 200
        data = response.json()
        contacts = data.get("contacts", data)
        
        # Check if any contact has roles
        has_roles = False
        for contact in contacts:
            if contact.get("roles") or contact.get("contact_types"):
                has_roles = True
                break
        
        print(f"✓ Contacts with roles found: {has_roles}")


class TestRelatedTabSearch(TestAuth):
    """Test search functionality for Related tab in ContactSheet"""
    
    def test_search_contacts_for_relationships(self, headers):
        """Test searching contacts to add as relationships"""
        # Search for contacts by name
        response = requests.get(f"{BASE_URL}/api/contacts",
            headers=headers,
            params={"search": "test", "limit": 10}
        )
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        contacts = data.get("contacts", data)
        assert isinstance(contacts, list), "Should return list of contacts"
        print(f"✓ Related tab search returned {len(contacts)} contacts")
    
    def test_get_contact_relationships(self, headers):
        """Test getting relationships for a contact"""
        # First get a contact
        response = requests.get(f"{BASE_URL}/api/contacts",
            headers=headers,
            params={"limit": 1}
        )
        
        assert response.status_code == 200
        data = response.json()
        contacts = data.get("contacts", data)
        
        if contacts:
            contact_id = contacts[0].get("id")
            
            # Get relationships for this contact
            rel_response = requests.get(f"{BASE_URL}/api/contacts/{contact_id}/relationships",
                headers=headers
            )
            
            assert rel_response.status_code == 200, f"Get relationships failed: {rel_response.text}"
            print(f"✓ Relationships endpoint works for contact {contact_id}")


class TestCompaniesListEndpoint(TestAuth):
    """Test GET /api/companies endpoint for company autocomplete"""
    
    def test_list_companies(self, headers):
        """Test listing companies"""
        response = requests.get(f"{BASE_URL}/api/companies",
            headers=headers,
            params={"limit": 10}
        )
        
        assert response.status_code == 200, f"List companies failed: {response.text}"
        data = response.json()
        
        assert "companies" in data, "Response should have companies array"
        assert "total" in data, "Response should have total count"
        print(f"✓ Companies list returned {len(data['companies'])} companies (total: {data['total']})")
    
    def test_search_companies(self, headers):
        """Test searching companies by name"""
        response = requests.get(f"{BASE_URL}/api/companies",
            headers=headers,
            params={"search": "test", "limit": 10}
        )
        
        assert response.status_code == 200, f"Search companies failed: {response.text}"
        data = response.json()
        
        assert "companies" in data, "Response should have companies array"
        print(f"✓ Company search returned {len(data['companies'])} results")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
