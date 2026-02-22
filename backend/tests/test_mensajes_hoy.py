"""
Test suite for Mensajes de Hoy module - Phase 2
Tests WhatsApp and LinkedIn message generation endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://persona-assets.preview.emergentagent.com')


class TestMensajesHoyAuth:
    """Authentication tests for Mensajes de Hoy endpoints"""
    
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
    
    def test_stats_requires_auth(self):
        """Stats endpoint requires authentication"""
        resp = requests.get(f'{BASE_URL}/api/mensajes-hoy/stats')
        assert resp.status_code == 401
    
    def test_whatsapp_requires_auth(self):
        """WhatsApp endpoint requires authentication"""
        resp = requests.get(f'{BASE_URL}/api/mensajes-hoy/whatsapp/meeting-confirmations')
        assert resp.status_code == 401
    
    def test_linkedin_requires_auth(self):
        """LinkedIn endpoint requires authentication"""
        resp = requests.get(f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword')
        assert resp.status_code == 401


class TestMensajesHoyStats:
    """Tests for stats endpoint"""
    
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
    
    def test_stats_returns_correct_structure(self):
        """Stats endpoint returns correct data structure"""
        resp = requests.get(f'{BASE_URL}/api/mensajes-hoy/stats', headers=self.headers)
        assert resp.status_code == 200
        
        data = resp.json()
        assert 'stage_counts' in data
        assert 'contacted_today' in data
        
        # Check stage_counts structure
        stage_counts = data['stage_counts']
        assert 'stage_1' in stage_counts
        assert 'stage_2' in stage_counts
        assert 'stage_3' in stage_counts
        assert 'stage_4' in stage_counts
        
        # Check contacted_today structure
        contacted = data['contacted_today']
        assert 'whatsapp' in contacted
        assert 'linkedin' in contacted
        
        # Values should be integers
        assert isinstance(contacted['whatsapp'], int)
        assert isinstance(contacted['linkedin'], int)


class TestWhatsAppMeetingConfirmations:
    """Tests for WhatsApp meeting confirmations endpoint"""
    
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
    
    def test_option_1_never_contacted(self):
        """Option 1: Meetings in next 21 days, never contacted"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/meeting-confirmations?option=1',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert 'contacts' in data
        assert isinstance(data['contacts'], list)
        
        # If contacts exist, verify structure
        if data['contacts']:
            contact = data['contacts'][0]
            assert 'contact_id' in contact
            assert 'name' in contact
            assert 'message' in contact
            assert 'meeting_date' in contact
            assert 'meeting_title' in contact
    
    def test_option_2_contacted_7_days_ago(self):
        """Option 2: Meetings in next 21 days, contacted more than 7 days ago"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/meeting-confirmations?option=2',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert 'contacts' in data
        assert isinstance(data['contacts'], list)
    
    def test_option_3_meeting_tomorrow(self):
        """Option 3: Meeting tomorrow"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/meeting-confirmations?option=3',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert 'contacts' in data
        assert isinstance(data['contacts'], list)
    
    def test_option_4_meeting_today(self):
        """Option 4: Meeting today"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/meeting-confirmations?option=4',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert 'contacts' in data
        assert isinstance(data['contacts'], list)
    
    def test_invalid_option_defaults_to_1(self):
        """Invalid option should default to option 1 behavior"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/meeting-confirmations?option=99',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert 'contacts' in data


class TestWhatsAppStudentsAndQuotes:
    """Tests for WhatsApp students and quotes endpoints"""
    
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
    
    def test_students_endpoint(self):
        """Students endpoint returns correct structure"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/students',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert 'contacts' in data
        assert isinstance(data['contacts'], list)
    
    def test_quotes_endpoint(self):
        """Quotes endpoint returns correct structure"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/quotes',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert 'contacts' in data
        assert isinstance(data['contacts'], list)


