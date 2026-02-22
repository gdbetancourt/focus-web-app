"""
Test suite for LinkedIn Tab Refactor - Mensajes Hoy
Tests the new hierarchical persona_groups structure and pagination features
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://persona-assets.preview.emergentagent.com')


class TestLinkedInByKeywordRefactor:
    """Tests for the refactored LinkedIn by-keyword endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f'{BASE_URL}/api/auth/login', json={
            'email': 'perla@leaderlix.com',
            'password': 'Leaderlix2025'
        })
        assert login_resp.status_code == 200, "Login failed"
        self.token = login_resp.json().get('access_token')
        self.headers = {'Authorization': f'Bearer {self.token}'}
    
    def test_returns_persona_groups_structure(self):
        """Endpoint returns persona_groups instead of keyword_groups"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        # New structure should have persona_groups
        assert 'persona_groups' in data, "Missing persona_groups in response"
        assert isinstance(data['persona_groups'], dict)
        
        # Should NOT have old keyword_groups
        assert 'keyword_groups' not in data, "Old keyword_groups should not exist"
    
    def test_returns_total_counts(self):
        """Endpoint returns total counts for contacts"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert 'total_personas' in data
        assert 'total_contacts' in data
        assert 'total_with_linkedin' in data
        assert 'total_without_linkedin' in data
        
        # Verify counts are integers
        assert isinstance(data['total_personas'], int)
        assert isinstance(data['total_contacts'], int)
        assert isinstance(data['total_with_linkedin'], int)
        assert isinstance(data['total_without_linkedin'], int)
        
        # Verify counts match expected values (from requirements)
        assert data['total_contacts'] == 9963, f"Expected 9963 contacts, got {data['total_contacts']}"
        assert data['total_with_linkedin'] == 876, f"Expected 876 with LinkedIn, got {data['total_with_linkedin']}"
        assert data['total_without_linkedin'] == 9087, f"Expected 9087 without LinkedIn, got {data['total_without_linkedin']}"
        assert data['total_personas'] == 8, f"Expected 8 personas, got {data['total_personas']}"
    
    def test_persona_group_structure(self):
        """Each persona group has correct structure"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        persona_groups = data['persona_groups']
        
        for persona_name, persona_data in persona_groups.items():
            # Each persona should have keywords dict
            assert 'keywords' in persona_data, f"Persona {persona_name} missing keywords"
            assert isinstance(persona_data['keywords'], dict)
            
            # Each persona should have counts
            assert 'total_contacts' in persona_data
            assert 'with_linkedin' in persona_data
            assert 'without_linkedin' in persona_data
            
            # Counts should be integers
            assert isinstance(persona_data['total_contacts'], int)
            assert isinstance(persona_data['with_linkedin'], int)
            assert isinstance(persona_data['without_linkedin'], int)
    
    def test_contact_structure_in_keyword_group(self):
        """Contacts within keyword groups have correct structure"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        persona_groups = data['persona_groups']
        
        # Find first persona with contacts
        for persona_name, persona_data in persona_groups.items():
            for keyword, contacts in persona_data['keywords'].items():
                if contacts:
                    contact = contacts[0]
                    # Verify contact structure
                    assert 'contact_id' in contact
                    assert 'name' in contact
                    assert 'email' in contact
                    assert 'linkedin_url' in contact
                    assert 'has_linkedin' in contact
                    assert 'company' in contact
                    assert 'job_title' in contact
                    assert 'last_contacted' in contact
                    assert 'stage' in contact
                    assert 'buyer_persona' in contact
                    
                    # has_linkedin should be boolean
                    assert isinstance(contact['has_linkedin'], bool)
                    return
        
        pytest.fail("No contacts found to verify structure")
    
    def test_importados_keyword_for_imported_contacts(self):
        """Contacts from import/manual/hubspot sources should have 'Importados' keyword"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        persona_groups = data['persona_groups']
        
        # Check sin_clasificar persona for Importados keyword
        if 'sin_clasificar' in persona_groups:
            keywords = persona_groups['sin_clasificar']['keywords']
            assert 'Importados' in keywords, "Expected 'Importados' keyword in sin_clasificar persona"
    
    def test_all_contacts_included(self):
        """Both contacts with and without linkedin_url are included"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        
        # Total should equal with + without
        assert data['total_contacts'] == data['total_with_linkedin'] + data['total_without_linkedin']
        
        # Verify we have both types
        assert data['total_with_linkedin'] > 0, "Should have contacts with LinkedIn"
        assert data['total_without_linkedin'] > 0, "Should have contacts without LinkedIn"
    
    def test_personas_sorted_by_contact_count(self):
        """Personas should be sorted by total contact count (descending)"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        persona_groups = data['persona_groups']
        
        # Get list of (persona, count) tuples
        persona_counts = [(name, pdata['total_contacts']) for name, pdata in persona_groups.items()]
        
        # Verify sorted descending
        for i in range(len(persona_counts) - 1):
            assert persona_counts[i][1] >= persona_counts[i+1][1], \
                f"Personas not sorted: {persona_counts[i][0]} ({persona_counts[i][1]}) should be >= {persona_counts[i+1][0]} ({persona_counts[i+1][1]})"
    
    def test_keywords_sorted_by_contact_count_within_persona(self):
        """Keywords within each persona should be sorted by contact count (descending)"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        persona_groups = data['persona_groups']
        
        for persona_name, persona_data in persona_groups.items():
            keywords = persona_data['keywords']
            keyword_counts = [(kw, len(contacts)) for kw, contacts in keywords.items()]
            
            # Verify sorted descending
            for i in range(len(keyword_counts) - 1):
                assert keyword_counts[i][1] >= keyword_counts[i+1][1], \
                    f"Keywords in {persona_name} not sorted: {keyword_counts[i][0]} ({keyword_counts[i][1]}) should be >= {keyword_counts[i+1][0]} ({keyword_counts[i+1][1]})"


