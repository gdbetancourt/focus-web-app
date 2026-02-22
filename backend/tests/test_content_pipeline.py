"""
Test Content Pipeline - Task 2.2.6.1 'Contenido: Proceso completo'
Tests for Ideas management, AI content tools, and Blog publishing
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "perla@leaderlix.com"
TEST_PASSWORD = "Leaderlix2025"


class TestAuth:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data, "No token in response"
        print(f"✓ Login successful")
        return data.get("access_token") or data.get("token")


class TestContentFlowIdeas:
    """Test Ideas/Content management endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token") or data.get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_list_contents(self):
        """Test GET /api/content-flow/contents - List all ideas"""
        response = requests.get(
            f"{BASE_URL}/api/content-flow/contents?limit=50",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "contents" in data, "Missing 'contents' key"
        assert isinstance(data["contents"], list), "Contents should be a list"
        print(f"✓ Listed {len(data['contents'])} content items")
    
    def test_create_idea(self):
        """Test POST /api/content-flow/contents - Create new idea"""
        payload = {
            "name": "TEST_Idea_Pipeline_Test",
            "description": "This is a test idea created by automated testing"
        }
        response = requests.post(
            f"{BASE_URL}/api/content-flow/contents",
            json=payload,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "id" in data, "Missing 'id' in response"
        assert data["name"] == payload["name"], "Name mismatch"
        assert data["status"] == "new", "Status should be 'new'"
        print(f"✓ Created idea with ID: {data['id']}")
        return data["id"]
    
    def test_create_and_get_idea(self):
        """Test Create → GET verification pattern"""
        # Create
        payload = {
            "name": "TEST_Verify_Persistence",
            "description": "Testing data persistence"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/content-flow/contents",
            json=payload,
            headers=self.headers
        )
        assert create_response.status_code == 200
        created = create_response.json()
        idea_id = created["id"]
        
        # GET to verify persistence
        get_response = requests.get(
            f"{BASE_URL}/api/content-flow/contents/{idea_id}",
            headers=self.headers
        )
        assert get_response.status_code == 200, f"GET failed: {get_response.text}"
        fetched = get_response.json()
        assert fetched["name"] == payload["name"], "Name not persisted"
        assert fetched["description"] == payload["description"], "Description not persisted"
        print(f"✓ Idea persisted and retrieved successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/content-flow/contents/{idea_id}", headers=self.headers)
    
    def test_delete_idea(self):
        """Test DELETE /api/content-flow/contents/{id}"""
        # First create an idea
        payload = {"name": "TEST_To_Delete", "description": "Will be deleted"}
        create_response = requests.post(
            f"{BASE_URL}/api/content-flow/contents",
            json=payload,
            headers=self.headers
        )
        idea_id = create_response.json()["id"]
        
        # Delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/content-flow/contents/{idea_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        # Verify it's gone
        get_response = requests.get(
            f"{BASE_URL}/api/content-flow/contents/{idea_id}",
            headers=self.headers
        )
        assert get_response.status_code == 404, "Idea should be deleted"
        print(f"✓ Idea deleted successfully")
    
    def test_move_idea_status(self):
        """Test PUT /api/content-flow/contents/{id}/move - Change status"""
        # Create idea
        payload = {"name": "TEST_Move_Status", "description": "Testing status change"}
        create_response = requests.post(
            f"{BASE_URL}/api/content-flow/contents",
            json=payload,
            headers=self.headers
        )
        idea_id = create_response.json()["id"]
        
        # Move to different status
        move_response = requests.put(
            f"{BASE_URL}/api/content-flow/contents/{idea_id}/move?new_status=website_published",
            headers=self.headers
        )
        assert move_response.status_code == 200, f"Move failed: {move_response.text}"
        
        # Verify status changed
        get_response = requests.get(
            f"{BASE_URL}/api/content-flow/contents/{idea_id}",
            headers=self.headers
        )
        assert get_response.json()["status"] == "website_published"
        print(f"✓ Idea status moved successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/content-flow/contents/{idea_id}", headers=self.headers)
    
    def test_get_stages(self):
        """Test GET /api/content-flow/stages"""
        response = requests.get(
            f"{BASE_URL}/api/content-flow/stages",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "stages" in data
        assert len(data["stages"]) > 0
        print(f"✓ Got {len(data['stages'])} workflow stages")


class TestAIContentTools:
    """Test AI content generation endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token") or data.get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_clean_dictation_spanish(self):
        """Test POST /api/content-flow/ai/clean-dictation - Spanish"""
        params = {
            "text": "Bueno entonces eh como les decía este tema es muy importante porque eh básicamente necesitamos mejorar nuestras presentaciones",
            "style": "professional",
            "language": "es"
        }
        response = requests.post(
            f"{BASE_URL}/api/content-flow/ai/clean-dictation",
            params=params,
            headers=self.headers,
            timeout=60
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "cleaned_text" in data, "Missing cleaned_text"
        assert data["success"] == True
        print(f"✓ Dictation cleaned (ES): {len(data['cleaned_text'])} chars")
    
    def test_clean_dictation_english(self):
        """Test POST /api/content-flow/ai/clean-dictation - English"""
        params = {
            "text": "So um basically like you know we need to improve our presentations because um they are not very good right now",
            "style": "professional",
            "language": "en"
        }
        response = requests.post(
            f"{BASE_URL}/api/content-flow/ai/clean-dictation",
            params=params,
            headers=self.headers,
            timeout=60
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "cleaned_text" in data
        print(f"✓ Dictation cleaned (EN): {len(data['cleaned_text'])} chars")
    
    def test_generate_slides(self):
        """Test POST /api/content-flow/ai/generate-slides"""
        params = {
            "content": "El liderazgo efectivo requiere comunicación clara, empatía y visión estratégica. Los líderes deben inspirar a sus equipos.",
            "num_slides": 3,
            "style": "executive",
            "include_speaker_notes": True,
            "language": "es"
        }
        response = requests.post(
            f"{BASE_URL}/api/content-flow/ai/generate-slides",
            params=params,
            headers=self.headers,
            timeout=60
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "slides" in data, "Missing slides"
        assert data["success"] == True
        assert len(data["slides"]) >= 1, "Should have at least 1 slide"
        print(f"✓ Generated {len(data['slides'])} slides")
    
    def test_generate_linkedin_post(self):
        """Test POST /api/content-flow/ai/generate-linkedin-post"""
        params = {
            "content": "Hoy aprendí que la comunicación efectiva es la base del liderazgo. Sin ella, los equipos no pueden funcionar.",
            "tone": "thought_leader",
            "include_hashtags": True,
            "language": "es"
        }
        response = requests.post(
            f"{BASE_URL}/api/content-flow/ai/generate-linkedin-post",
            params=params,
            headers=self.headers,
            timeout=60
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "post" in data, "Missing post"
        assert data["success"] == True
        assert len(data["post"]) > 0
        print(f"✓ Generated LinkedIn post: {data['character_count']} chars")
    
    def test_generate_blog_outline(self):
        """Test POST /api/content-flow/ai/generate-blog-outline"""
        params = {
            "topic": "Cómo mejorar tus habilidades de presentación",
            "target_audience": "professionals",
            "word_count_target": 1500,
            "language": "es"
        }
        response = requests.post(
            f"{BASE_URL}/api/content-flow/ai/generate-blog-outline",
            params=params,
            headers=self.headers,
            timeout=60
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "outline" in data, "Missing outline"
        assert data["success"] == True
        outline = data["outline"]
        assert "title" in outline, "Outline missing title"
        assert "sections" in outline, "Outline missing sections"
        print(f"✓ Generated blog outline: {outline['title']}")


class TestBlogPosts:
    """Test Blog posts endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token") or data.get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_list_posts(self):
        """Test GET /api/blog/posts"""
        response = requests.get(
            f"{BASE_URL}/api/blog/posts",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "posts" in data
        assert "stats" in data
        print(f"✓ Listed {len(data['posts'])} blog posts")
    
    def test_create_blog_post(self):
        """Test POST /api/blog/posts - Create new post"""
        payload = {
            "title": "TEST_Blog_Post_Pipeline",
            "content": "# Test Content\n\nThis is a test blog post created by automated testing.\n\n## Section 1\n\nSome content here.",
            "excerpt": "Test excerpt for the blog post",
            "is_published": False,
            "tags": ["test", "automation"]
        }
        response = requests.post(
            f"{BASE_URL}/api/blog/posts",
            json=payload,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "post" in data
        post = data["post"]
        assert post["title"] == payload["title"]
        assert post["is_published"] == False
        print(f"✓ Created blog post: {post['id']}")
        return post["id"]
    
    def test_create_and_get_post(self):
        """Test Create → GET verification for blog posts"""
        # Create
        payload = {
            "title": "TEST_Verify_Blog_Persistence",
            "content": "Test content for persistence verification",
            "is_published": False
        }
        create_response = requests.post(
            f"{BASE_URL}/api/blog/posts",
            json=payload,
            headers=self.headers
        )
        assert create_response.status_code == 200
        post_id = create_response.json()["post"]["id"]
        
        # GET to verify
        get_response = requests.get(
            f"{BASE_URL}/api/blog/posts/{post_id}",
            headers=self.headers
        )
        assert get_response.status_code == 200
        fetched = get_response.json()["post"]
        assert fetched["title"] == payload["title"]
        print(f"✓ Blog post persisted and retrieved")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/blog/posts/{post_id}", headers=self.headers)
    
    def test_delete_blog_post(self):
        """Test DELETE /api/blog/posts/{id}"""
        # Create
        payload = {"title": "TEST_To_Delete_Blog", "content": "Will be deleted"}
        create_response = requests.post(
            f"{BASE_URL}/api/blog/posts",
            json=payload,
            headers=self.headers
        )
        post_id = create_response.json()["post"]["id"]
        
        # Delete
        delete_response = requests.delete(
            f"{BASE_URL}/api/blog/posts/{post_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200
        
        # Verify deleted
        get_response = requests.get(
            f"{BASE_URL}/api/blog/posts/{post_id}",
            headers=self.headers
        )
        assert get_response.status_code == 404
        print(f"✓ Blog post deleted successfully")


class TestIOSShortcutEndpoints:
    """Test public iOS Shortcut endpoints"""
    
    def test_capture_from_shortcut(self):
        """Test POST /api/content-flow/shortcut/capture - Public endpoint"""
        payload = {
            "text": "TEST_iOS_Shortcut_Capture - This is a test capture from iOS Shortcut",
            "title": "Test Shortcut Capture",
            "source": "ios_shortcut",
            "type": "idea"
        }
        response = requests.post(
            f"{BASE_URL}/api/content-flow/shortcut/capture",
            json=payload
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "id" in data
        print(f"✓ iOS Shortcut capture successful: {data['id']}")
    
    def test_get_recent_captures(self):
        """Test GET /api/content-flow/shortcut/recent - Public endpoint"""
        response = requests.get(f"{BASE_URL}/api/content-flow/shortcut/recent")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "captures" in data
        print(f"✓ Got {len(data['captures'])} recent captures")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token") or data.get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_cleanup_test_ideas(self):
        """Clean up TEST_ prefixed ideas"""
        response = requests.get(
            f"{BASE_URL}/api/content-flow/contents?limit=100",
            headers=self.headers
        )
        if response.status_code == 200:
            contents = response.json().get("contents", [])
            deleted = 0
            for content in contents:
                if content.get("name", "").startswith("TEST_"):
                    requests.delete(
                        f"{BASE_URL}/api/content-flow/contents/{content['id']}",
                        headers=self.headers
                    )
                    deleted += 1
            print(f"✓ Cleaned up {deleted} test ideas")
    
    def test_cleanup_test_posts(self):
        """Clean up TEST_ prefixed blog posts"""
        response = requests.get(
            f"{BASE_URL}/api/blog/posts",
            headers=self.headers
        )
        if response.status_code == 200:
            posts = response.json().get("posts", [])
            deleted = 0
            for post in posts:
                if post.get("title", "").startswith("TEST_"):
                    requests.delete(
                        f"{BASE_URL}/api/blog/posts/{post['id']}",
                        headers=self.headers
                    )
                    deleted += 1
            print(f"✓ Cleaned up {deleted} test blog posts")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