class TestLinkedInKeywords:
    """Tests for LinkedIn by keyword endpoint"""
    
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
    
    def test_linkedin_by_keyword_returns_groups(self):
        """LinkedIn by keyword returns keyword groups"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/by-keyword',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert 'keyword_groups' in data
        assert isinstance(data['keyword_groups'], dict)
        
        # If groups exist, verify structure
        if data['keyword_groups']:
            for keyword, contacts in data['keyword_groups'].items():
                assert isinstance(keyword, str)
                assert isinstance(contacts, list)
                
                if contacts:
                    contact = contacts[0]
                    assert 'contact_id' in contact
                    assert 'name' in contact
                    assert 'linkedin_url' in contact


class TestMarkContacted:
    """Tests for mark-contacted endpoint"""
    
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
    
    def test_mark_contacted_whatsapp(self):
        """Mark contacted for WhatsApp updates correct field"""
        resp = requests.post(
            f'{BASE_URL}/api/mensajes-hoy/mark-contacted',
            headers=self.headers,
            json={
                'contact_ids': ['test-nonexistent-id'],
                'message_type': 'whatsapp'
            }
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert data['success'] == True
        assert data['field_updated'] == 'last_contacted_whatsapp'
    
    def test_mark_contacted_linkedin(self):
        """Mark contacted for LinkedIn updates correct field"""
        resp = requests.post(
            f'{BASE_URL}/api/mensajes-hoy/mark-contacted',
            headers=self.headers,
            json={
                'contact_ids': ['test-nonexistent-id'],
                'message_type': 'linkedin'
            }
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert data['success'] == True
        assert data['field_updated'] == 'last_contacted_linkedin'
    
    def test_mark_contacted_empty_list(self):
        """Mark contacted with empty list returns success"""
        resp = requests.post(
            f'{BASE_URL}/api/mensajes-hoy/mark-contacted',
            headers=self.headers,
            json={
                'contact_ids': [],
                'message_type': 'whatsapp'
            }
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert data['success'] == True
        assert data['updated'] == 0


class TestContactDataIntegrity:
    """Tests for contact data integrity in responses"""
    
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
    
    def test_whatsapp_contacts_have_messages(self):
        """WhatsApp contacts should have generated messages"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/meeting-confirmations?option=1',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        contacts = data.get('contacts', [])
        
        for contact in contacts[:5]:  # Check first 5
            assert contact.get('message'), f"Contact {contact.get('name')} has no message"
            assert len(contact['message']) > 10, "Message too short"
    
    def test_whatsapp_contacts_have_meeting_info(self):
        """WhatsApp contacts should have meeting information"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/meeting-confirmations?option=1',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        contacts = data.get('contacts', [])
        
        for contact in contacts[:5]:  # Check first 5
            assert contact.get('meeting_date'), f"Contact {contact.get('name')} has no meeting_date"
            assert contact.get('meeting_title'), f"Contact {contact.get('name')} has no meeting_title"


# ============ PHASE 3 TESTS ============

class TestLinkedInActiveEvents:
    """Tests for LinkedIn Active Events endpoint (1.3.2)"""
    
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
    
    def test_active_events_requires_auth(self):
        """Active events endpoint requires authentication"""
        resp = requests.get(f'{BASE_URL}/api/mensajes-hoy/linkedin/active-events')
        assert resp.status_code == 401
    
    def test_active_events_returns_correct_structure(self):
        """Active events endpoint returns correct data structure"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/active-events',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert 'events' in data
        assert 'count' in data
        assert 'urls_copyable' in data
        assert isinstance(data['events'], list)
        assert isinstance(data['count'], int)
    
    def test_active_events_have_required_fields(self):
        """Active events should have required fields"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/active-events',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        events = data.get('events', [])
        
        for event in events:
            assert 'id' in event
            assert 'name' in event
            assert 'date' in event
            assert 'linkedin_url' in event
            assert 'status' in event
            # linkedin_url should be a valid URL
            assert event['linkedin_url'].startswith('http')
    
    def test_urls_copyable_contains_all_urls(self):
        """urls_copyable should contain all event URLs"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/linkedin/active-events',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        events = data.get('events', [])
        urls_copyable = data.get('urls_copyable', '')
        
        # Each event URL should be in the copyable text
        for event in events:
            if event.get('linkedin_url'):
                assert event['linkedin_url'] in urls_copyable