class TestContactLinkedInUpdate:
    """Tests for updating contact LinkedIn URL"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f'{BASE_URL}/api/auth/login', json={
            'email': 'perla@leaderlix.com',
            'password': 'Leaderlix2025'
        })
        assert login_resp.status_code == 200, "Login failed"
        self.token = login_resp.json().get('access_token')
        self.headers = {'Authorization': f'Bearer {self.token}'}
    
    def test_update_contact_linkedin_url_endpoint_exists(self):
        """PUT /contacts/{id} endpoint exists for updating linkedin_url"""
        resp = requests.put(
            f'{BASE_URL}/api/contacts/nonexistent-test-id',
            headers=self.headers,
            json={'linkedin_url': 'https://linkedin.com/in/test'}
        )
        # Should return 404 for non-existent contact, not 405 (method not allowed)
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        
        data = resp.json()
        assert 'detail' in data
        assert 'not found' in data['detail'].lower()
    
    def test_update_real_contact_linkedin_url(self):
        """Can update linkedin_url for a real contact"""
        # First get a contact without linkedin_url
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        
        # Find a contact without linkedin
        test_contact = None
        for persona_name, persona_data in data['persona_groups'].items():
            for keyword, contacts in persona_data['keywords'].items():
                for contact in contacts:
                    if not contact['has_linkedin']:
                        test_contact = contact
                        break
                if test_contact:
                    break
            if test_contact:
                break
        
        if not test_contact:
            pytest.skip("No contact without LinkedIn found for testing")
        
        # Update the contact's linkedin_url
        test_url = "https://linkedin.com/in/test-update-12345"
        update_resp = requests.put(
            f'{BASE_URL}/api/contacts/{test_contact["contact_id"]}',
            headers=self.headers,
            json={'linkedin_url': test_url}
        )
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
        
        # Verify the update
        verify_resp = requests.get(
            f'{BASE_URL}/api/contacts/{test_contact["contact_id"]}',
            headers=self.headers
        )
        assert verify_resp.status_code == 200
        
        updated_contact = verify_resp.json()
        assert updated_contact.get('linkedin_url') == test_url
        
        # Clean up - remove the test URL
        cleanup_resp = requests.put(
            f'{BASE_URL}/api/contacts/{test_contact["contact_id"]}',
            headers=self.headers,
            json={'linkedin_url': ''}
        )
        assert cleanup_resp.status_code == 200


class TestLinkedInTabRequirements:
    """Tests verifying all requirements from the task"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f'{BASE_URL}/api/auth/login', json={
            'email': 'perla@leaderlix.com',
            'password': 'Leaderlix2025'
        })
        assert login_resp.status_code == 200, "Login failed"
        self.token = login_resp.json().get('access_token')
        self.headers = {'Authorization': f'Bearer {self.token}'}
    
    def test_requirement_1_show_all_contacts(self):
        """Requirement 1: Show ALL contacts (with and without linkedin_url)"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        
        # Both with and without should be present
        assert data['total_with_linkedin'] > 0
        assert data['total_without_linkedin'] > 0
        
        # Total should be sum of both
        assert data['total_contacts'] == data['total_with_linkedin'] + data['total_without_linkedin']
    
    def test_requirement_2_group_by_persona_then_keyword(self):
        """Requirement 2: Group by buyer_persona first, then by keyword"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        
        # Should have persona_groups at top level
        assert 'persona_groups' in data
        
        # Each persona should have keywords
        for persona_name, persona_data in data['persona_groups'].items():
            assert 'keywords' in persona_data
            assert isinstance(persona_data['keywords'], dict)
    
    def test_requirement_3_importados_for_import_manual_hubspot(self):
        """Requirement 3: If no keyword and source is import/manual/hubspot show 'Importados'"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        
        # Check for Importados keyword
        found_importados = False
        for persona_name, persona_data in data['persona_groups'].items():
            if 'Importados' in persona_data['keywords']:
                found_importados = True
                break
        
        assert found_importados, "Expected 'Importados' keyword for imported contacts"
    
    def test_requirement_4_contacts_have_has_linkedin_flag(self):
        """Requirement 4 support: Contacts have has_linkedin flag for frontend pagination"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        
        # Check contacts have has_linkedin flag
        for persona_name, persona_data in data['persona_groups'].items():
            for keyword, contacts in persona_data['keywords'].items():
                for contact in contacts[:5]:  # Check first 5
                    assert 'has_linkedin' in contact
                    assert isinstance(contact['has_linkedin'], bool)
    
    def test_requirement_5_contacts_without_linkedin_flagged(self):
        """Requirement 5 support: Contacts without linkedin_url are flagged"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        
        # Find contacts without linkedin
        contacts_without = []
        for persona_name, persona_data in data['persona_groups'].items():
            for keyword, contacts in persona_data['keywords'].items():
                for contact in contacts:
                    if not contact['has_linkedin']:
                        contacts_without.append(contact)
                        if len(contacts_without) >= 5:
                            break
        
        # Verify they have has_linkedin=False
        for contact in contacts_without:
            assert contact['has_linkedin'] == False
            assert contact['linkedin_url'] == '' or contact['linkedin_url'] is None


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
