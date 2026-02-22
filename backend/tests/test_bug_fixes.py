"""
Bug Fixes Test Suite - Testing critical bug fixes in Focus application
Tests: VenueFinder, Write Books New Chapter, Events Edit, Apify Alerts
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://persona-assets.preview.emergentagent.com')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "perla@leaderlix.com", "password": "Leaderlix2025"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestVenueFinder:
    """Test VenueFinder CRUD operations - Bug fix: VenueFinder was showing iframe instead of native UI"""
    
    def test_list_venues(self, auth_headers):
        """Test GET /api/venues/ endpoint"""
        response = requests.get(f"{BASE_URL}/api/venues/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "venues" in data
        assert "count" in data
        print(f"Found {data['count']} venues")
    
    def test_create_venue(self, auth_headers):
        """Test POST /api/venues/ endpoint"""
        venue_data = {
            "name": "TEST_Venue_BugFix",
            "type": "hotel",
            "city": "CDMX",
            "status": "researching",
            "capacity": "100-200",
            "price_range": "$5,000-$10,000"
        }
        response = requests.post(f"{BASE_URL}/api/venues/", headers=auth_headers, json=venue_data)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "venue" in data
        assert data["venue"]["name"] == "TEST_Venue_BugFix"
        assert data["venue"]["type"] == "hotel"
        assert data["venue"]["city"] == "CDMX"
        
        # Store venue ID for cleanup
        venue_id = data["venue"]["id"]
        print(f"Created venue: {venue_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/venues/{venue_id}", headers=auth_headers)
    
    def test_update_venue(self, auth_headers):
        """Test PUT /api/venues/{id} endpoint"""
        # Create venue first
        venue_data = {"name": "TEST_Venue_Update", "type": "hotel", "city": "Monterrey"}
        create_response = requests.post(f"{BASE_URL}/api/venues/", headers=auth_headers, json=venue_data)
        venue_id = create_response.json()["venue"]["id"]
        
        # Update venue
        update_data = {"status": "contacted", "city": "Guadalajara"}
        response = requests.put(f"{BASE_URL}/api/venues/{venue_id}", headers=auth_headers, json=update_data)
        assert response.status_code == 200
        assert response.json().get("success") == True
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/venues/{venue_id}", headers=auth_headers)
        assert get_response.status_code == 200
        assert get_response.json()["status"] == "contacted"
        assert get_response.json()["city"] == "Guadalajara"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/venues/{venue_id}", headers=auth_headers)


class TestWriteBooksChapter:
    """Test Write Books chapter creation - Bug fix: New Chapter button wasn't working due to required book_id in body"""
    
    def test_list_books(self, auth_headers):
        """Test GET /api/books/ endpoint"""
        response = requests.get(f"{BASE_URL}/api/books/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "books" in data
        print(f"Found {len(data['books'])} books")
    
    def test_create_chapter_without_book_id_in_body(self, auth_headers):
        """Test POST /api/books/{book_id}/chapters - book_id should be optional in body (taken from URL)"""
        # First get a book
        books_response = requests.get(f"{BASE_URL}/api/books/", headers=auth_headers)
        books = books_response.json().get("books", [])
        
        if not books:
            # Create a book first
            book_data = {"title": "TEST_Book_ChapterFix", "target_word_count": 10000}
            book_response = requests.post(f"{BASE_URL}/api/books/", headers=auth_headers, json=book_data)
            book_id = book_response.json()["book"]["id"]
        else:
            book_id = books[0]["id"]
        
        # Create chapter WITHOUT book_id in body (this was the bug - it was required before)
        chapter_data = {
            "title": "TEST_Chapter_BugFix",
            "description": "Testing chapter creation without book_id in body",
            "status": "outline"
        }
        response = requests.post(f"{BASE_URL}/api/books/{book_id}/chapters", headers=auth_headers, json=chapter_data)
        assert response.status_code == 200, f"Chapter creation failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "chapter" in data
        assert data["chapter"]["title"] == "TEST_Chapter_BugFix"
        assert data["chapter"]["book_id"] == book_id
        
        chapter_id = data["chapter"]["id"]
        print(f"Created chapter: {chapter_id} for book: {book_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/books/chapters/{chapter_id}", headers=auth_headers)
    
    def test_create_chapter_with_book_id_in_body(self, auth_headers):
        """Test that book_id in body is still accepted (backward compatibility)"""
        books_response = requests.get(f"{BASE_URL}/api/books/", headers=auth_headers)
        books = books_response.json().get("books", [])
        
        if not books:
            pytest.skip("No books available for testing")
        
        book_id = books[0]["id"]
        
        # Create chapter WITH book_id in body (should still work)
        chapter_data = {
            "book_id": book_id,  # Explicitly include book_id
            "title": "TEST_Chapter_WithBookId",
            "description": "Testing with book_id in body",
            "status": "draft"
        }
        response = requests.post(f"{BASE_URL}/api/books/{book_id}/chapters", headers=auth_headers, json=chapter_data)
        assert response.status_code == 200
        
        chapter_id = response.json()["chapter"]["id"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/books/chapters/{chapter_id}", headers=auth_headers)


class TestEventsEdit:
    """Test Events edit functionality - Bug fix: Events couldn't be edited (missing PUT endpoint)"""
    
    def test_list_events(self, auth_headers):
        """Test GET /api/events-v2/ endpoint"""
        response = requests.get(f"{BASE_URL}/api/events-v2/", headers=auth_headers)
        assert response.status_code == 200
        events = response.json()
        assert isinstance(events, list)
        print(f"Found {len(events)} events")
    
    def test_update_event_name(self, auth_headers):
        """Test PUT /api/events-v2/{id} - update event name"""
        # Get events
        events_response = requests.get(f"{BASE_URL}/api/events-v2/", headers=auth_headers)
        events = events_response.json()
        
        if not events:
            pytest.skip("No events available for testing")
        
        event_id = events[0]["id"]
        original_name = events[0]["name"]
        
        # Update event name
        update_data = {"name": f"{original_name} - TEST_UPDATED"}
        response = requests.put(f"{BASE_URL}/api/events-v2/{event_id}", headers=auth_headers, json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == f"{original_name} - TEST_UPDATED"
        
        # Restore original name
        requests.put(f"{BASE_URL}/api/events-v2/{event_id}", headers=auth_headers, json={"name": original_name})
    
    def test_update_event_linkedin_url(self, auth_headers):
        """Test PUT /api/events-v2/{id} - update linkedin_event_url field"""
        events_response = requests.get(f"{BASE_URL}/api/events-v2/", headers=auth_headers)
        events = events_response.json()
        
        if not events:
            pytest.skip("No events available for testing")
        
        event_id = events[0]["id"]
        original_url = events[0].get("linkedin_event_url")
        
        # Update LinkedIn URL
        test_url = "https://linkedin.com/events/test-event-12345"
        update_data = {"linkedin_event_url": test_url}
        response = requests.put(f"{BASE_URL}/api/events-v2/{event_id}", headers=auth_headers, json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data.get("linkedin_event_url") == test_url
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/events-v2/{event_id}", headers=auth_headers)
        assert get_response.json().get("linkedin_event_url") == test_url
        
        # Restore original
        requests.put(f"{BASE_URL}/api/events-v2/{event_id}", headers=auth_headers, json={"linkedin_event_url": original_url})
    
    def test_update_event_multiple_fields(self, auth_headers):
        """Test PUT /api/events-v2/{id} - update multiple fields at once"""
        events_response = requests.get(f"{BASE_URL}/api/events-v2/", headers=auth_headers)
        events = events_response.json()
        
        if not events:
            pytest.skip("No events available for testing")
        
        event_id = events[0]["id"]
        original_data = events[0]
        
        # Update multiple fields
        update_data = {
            "description": "TEST_Updated description",
            "webinar_time": "14:00",
            "buyer_personas": ["mateo", "ricardo"]
        }
        response = requests.put(f"{BASE_URL}/api/events-v2/{event_id}", headers=auth_headers, json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "TEST_Updated description"
        assert data["webinar_time"] == "14:00"
        assert "mateo" in data["buyer_personas"]
        
        # Restore original
        restore_data = {
            "description": original_data.get("description", ""),
            "webinar_time": original_data.get("webinar_time", "10:00"),
            "buyer_personas": original_data.get("buyer_personas", [])
        }
        requests.put(f"{BASE_URL}/api/events-v2/{event_id}", headers=auth_headers, json=restore_data)


class TestApifyAlerts:
    """Test Apify alert system - Bug fix: Alerts not triggering when credits exhausted"""
    
    def test_get_apify_status(self, auth_headers):
        """Test GET /api/scraping-automation/apify/status"""
        response = requests.get(f"{BASE_URL}/api/scraping-automation/apify/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data
        print(f"Apify connected: {data['connected']}")
        if data["connected"]:
            assert "plan" in data
            assert "alerts" in data
    
    def test_get_alerts(self, auth_headers):
        """Test GET /api/scraping-automation/alerts"""
        response = requests.get(f"{BASE_URL}/api/scraping-automation/alerts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "alerts" in data
        assert "unread_count" in data
        print(f"Found {len(data['alerts'])} alerts, {data['unread_count']} unread")
    
    def test_create_critical_alert(self, auth_headers):
        """Test POST /api/scraping-automation/alerts - create critical alert for exhausted credits"""
        alert_data = {
            "type": "critical",
            "category": "apify",
            "title": "⚠️ Créditos Apify Agotados",
            "message": "Los créditos de Apify se han agotado. El scraping de DMs y contactos se ha detenido."
        }
        response = requests.post(f"{BASE_URL}/api/scraping-automation/alerts", headers=auth_headers, json=alert_data)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "alert" in data
        assert data["alert"]["type"] == "critical"
        assert data["alert"]["category"] == "apify"
        assert "Agotados" in data["alert"]["title"]
        
        alert_id = data["alert"]["id"]
        print(f"Created critical alert: {alert_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/scraping-automation/alerts/{alert_id}", headers=auth_headers)
    
    def test_mark_alert_read(self, auth_headers):
        """Test PUT /api/scraping-automation/alerts/{id}/read"""
        # Create an alert first
        alert_data = {"type": "warning", "category": "apify", "title": "TEST_Alert", "message": "Test message"}
        create_response = requests.post(f"{BASE_URL}/api/scraping-automation/alerts", headers=auth_headers, json=alert_data)
        alert_id = create_response.json()["alert"]["id"]
        
        # Mark as read
        response = requests.put(f"{BASE_URL}/api/scraping-automation/alerts/{alert_id}/read", headers=auth_headers)
        assert response.status_code == 200
        assert response.json().get("success") == True
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/scraping-automation/alerts/{alert_id}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
