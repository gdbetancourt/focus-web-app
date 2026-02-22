"""
Test P1 Features: Analytics Dashboard + Contact LMS Courses
Tests:
1. /api/contacts/stats - Contact statistics endpoint
2. /api/newsletters/analytics/summary - Email analytics summary
3. /api/content-flow/stats - Content stats (blogs, testimonials, events)
4. /api/lms/contact/{contact_id}/courses - Get contact enrolled courses
5. /api/lms/courses/{course_id}/enroll/{contact_id} - Enroll/unenroll contact
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "perla@leaderlix.com",
            "password": "Leaderlix2025"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestContactStats(TestAuth):
    """Test /api/contacts/stats endpoint for Analytics Dashboard"""
    
    def test_contacts_stats_returns_total(self, auth_headers):
        """Test that contacts stats returns total count"""
        response = requests.get(f"{BASE_URL}/api/contacts/stats", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify required fields
        assert "total" in data, "Missing 'total' field"
        assert isinstance(data["total"], int), "total should be integer"
        print(f"✓ Total contacts: {data['total']}")
    
    def test_contacts_stats_returns_new_this_month(self, auth_headers):
        """Test that contacts stats returns new_this_month"""
        response = requests.get(f"{BASE_URL}/api/contacts/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "new_this_month" in data, "Missing 'new_this_month' field"
        assert isinstance(data["new_this_month"], int), "new_this_month should be integer"
        print(f"✓ New this month: {data['new_this_month']}")
    
    def test_contacts_stats_returns_by_stage(self, auth_headers):
        """Test that contacts stats returns by_stage breakdown"""
        response = requests.get(f"{BASE_URL}/api/contacts/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "by_stage" in data, "Missing 'by_stage' field"
        assert isinstance(data["by_stage"], dict), "by_stage should be dict"
        
        # Should have stages 1-5
        by_stage = data["by_stage"]
        print(f"✓ By stage breakdown: {by_stage}")


class TestNewsletterAnalytics(TestAuth):
    """Test /api/newsletters/analytics/summary endpoint"""
    
    def test_analytics_summary_returns_sent(self, auth_headers):
        """Test that analytics summary returns total_sent"""
        response = requests.get(f"{BASE_URL}/api/newsletters/analytics/summary", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "total_sent" in data, "Missing 'total_sent' field"
        assert isinstance(data["total_sent"], int), "total_sent should be integer"
        print(f"✓ Total sent: {data['total_sent']}")
    
    def test_analytics_summary_returns_opened(self, auth_headers):
        """Test that analytics summary returns total_opened"""
        response = requests.get(f"{BASE_URL}/api/newsletters/analytics/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_opened" in data, "Missing 'total_opened' field"
        assert isinstance(data["total_opened"], int), "total_opened should be integer"
        print(f"✓ Total opened: {data['total_opened']}")
    
    def test_analytics_summary_returns_clicked(self, auth_headers):
        """Test that analytics summary returns total_clicked"""
        response = requests.get(f"{BASE_URL}/api/newsletters/analytics/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_clicked" in data, "Missing 'total_clicked' field"
        assert isinstance(data["total_clicked"], int), "total_clicked should be integer"
        print(f"✓ Total clicked: {data['total_clicked']}")
    
    def test_analytics_summary_returns_rates(self, auth_headers):
        """Test that analytics summary returns open_rate and click_rate"""
        response = requests.get(f"{BASE_URL}/api/newsletters/analytics/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "open_rate" in data, "Missing 'open_rate' field"
        assert "click_rate" in data, "Missing 'click_rate' field"
        print(f"✓ Open rate: {data['open_rate']}%, Click rate: {data['click_rate']}%")


class TestContentFlowStats(TestAuth):
    """Test /api/content-flow/stats endpoint"""
    
    def test_content_stats_returns_blogs(self, auth_headers):
        """Test that content stats returns total_blogs"""
        response = requests.get(f"{BASE_URL}/api/content-flow/stats", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "total_blogs" in data, "Missing 'total_blogs' field"
        assert isinstance(data["total_blogs"], int), "total_blogs should be integer"
        print(f"✓ Total blogs: {data['total_blogs']}")
    
    def test_content_stats_returns_testimonials(self, auth_headers):
        """Test that content stats returns total_testimonials"""
        response = requests.get(f"{BASE_URL}/api/content-flow/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_testimonials" in data, "Missing 'total_testimonials' field"
        assert isinstance(data["total_testimonials"], int), "total_testimonials should be integer"
        print(f"✓ Total testimonials: {data['total_testimonials']}")
    
    def test_content_stats_returns_events(self, auth_headers):
        """Test that content stats returns total_events"""
        response = requests.get(f"{BASE_URL}/api/content-flow/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_events" in data, "Missing 'total_events' field"
        assert isinstance(data["total_events"], int), "total_events should be integer"
        print(f"✓ Total events: {data['total_events']}")


class TestLMSContactCourses(TestAuth):
    """Test LMS contact enrollment endpoints"""
    
    def test_get_contact_courses_empty(self, auth_headers):
        """Test getting courses for a contact (may be empty)"""
        # First get a contact ID
        contacts_response = requests.get(f"{BASE_URL}/api/contacts?limit=1", headers=auth_headers)
        assert contacts_response.status_code == 200
        contacts_data = contacts_response.json()
        
        if contacts_data.get("contacts") and len(contacts_data["contacts"]) > 0:
            contact_id = contacts_data["contacts"][0]["id"]
            
            # Get courses for this contact
            response = requests.get(f"{BASE_URL}/api/lms/contact/{contact_id}/courses", headers=auth_headers)
            assert response.status_code == 200, f"Failed: {response.text}"
            data = response.json()
            
            assert "success" in data, "Missing 'success' field"
            assert data["success"] == True, "success should be True"
            assert "courses" in data, "Missing 'courses' field"
            assert isinstance(data["courses"], list), "courses should be list"
            assert "total" in data, "Missing 'total' field"
            print(f"✓ Contact {contact_id} has {data['total']} enrolled courses")
        else:
            pytest.skip("No contacts available for testing")
    
    def test_enroll_and_unenroll_contact(self, auth_headers):
        """Test enrolling and unenrolling a contact from a course"""
        # Get a contact
        contacts_response = requests.get(f"{BASE_URL}/api/contacts?limit=1", headers=auth_headers)
        assert contacts_response.status_code == 200
        contacts_data = contacts_response.json()
        
        # Get a course
        courses_response = requests.get(f"{BASE_URL}/api/lms/courses", headers=auth_headers)
        assert courses_response.status_code == 200
        courses_data = courses_response.json()
        
        if (contacts_data.get("contacts") and len(contacts_data["contacts"]) > 0 and
            courses_data.get("courses") and len(courses_data["courses"]) > 0):
            
            contact_id = contacts_data["contacts"][0]["id"]
            course_id = courses_data["courses"][0]["id"]
            
            # Enroll contact
            enroll_response = requests.post(
                f"{BASE_URL}/api/lms/courses/{course_id}/enroll/{contact_id}",
                headers=auth_headers
            )
            assert enroll_response.status_code == 200, f"Enroll failed: {enroll_response.text}"
            enroll_data = enroll_response.json()
            assert enroll_data.get("success") == True, "Enroll should succeed"
            print(f"✓ Enrolled contact {contact_id} in course {course_id}")
            
            # Verify enrollment
            verify_response = requests.get(
                f"{BASE_URL}/api/lms/contact/{contact_id}/courses",
                headers=auth_headers
            )
            assert verify_response.status_code == 200
            verify_data = verify_response.json()
            enrolled_ids = [c["id"] for c in verify_data.get("courses", [])]
            assert course_id in enrolled_ids, "Contact should be enrolled in course"
            print(f"✓ Verified contact is enrolled")
            
            # Unenroll contact
            unenroll_response = requests.delete(
                f"{BASE_URL}/api/lms/courses/{course_id}/enroll/{contact_id}",
                headers=auth_headers
            )
            assert unenroll_response.status_code == 200, f"Unenroll failed: {unenroll_response.text}"
            unenroll_data = unenroll_response.json()
            assert unenroll_data.get("success") == True, "Unenroll should succeed"
            print(f"✓ Unenrolled contact from course")
            
            # Verify unenrollment
            verify2_response = requests.get(
                f"{BASE_URL}/api/lms/contact/{contact_id}/courses",
                headers=auth_headers
            )
            assert verify2_response.status_code == 200
            verify2_data = verify2_response.json()
            enrolled_ids2 = [c["id"] for c in verify2_data.get("courses", [])]
            assert course_id not in enrolled_ids2, "Contact should not be enrolled after unenroll"
            print(f"✓ Verified contact is unenrolled")
        else:
            pytest.skip("No contacts or courses available for testing")


class TestLMSCoursesEndpoint(TestAuth):
    """Test LMS courses list endpoint"""
    
    def test_get_courses_list(self, auth_headers):
        """Test getting list of courses"""
        response = requests.get(f"{BASE_URL}/api/lms/courses", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "success" in data, "Missing 'success' field"
        assert "courses" in data, "Missing 'courses' field"
        assert isinstance(data["courses"], list), "courses should be list"
        print(f"✓ Found {len(data['courses'])} courses")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
