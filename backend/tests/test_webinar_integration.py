"""
Test Webinar Integration with Content Matrix
Tests for:
- POST /api/events-v2/from-content-item - crear webinar desde content item
- POST /api/events-v2/{event_id}/import-contacts - importar contactos con lógica de stages
- GET /api/events-v2/contact/{contact_id}/history - historial de webinars de un contacto
- GET /api/events-v2/{event_id}/watching-room - obtener datos del watching room
- POST /api/events-v2/{event_id}/watch-ping - tracking de tiempo de visualización
- DELETE /api/content/items/{item_id} - protección de eliminación si tiene webinar
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://persona-assets.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "perla@leaderlix.com"
TEST_PASSWORD = "Leaderlix2025"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping tests")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="module")
def test_content_item(auth_headers):
    """Create a test content item for webinar tests"""
    # First, get or create a course
    courses_res = requests.get(f"{BASE_URL}/api/content/courses", headers=auth_headers)
    courses = courses_res.json().get("courses", [])
    
    if courses:
        course_id = courses[0]["id"]
    else:
        # Create a test course
        course_res = requests.post(
            f"{BASE_URL}/api/content/courses",
            headers=auth_headers,
            json={"name": "TEST_Webinar_Course", "description": "Test course for webinar"}
        )
        course_id = course_res.json().get("course", {}).get("id")
    
    # Create a test content item
    content_item = {
        "title": f"TEST_Webinar_Content_{uuid.uuid4().hex[:8]}",
        "course_id": course_id,
        "dictation_draft_text": "This is test content for webinar integration testing.",
        "notes": "Test notes"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/content/items",
        headers=auth_headers,
        json=content_item
    )
    
    if response.status_code in [200, 201]:
        item = response.json().get("item", {})
        yield item
        # Cleanup - try to delete the content item (may fail if webinar exists)
        requests.delete(f"{BASE_URL}/api/content/items/{item['id']}", headers=auth_headers)
    else:
        pytest.skip(f"Failed to create test content item: {response.text}")


@pytest.fixture(scope="module")
def test_contact(auth_headers):
    """Create a test contact for webinar tests"""
    contact_data = {
        "name": f"TEST_Webinar_Contact_{uuid.uuid4().hex[:8]}",
        "email": f"test_webinar_{uuid.uuid4().hex[:8]}@test.com",
        "first_name": "Test",
        "last_name": "Webinar",
        "stage": 1,
        "buyer_persona": "mateo"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/contacts",
        headers=auth_headers,
        json=contact_data
    )
    
    if response.status_code in [200, 201]:
        contact = response.json().get("contact", response.json())
        yield contact
        # Cleanup
        requests.delete(f"{BASE_URL}/api/contacts/{contact['id']}", headers=auth_headers)
    else:
        pytest.skip(f"Failed to create test contact: {response.text}")


class TestWebinarFromContentItem:
    """Tests for creating webinar from content item"""
    
    def test_create_webinar_from_content_item(self, auth_headers, test_content_item):
        """Test POST /api/events-v2/from-content-item"""
        webinar_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/events-v2/from-content-item",
            headers=auth_headers,
            json={
                "content_item_id": test_content_item["id"],
                "webinar_date": webinar_date,
                "webinar_time": "10:00",
                "auto_enroll_lms": True,
                "create_youtube_live": False  # Don't create YouTube Live for tests
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        assert "event" in data
        
        event = data["event"]
        assert event.get("content_item_id") == test_content_item["id"]
        assert event.get("webinar_date") == webinar_date
        assert event.get("name") == test_content_item["title"]
        assert "id" in event
        assert "slug" in event
        assert "tasks" in event
        
        # Store event ID for cleanup
        pytest.webinar_event_id = event["id"]
    
    def test_create_duplicate_webinar_fails(self, auth_headers, test_content_item):
        """Test that creating a second webinar for same content item fails"""
        webinar_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/events-v2/from-content-item",
            headers=auth_headers,
            json={
                "content_item_id": test_content_item["id"],
                "webinar_date": webinar_date,
                "webinar_time": "10:00",
                "auto_enroll_lms": True,
                "create_youtube_live": False
            }
        )
        
        # Should fail with 409 Conflict
        assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.text}"
        assert "already has a webinar" in response.json().get("detail", "").lower()


class TestContentItemDeletionProtection:
    """Tests for content item deletion protection when webinar exists"""
    
    def test_delete_content_item_with_webinar_fails(self, auth_headers, test_content_item):
        """Test DELETE /api/content/items/{item_id} fails when webinar exists"""
        response = requests.delete(
            f"{BASE_URL}/api/content/items/{test_content_item['id']}",
            headers=auth_headers
        )
        
        # Should fail with 409 Conflict
        assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.text}"
        assert "webinar" in response.json().get("detail", "").lower()


class TestImportContacts:
    """Tests for importing contacts to webinar with stage logic"""
    
    def test_import_contacts_to_webinar(self, auth_headers):
        """Test POST /api/events-v2/{event_id}/import-contacts"""
        # Get any existing webinar
        events_res = requests.get(f"{BASE_URL}/api/events-v2/", headers=auth_headers)
        events = events_res.json()
        if not events:
            pytest.skip("No webinar event available for testing")
        event_id = events[0]["id"]
        
        # Create a test contact for import
        test_email = f"test_import_{uuid.uuid4().hex[:8]}@test.com"
        
        # Import contacts
        contacts_to_import = [
            {
                "email": test_email,
                "firstname": "Test",
                "lastname": "Import",
                "company": "Test Company",
                "jobtitle": "Test Title"
            }
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/events-v2/{event_id}/import-contacts",
            headers=auth_headers,
            json={
                "contacts": contacts_to_import,
                "import_as": "registered",
                "send_calendar_invite": False  # Don't send calendar invites in tests
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "imported" in data or "updated" in data
        assert data.get("total") == 1
        
        # Cleanup - delete the test contact
        search_res = requests.get(f"{BASE_URL}/api/contacts?search={test_email}", headers=auth_headers)
        if search_res.status_code == 200:
            contacts = search_res.json().get("contacts", [])
            for c in contacts:
                requests.delete(f"{BASE_URL}/api/contacts/{c['id']}", headers=auth_headers)
    
    def test_import_contacts_stage_logic_new_contact(self, auth_headers):
        """Test that new contacts go to Stage 2"""
        event_id = getattr(pytest, 'webinar_event_id', None)
        if not event_id:
            events_res = requests.get(f"{BASE_URL}/api/events-v2/", headers=auth_headers)
            events = events_res.json()
            if events:
                event_id = events[0]["id"]
            else:
                pytest.skip("No webinar event available for testing")
        
        # Create a new contact via import
        new_email = f"test_new_stage_{uuid.uuid4().hex[:8]}@test.com"
        contacts_to_import = [
            {
                "email": new_email,
                "firstname": "New",
                "lastname": "Contact"
            }
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/events-v2/{event_id}/import-contacts",
            headers=auth_headers,
            json={
                "contacts": contacts_to_import,
                "import_as": "registered",
                "send_calendar_invite": False
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("imported", 0) >= 1 or data.get("updated", 0) >= 1
        
        # Verify the contact was created with Stage 2
        search_res = requests.get(
            f"{BASE_URL}/api/contacts?search={new_email}",
            headers=auth_headers
        )
        
        if search_res.status_code == 200:
            contacts = search_res.json().get("contacts", [])
            if contacts:
                contact = contacts[0]
                assert contact.get("stage") == 2, f"Expected stage 2, got {contact.get('stage')}"
                # Cleanup
                requests.delete(f"{BASE_URL}/api/contacts/{contact['id']}", headers=auth_headers)


class TestContactWebinarHistory:
    """Tests for contact webinar history"""
    
    def test_get_contact_webinar_history(self, auth_headers):
        """Test GET /api/events-v2/contact/{contact_id}/history"""
        # Get any contact that has webinar history
        contacts_res = requests.get(f"{BASE_URL}/api/contacts?limit=10", headers=auth_headers)
        contacts = contacts_res.json().get("contacts", [])
        if not contacts:
            pytest.skip("No contacts available for testing")
        
        # Try first few contacts to find one with webinar history
        for contact in contacts[:5]:
            response = requests.get(
                f"{BASE_URL}/api/events-v2/contact/{contact['id']}/history",
                headers=auth_headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                assert "contact_id" in data
                assert "webinar_history" in data
                assert "total_webinars" in data
                assert "attended_count" in data
                assert "total_watch_time" in data
                
                assert isinstance(data["webinar_history"], list)
                return  # Test passed
        
        # If no contact has history, just verify the endpoint works
        response = requests.get(
            f"{BASE_URL}/api/events-v2/contact/{contacts[0]['id']}/history",
            headers=auth_headers
        )
        assert response.status_code == 200


class TestWatchingRoom:
    """Tests for watching room functionality"""
    
    def test_get_watching_room(self, auth_headers):
        """Test GET /api/events-v2/{event_id}/watching-room"""
        events_res = requests.get(f"{BASE_URL}/api/events-v2/", headers=auth_headers)
        events = events_res.json()
        if not events:
            pytest.skip("No webinar event available for testing")
        event_id = events[0]["id"]
        
        # Get a contact
        contacts_res = requests.get(f"{BASE_URL}/api/contacts?limit=1", headers=auth_headers)
        contacts = contacts_res.json().get("contacts", [])
        if not contacts:
            pytest.skip("No contacts available for testing")
        contact_id = contacts[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/events-v2/{event_id}/watching-room?contact_id={contact_id}",
            headers=auth_headers
        )
        
        # May return 403 if not enrolled, or 200 if enrolled
        assert response.status_code in [200, 403], f"Expected 200 or 403, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "event_id" in data
            assert "name" in data
            assert "webinar_date" in data
    
    def test_watch_ping(self, auth_headers):
        """Test POST /api/events-v2/{event_id}/watch-ping"""
        events_res = requests.get(f"{BASE_URL}/api/events-v2/", headers=auth_headers)
        events = events_res.json()
        if not events:
            pytest.skip("No webinar event available for testing")
        event_id = events[0]["id"]
        
        # Get a contact
        contacts_res = requests.get(f"{BASE_URL}/api/contacts?limit=1", headers=auth_headers)
        contacts = contacts_res.json().get("contacts", [])
        if not contacts:
            pytest.skip("No contacts available for testing")
        contact_id = contacts[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/events-v2/{event_id}/watch-ping",
            headers=auth_headers,
            json={"contact_id": contact_id}
        )
        
        # May return 404 if contact not found in webinar, or 200 if found
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "watch_time_seconds" in data


class TestExistingWebinar:
    """Tests using the existing test webinar (ID: 4c8c64f9-1640-48aa-81eb-f2cb5f895ccf)"""
    
    def test_get_existing_webinar(self, auth_headers):
        """Test GET /api/events-v2/{event_id} for existing webinar"""
        event_id = "4c8c64f9-1640-48aa-81eb-f2cb5f895ccf"
        
        response = requests.get(
            f"{BASE_URL}/api/events-v2/{event_id}",
            headers=auth_headers
        )
        
        # May return 404 if webinar was deleted, or 200 if exists
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            assert "name" in data
            assert "webinar_date" in data
            assert "tasks" in data
            assert "traffic_light" in data
        else:
            # Webinar may have been deleted, skip
            pytest.skip("Test webinar not found")
    
    def test_list_all_webinars(self, auth_headers):
        """Test GET /api/events-v2/ lists all webinars"""
        response = requests.get(
            f"{BASE_URL}/api/events-v2/",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        
        # Verify structure of each event
        for event in data[:3]:  # Check first 3
            assert "id" in event
            assert "name" in event
            assert "webinar_date" in event
            assert "traffic_light" in event


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_webinar(self, auth_headers):
        """Delete test webinar"""
        event_id = getattr(pytest, 'webinar_event_id', None)
        if event_id:
            response = requests.delete(
                f"{BASE_URL}/api/events-v2/{event_id}",
                headers=auth_headers
            )
            # May succeed or fail if already deleted
            assert response.status_code in [200, 404]