class TestWhatsAppSmallBusinesses:
    """Tests for WhatsApp Small Businesses endpoint (1.3.3)"""
    
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
    
    def test_small_businesses_requires_auth(self):
        """Small businesses endpoint requires authentication"""
        resp = requests.get(f'{BASE_URL}/api/mensajes-hoy/whatsapp/small-businesses')
        assert resp.status_code == 401
    
    def test_small_businesses_default_cooldown(self):
        """Small businesses endpoint with default cooldown (7 days)"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/small-businesses',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert 'contacts' in data
        assert 'count' in data
        assert 'cooldown_days' in data
        assert 'description' in data
        
        # Default cooldown should be 7
        assert data['cooldown_days'] == 7
        assert isinstance(data['contacts'], list)
    
    def test_small_businesses_custom_cooldown_3_days(self):
        """Small businesses endpoint with 3 days cooldown"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/small-businesses?cooldown_days=3',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert data['cooldown_days'] == 3
        assert '3' in data['description']
    
    def test_small_businesses_custom_cooldown_14_days(self):
        """Small businesses endpoint with 14 days cooldown"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/small-businesses?cooldown_days=14',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert data['cooldown_days'] == 14
    
    def test_small_businesses_custom_cooldown_30_days(self):
        """Small businesses endpoint with 30 days cooldown"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/small-businesses?cooldown_days=30',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert data['cooldown_days'] == 30
    
    def test_small_businesses_contact_structure(self):
        """Small businesses contacts have required fields"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/small-businesses',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        contacts = data.get('contacts', [])
        
        for contact in contacts[:5]:  # Check first 5
            assert 'contact_id' in contact
            assert 'name' in contact
            assert 'phone' in contact
            assert 'message' in contact
            assert 'message_type' in contact
            assert 'category' in contact
            
            # Phone should be present (required for WhatsApp)
            assert contact['phone'], f"Contact {contact['name']} has no phone"
            
            # Category should be small_business
            assert contact['category'] == 'small_business'
            assert contact['message_type'] == 'whatsapp'
    
    def test_small_businesses_have_messages(self):
        """Small businesses should have generated messages"""
        resp = requests.get(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/small-businesses',
            headers=self.headers
        )
        assert resp.status_code == 200
        
        data = resp.json()
        contacts = data.get('contacts', [])
        
        for contact in contacts[:5]:  # Check first 5
            assert contact.get('message'), f"Contact {contact.get('name')} has no message"
            assert len(contact['message']) > 10, "Message too short"


class TestMarkBusinessContacted:
    """Tests for mark business contacted endpoint"""
    
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
    
    def test_mark_business_contacted_requires_auth(self):
        """Mark business contacted requires authentication"""
        resp = requests.post(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/mark-business-contacted',
            json=['test-id']
        )
        assert resp.status_code == 401
    
    def test_mark_business_contacted_empty_list(self):
        """Mark business contacted with empty list returns success"""
        resp = requests.post(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/mark-business-contacted',
            headers=self.headers,
            json=[]
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert data['success'] == True
        assert data['updated'] == 0
    
    def test_mark_business_contacted_nonexistent_id(self):
        """Mark business contacted with nonexistent ID returns success with 0 updated"""
        resp = requests.post(
            f'{BASE_URL}/api/mensajes-hoy/whatsapp/mark-business-contacted',
            headers=self.headers,
            json=['nonexistent-test-id-12345']
        )
        assert resp.status_code == 200
        
        data = resp.json()
        assert data['success'] == True
        assert data['updated'] == 0


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
