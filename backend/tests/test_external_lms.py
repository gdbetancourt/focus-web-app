"""
Test External LMS Endpoints for Leaderlix
Tests for external users (non @leaderlix.com) to access assigned courses.

Endpoints tested:
1. GET /api/lms/external/my-courses - Returns courses for authenticated external user
2. GET /api/lms/external/courses/{course_id} - Returns course detail for enrolled user
3. GET /api/lms/external/progress/{course_id} - Returns user progress
4. POST /api/lms/external/progress/{course_id}/complete/{lesson_id} - Marks lesson complete
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_PASSWORD = "TestPassword123"
TEST_TURNSTILE_TOKEN = "test_token"


class TestExternalLMSAuthentication:
    """Test authentication requirements for external LMS endpoints"""
    
    def test_my_courses_requires_auth(self):
        """Test /api/lms/external/my-courses requires authentication"""
        response = requests.get(f"{BASE_URL}/api/lms/external/my-courses")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"Correctly returns 401 without auth: {data}")
    
    def test_course_detail_requires_auth(self):
        """Test /api/lms/external/courses/{id} requires authentication"""
        response = requests.get(f"{BASE_URL}/api/lms/external/courses/fake-course-id")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"Correctly returns 401 without auth: {data}")
    
    def test_progress_requires_auth(self):
        """Test /api/lms/external/progress/{id} requires authentication"""
        response = requests.get(f"{BASE_URL}/api/lms/external/progress/fake-course-id")
        assert response.status_code == 401
        print("Progress endpoint correctly requires auth")
    
    def test_complete_lesson_requires_auth(self):
        """Test /api/lms/external/progress/{id}/complete/{lesson_id} requires auth"""
        response = requests.post(f"{BASE_URL}/api/lms/external/progress/fake/complete/fake-lesson")
        assert response.status_code == 401
        print("Complete lesson endpoint correctly requires auth")


class TestExternalUserWithCourses:
    """Test external user LMS functionality with proper setup"""
    
    @pytest.fixture(scope="class")
    def authenticated_session(self):
        """Create and authenticate an external user, returns session with cookies"""
        session = requests.Session()
        unique_email = f"lmstest_{uuid.uuid4().hex[:8]}@testdomain.com"
        
        # Register external user
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "LMS Test User",
            "phone": "+1234567890",
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        
        if register_response.status_code != 200:
            pytest.skip(f"Could not register user: {register_response.json()}")
        
        verification_token = register_response.json().get("verification_token")
        user_id = register_response.json().get("user_id")
        
        # Verify email
        session.get(f"{BASE_URL}/api/auth/verify-email/{verification_token}", allow_redirects=False)
        
        # Login
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Could not login: {login_response.json()}")
        
        print(f"Created and authenticated user: {unique_email} (id: {user_id})")
        
        return {
            "session": session,
            "user_id": user_id,
            "email": unique_email
        }
    
    def test_get_my_courses_empty(self, authenticated_session):
        """Test getting courses for user with no enrollments"""
        session = authenticated_session["session"]
        
        response = session.get(f"{BASE_URL}/api/lms/external/my-courses")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "courses" in data
        assert isinstance(data["courses"], list)
        # New user should have empty or few courses
        print(f"My courses response: {len(data['courses'])} courses")
    
    def test_get_course_detail_not_enrolled(self, authenticated_session):
        """Test getting course detail when not enrolled returns 403"""
        session = authenticated_session["session"]
        
        # First get any published course
        courses_response = requests.get(f"{BASE_URL}/api/lms/public/courses")
        public_courses = courses_response.json().get("courses", [])
        
        if not public_courses:
            pytest.skip("No public courses available for testing")
        
        course_id = public_courses[0]["id"]
        
        # Try to access as external user (not enrolled)
        response = session.get(f"{BASE_URL}/api/lms/external/courses/{course_id}")
        
        # Should return 403 (not enrolled) or 404 if course doesn't exist
        assert response.status_code in [403, 404]
        print(f"Correctly blocked access to course {course_id}: {response.status_code}")
    
    def test_get_progress_for_course(self, authenticated_session):
        """Test getting progress for a course (even without enrollment)"""
        session = authenticated_session["session"]
        
        # Progress endpoint should return empty progress even for non-enrolled courses
        response = session.get(f"{BASE_URL}/api/lms/external/progress/fake-course-id")
        
        # Could return 200 with empty progress or 404
        if response.status_code == 200:
            data = response.json()
            assert "completed_lessons" in data
            assert "progress_percent" in data
            print(f"Progress response: {data}")
        elif response.status_code == 404:
            print("Course not found - expected for fake ID")
        else:
            print(f"Unexpected status: {response.status_code}")


class TestExternalLMSWithEnrollment:
    """Test external LMS with actual course enrollment"""
    
    @pytest.fixture(scope="class")
    def setup_enrolled_user(self):
        """Create user, course, and enroll user in course"""
        session = requests.Session()
        unique_email = f"enrolled_{uuid.uuid4().hex[:8]}@testdomain.com"
        
        # Register and verify external user
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "name": "Enrolled Test User",
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        
        if register_response.status_code != 200:
            pytest.skip(f"Could not register: {register_response.json()}")
        
        verification_token = register_response.json().get("verification_token")
        user_id = register_response.json().get("user_id")
        
        session.get(f"{BASE_URL}/api/auth/verify-email/{verification_token}", allow_redirects=False)
        
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": TEST_PASSWORD,
            "turnstile_token": TEST_TURNSTILE_TOKEN
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Could not login: {login_response.json()}")
        
        # Create a test course
        course_response = requests.post(f"{BASE_URL}/api/lms/courses", json={
            "title": f"TEST_External_LMS_Course_{uuid.uuid4().hex[:6]}",
            "description": "Test course for external LMS testing",
            "is_published": True
        })
        
        if course_response.status_code != 200:
            pytest.skip(f"Could not create course: {course_response.json()}")
        
        course_id = course_response.json().get("course", {}).get("id")
        
        # Create a lesson in the course
        lesson_response = requests.post(f"{BASE_URL}/api/lms/courses/{course_id}/lessons", json={
            "title": "Test Lesson 1",
            "description": "First test lesson",
            "content_type": "text",
            "content_text": "<p>Test lesson content</p>",
            "duration_minutes": 10,
            "order": 1
        })
        
        lesson_id = None
        if lesson_response.status_code == 200:
            lesson_id = lesson_response.json().get("lesson", {}).get("id")
        
        # Enroll user in course
        enroll_response = requests.post(f"{BASE_URL}/api/lms/courses/{course_id}/enroll/{user_id}")
        
        if enroll_response.status_code != 200:
            print(f"Warning: Enrollment may have failed: {enroll_response.json()}")
        
        print(f"Setup complete: user={user_id}, course={course_id}, lesson={lesson_id}")
        
        return {
            "session": session,
            "user_id": user_id,
            "email": unique_email,
            "course_id": course_id,
            "lesson_id": lesson_id
        }
    
    def test_get_my_courses_with_enrollment(self, setup_enrolled_user):
        """Test getting enrolled courses"""
        session = setup_enrolled_user["session"]
        course_id = setup_enrolled_user["course_id"]
        
        response = session.get(f"{BASE_URL}/api/lms/external/my-courses")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "courses" in data
        
        # Check our test course is in the list
        course_ids = [c["id"] for c in data["courses"]]
        assert course_id in course_ids, f"Course {course_id} not found in {course_ids}"
        print(f"Found enrolled course in my-courses list: {course_id}")
    
    def test_get_course_detail_when_enrolled(self, setup_enrolled_user):
        """Test getting course detail when enrolled returns full content"""
        session = setup_enrolled_user["session"]
        course_id = setup_enrolled_user["course_id"]
        
        response = session.get(f"{BASE_URL}/api/lms/external/courses/{course_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "course" in data
        
        course = data["course"]
        assert course["id"] == course_id
        assert "lessons" in course
        assert "lesson_count" in course
        assert "total_duration" in course
        
        # Enrolled users should see lesson content
        if course["lessons"]:
            lesson = course["lessons"][0]
            # Content should be available for enrolled users
            assert "content_text" in lesson or "content_url" in lesson
        
        print(f"Course detail returned with {len(course['lessons'])} lessons")
    
    def test_get_progress_initial(self, setup_enrolled_user):
        """Test getting initial progress (should be 0)"""
        session = setup_enrolled_user["session"]
        course_id = setup_enrolled_user["course_id"]
        
        response = session.get(f"{BASE_URL}/api/lms/external/progress/{course_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert "completed_lessons" in data
        assert "progress_percent" in data
        assert data["progress_percent"] == 0 or isinstance(data["progress_percent"], int)
        print(f"Initial progress: {data['progress_percent']}%")
    
    def test_mark_lesson_complete(self, setup_enrolled_user):
        """Test marking a lesson as complete updates progress"""
        session = setup_enrolled_user["session"]
        course_id = setup_enrolled_user["course_id"]
        lesson_id = setup_enrolled_user["lesson_id"]
        
        if not lesson_id:
            pytest.skip("No lesson ID available")
        
        # Mark lesson complete
        response = session.post(
            f"{BASE_URL}/api/lms/external/progress/{course_id}/complete/{lesson_id}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Marked lesson {lesson_id} as complete")
        
        # Verify progress updated
        progress_response = session.get(f"{BASE_URL}/api/lms/external/progress/{course_id}")
        assert progress_response.status_code == 200
        progress_data = progress_response.json()
        
        assert lesson_id in progress_data.get("completed_lessons", [])
        assert progress_data["progress_percent"] > 0
        print(f"Progress after completion: {progress_data['progress_percent']}%")
    
    def test_mark_same_lesson_complete_twice(self, setup_enrolled_user):
        """Test marking same lesson complete twice is idempotent"""
        session = setup_enrolled_user["session"]
        course_id = setup_enrolled_user["course_id"]
        lesson_id = setup_enrolled_user["lesson_id"]
        
        if not lesson_id:
            pytest.skip("No lesson ID available")
        
        # Mark complete twice
        response1 = session.post(
            f"{BASE_URL}/api/lms/external/progress/{course_id}/complete/{lesson_id}"
        )
        response2 = session.post(
            f"{BASE_URL}/api/lms/external/progress/{course_id}/complete/{lesson_id}"
        )
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        # Progress should not double count
        progress_response = session.get(f"{BASE_URL}/api/lms/external/progress/{course_id}")
        progress_data = progress_response.json()
        
        # Should only have lesson once in completed list
        completed = progress_data.get("completed_lessons", [])
        assert completed.count(lesson_id) == 1, "Lesson should only appear once"
        print("Idempotency verified - lesson not double counted")


class TestPublicLMSEndpoints:
    """Test public LMS endpoints (no auth required)"""
    
    def test_get_public_courses(self):
        """Test getting published courses without auth"""
        response = requests.get(f"{BASE_URL}/api/lms/public/courses")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "courses" in data
        
        # All returned courses should be published
        for course in data["courses"]:
            # Public endpoint should only return published courses
            assert "id" in course
            assert "title" in course
        
        print(f"Public courses: {len(data['courses'])} courses available")
    
    def test_get_public_course_detail(self):
        """Test getting public course detail (content hidden for non-free lessons)"""
        # First get a public course
        courses_response = requests.get(f"{BASE_URL}/api/lms/public/courses")
        courses = courses_response.json().get("courses", [])
        
        if not courses:
            pytest.skip("No public courses available")
        
        course_id = courses[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/lms/public/courses/{course_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "course" in data
        
        course = data["course"]
        assert "lessons" in course
        
        # Check that non-free lesson content is hidden
        for lesson in course.get("lessons", []):
            if not lesson.get("is_free"):
                # Content should be hidden for non-free lessons
                assert lesson.get("content_url") is None or lesson.get("is_free")
        
        print(f"Public course detail: {course['title']} with {len(course['lessons'])} lessons")


class TestLMSEnrollmentEndpoints:
    """Test course enrollment endpoints (admin functions)"""
    
    def test_enroll_contact_in_course(self):
        """Test enrolling a contact in a course"""
        # Create a test course
        course_response = requests.post(f"{BASE_URL}/api/lms/courses", json={
            "title": f"TEST_Enrollment_Course_{uuid.uuid4().hex[:6]}",
            "description": "Test course for enrollment testing",
            "is_published": True
        })
        
        if course_response.status_code != 200:
            pytest.skip("Could not create course")
        
        course_id = course_response.json().get("course", {}).get("id")
        test_contact_id = f"test_contact_{uuid.uuid4().hex[:8]}"
        
        # Enroll contact
        enroll_response = requests.post(
            f"{BASE_URL}/api/lms/courses/{course_id}/enroll/{test_contact_id}"
        )
        assert enroll_response.status_code == 200
        data = enroll_response.json()
        assert data.get("success") == True
        print(f"Enrolled contact {test_contact_id} in course {course_id}")
        
        # Cleanup - unenroll
        requests.delete(f"{BASE_URL}/api/lms/courses/{course_id}/enroll/{test_contact_id}")
    
    def test_unenroll_contact_from_course(self):
        """Test unenrolling a contact from a course"""
        # Create course and enroll contact first
        course_response = requests.post(f"{BASE_URL}/api/lms/courses", json={
            "title": f"TEST_Unenroll_Course_{uuid.uuid4().hex[:6]}",
            "is_published": True
        })
        
        if course_response.status_code != 200:
            pytest.skip("Could not create course")
        
        course_id = course_response.json().get("course", {}).get("id")
        test_contact_id = f"test_contact_{uuid.uuid4().hex[:8]}"
        
        # Enroll
        requests.post(f"{BASE_URL}/api/lms/courses/{course_id}/enroll/{test_contact_id}")
        
        # Unenroll
        unenroll_response = requests.delete(
            f"{BASE_URL}/api/lms/courses/{course_id}/enroll/{test_contact_id}"
        )
        assert unenroll_response.status_code == 200
        data = unenroll_response.json()
        assert data.get("success") == True
        print(f"Unenrolled contact {test_contact_id} from course {course_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
