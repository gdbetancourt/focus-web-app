"""
Test suite for Long-form Videos (YouTube) and Attract (Video Ideas) APIs
Tests CRUD operations for video projects and video ideas Kanban boards
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "perla@leaderlix.com"
TEST_PASSWORD = "Leaderlix2025"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")  # API returns access_token, not token
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


# ============================================
# YouTube Videos API Tests (Long-form Videos)
# ============================================

class TestYouTubeVideosAPI:
    """Tests for /api/youtube/videos endpoints"""
    
    def test_get_youtube_videos(self, api_client):
        """GET /api/youtube/videos - should return videos list and counts"""
        response = api_client.get(f"{BASE_URL}/api/youtube/videos")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data
        assert data["success"] == True
        assert "videos" in data
        assert "counts" in data
        assert isinstance(data["videos"], list)
        assert isinstance(data["counts"], dict)
        print(f"✓ GET /api/youtube/videos - Found {len(data['videos'])} videos")
    
    def test_create_youtube_video(self, api_client):
        """POST /api/youtube/videos - should create a new video project"""
        test_video = {
            "title": f"TEST_Video_{uuid.uuid4().hex[:8]}",
            "description": "Test video description for automated testing",
            "status": "idea",
            "target_duration": "10-15 min",
            "tags": ["test", "automation"],
            "notes": "Created by automated test"
        }
        
        response = api_client.post(f"{BASE_URL}/api/youtube/videos", json=test_video)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "video" in data
        
        video = data["video"]
        assert video["title"] == test_video["title"]
        assert video["description"] == test_video["description"]
        assert video["status"] == "idea"
        assert "id" in video
        assert "created_at" in video
        
        print(f"✓ POST /api/youtube/videos - Created video: {video['id']}")
        return video["id"]
    
    def test_create_and_verify_video_persistence(self, api_client):
        """Create video and verify it appears in GET response"""
        # Create
        test_title = f"TEST_Persistence_{uuid.uuid4().hex[:8]}"
        create_response = api_client.post(f"{BASE_URL}/api/youtube/videos", json={
            "title": test_title,
            "status": "scripting",
            "target_duration": "15-20 min"
        })
        
        assert create_response.status_code == 200
        video_id = create_response.json()["video"]["id"]
        
        # Verify via GET
        get_response = api_client.get(f"{BASE_URL}/api/youtube/videos")
        assert get_response.status_code == 200
        
        videos = get_response.json()["videos"]
        found = any(v["id"] == video_id for v in videos)
        assert found, f"Created video {video_id} not found in GET response"
        
        print(f"✓ Video persistence verified: {video_id}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/youtube/videos/{video_id}")
    
    def test_update_youtube_video_status(self, api_client):
        """PUT /api/youtube/videos/{id} - should update video status"""
        # First create a video
        create_response = api_client.post(f"{BASE_URL}/api/youtube/videos", json={
            "title": f"TEST_Update_{uuid.uuid4().hex[:8]}",
            "status": "idea"
        })
        assert create_response.status_code == 200
        video_id = create_response.json()["video"]["id"]
        
        # Update status to scripting
        update_response = api_client.put(
            f"{BASE_URL}/api/youtube/videos/{video_id}",
            json={"status": "scripting", "script": "Test script content"}
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        data = update_response.json()
        assert data["success"] == True
        assert data["video"]["status"] == "scripting"
        assert data["video"]["script"] == "Test script content"
        
        print(f"✓ PUT /api/youtube/videos/{video_id} - Status updated to scripting")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/youtube/videos/{video_id}")
    
    def test_update_video_all_statuses(self, api_client):
        """Test updating video through all 6 statuses"""
        statuses = ["idea", "scripting", "filming", "editing", "review", "published"]
        
        # Create video
        create_response = api_client.post(f"{BASE_URL}/api/youtube/videos", json={
            "title": f"TEST_AllStatuses_{uuid.uuid4().hex[:8]}",
            "status": "idea"
        })
        assert create_response.status_code == 200
        video_id = create_response.json()["video"]["id"]
        
        # Update through all statuses
        for status in statuses[1:]:  # Skip 'idea' as it's already set
            update_response = api_client.put(
                f"{BASE_URL}/api/youtube/videos/{video_id}",
                json={"status": status}
            )
            assert update_response.status_code == 200
            assert update_response.json()["video"]["status"] == status
            print(f"  ✓ Status updated to: {status}")
        
        print(f"✓ Video progressed through all 6 statuses successfully")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/youtube/videos/{video_id}")
    
    def test_delete_youtube_video(self, api_client):
        """DELETE /api/youtube/videos/{id} - should delete video"""
        # Create a video to delete
        create_response = api_client.post(f"{BASE_URL}/api/youtube/videos", json={
            "title": f"TEST_Delete_{uuid.uuid4().hex[:8]}",
            "status": "idea"
        })
        assert create_response.status_code == 200
        video_id = create_response.json()["video"]["id"]
        
        # Delete
        delete_response = api_client.delete(f"{BASE_URL}/api/youtube/videos/{video_id}")
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        data = delete_response.json()
        assert data["success"] == True
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/youtube/videos")
        videos = get_response.json()["videos"]
        found = any(v["id"] == video_id for v in videos)
        assert not found, f"Deleted video {video_id} still found in GET response"
        
        print(f"✓ DELETE /api/youtube/videos/{video_id} - Video deleted and verified")
    
    def test_delete_nonexistent_video(self, api_client):
        """DELETE /api/youtube/videos/{id} - should return 404 for nonexistent video"""
        fake_id = str(uuid.uuid4())
        response = api_client.delete(f"{BASE_URL}/api/youtube/videos/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ DELETE nonexistent video returns 404 as expected")


# ============================================
# Attract Video Ideas API Tests
# ============================================

class TestAttractIdeasAPI:
    """Tests for /api/attract/ideas endpoints"""
    
    def test_get_video_ideas(self, api_client):
        """GET /api/attract/ideas - should return ideas list and counts"""
        response = api_client.get(f"{BASE_URL}/api/attract/ideas")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data
        assert data["success"] == True
        assert "ideas" in data
        assert "counts" in data
        assert isinstance(data["ideas"], list)
        assert isinstance(data["counts"], dict)
        print(f"✓ GET /api/attract/ideas - Found {len(data['ideas'])} ideas")
    
    def test_create_video_idea(self, api_client):
        """POST /api/attract/ideas - should create a new video idea"""
        test_idea = {
            "title": f"TEST_Idea_{uuid.uuid4().hex[:8]}",
            "description": "Test video idea for automated testing",
            "inspiration_url": "https://tiktok.com/test",
            "status": "idea",
            "tags": ["test", "viral"],
            "notes": "Created by automated test"
        }
        
        response = api_client.post(f"{BASE_URL}/api/attract/ideas", json=test_idea)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "idea" in data
        
        idea = data["idea"]
        assert idea["title"] == test_idea["title"]
        assert idea["description"] == test_idea["description"]
        assert idea["status"] == "idea"
        assert "id" in idea
        assert "created_at" in idea
        
        print(f"✓ POST /api/attract/ideas - Created idea: {idea['id']}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/attract/ideas/{idea['id']}")
    
    def test_create_and_verify_idea_persistence(self, api_client):
        """Create idea and verify it appears in GET response"""
        # Create
        test_title = f"TEST_IdeaPersistence_{uuid.uuid4().hex[:8]}"
        create_response = api_client.post(f"{BASE_URL}/api/attract/ideas", json={
            "title": test_title,
            "status": "scripting"
        })
        
        assert create_response.status_code == 200
        idea_id = create_response.json()["idea"]["id"]
        
        # Verify via GET
        get_response = api_client.get(f"{BASE_URL}/api/attract/ideas")
        assert get_response.status_code == 200
        
        ideas = get_response.json()["ideas"]
        found = any(i["id"] == idea_id for i in ideas)
        assert found, f"Created idea {idea_id} not found in GET response"
        
        print(f"✓ Idea persistence verified: {idea_id}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/attract/ideas/{idea_id}")
    
    def test_update_video_idea_status(self, api_client):
        """PUT /api/attract/ideas/{id} - should update idea status"""
        # First create an idea
        create_response = api_client.post(f"{BASE_URL}/api/attract/ideas", json={
            "title": f"TEST_UpdateIdea_{uuid.uuid4().hex[:8]}",
            "status": "idea"
        })
        assert create_response.status_code == 200
        idea_id = create_response.json()["idea"]["id"]
        
        # Update status to filming
        update_response = api_client.put(
            f"{BASE_URL}/api/attract/ideas/{idea_id}",
            json={"status": "filming", "notes": "Ready to film"}
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        data = update_response.json()
        assert data["success"] == True
        assert data["idea"]["status"] == "filming"
        assert data["idea"]["notes"] == "Ready to film"
        
        print(f"✓ PUT /api/attract/ideas/{idea_id} - Status updated to filming")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/attract/ideas/{idea_id}")
    
    def test_update_idea_all_statuses(self, api_client):
        """Test updating idea through all 5 statuses"""
        statuses = ["idea", "scripting", "filming", "editing", "published"]
        
        # Create idea
        create_response = api_client.post(f"{BASE_URL}/api/attract/ideas", json={
            "title": f"TEST_IdeaAllStatuses_{uuid.uuid4().hex[:8]}",
            "status": "idea"
        })
        assert create_response.status_code == 200
        idea_id = create_response.json()["idea"]["id"]
        
        # Update through all statuses
        for status in statuses[1:]:  # Skip 'idea' as it's already set
            update_response = api_client.put(
                f"{BASE_URL}/api/attract/ideas/{idea_id}",
                json={"status": status}
            )
            assert update_response.status_code == 200
            assert update_response.json()["idea"]["status"] == status
            print(f"  ✓ Idea status updated to: {status}")
        
        print(f"✓ Idea progressed through all 5 statuses successfully")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/attract/ideas/{idea_id}")
    
    def test_delete_video_idea(self, api_client):
        """DELETE /api/attract/ideas/{id} - should delete idea"""
        # Create an idea to delete
        create_response = api_client.post(f"{BASE_URL}/api/attract/ideas", json={
            "title": f"TEST_DeleteIdea_{uuid.uuid4().hex[:8]}",
            "status": "idea"
        })
        assert create_response.status_code == 200
        idea_id = create_response.json()["idea"]["id"]
        
        # Delete
        delete_response = api_client.delete(f"{BASE_URL}/api/attract/ideas/{idea_id}")
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        data = delete_response.json()
        assert data["success"] == True
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/attract/ideas")
        ideas = get_response.json()["ideas"]
        found = any(i["id"] == idea_id for i in ideas)
        assert not found, f"Deleted idea {idea_id} still found in GET response"
        
        print(f"✓ DELETE /api/attract/ideas/{idea_id} - Idea deleted and verified")
    
    def test_delete_nonexistent_idea(self, api_client):
        """DELETE /api/attract/ideas/{id} - should return 404 for nonexistent idea"""
        fake_id = str(uuid.uuid4())
        response = api_client.delete(f"{BASE_URL}/api/attract/ideas/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ DELETE nonexistent idea returns 404 as expected")


# ============================================
# Attract Trending API Tests (MOCKED)
# ============================================

class TestAttractTrendingAPI:
    """Tests for /api/attract/trending endpoint (MOCKED - requires Apify subscription)"""
    
    def test_get_trending_videos(self, api_client):
        """GET /api/attract/trending - should return trending videos (mock or real)"""
        response = api_client.get(f"{BASE_URL}/api/attract/trending")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data
        assert data["success"] == True
        assert "videos" in data
        assert isinstance(data["videos"], list)
        
        # Check if mock data is being used
        if data.get("mock"):
            print(f"✓ GET /api/attract/trending - Returns MOCK data (Apify subscription required)")
            print(f"  Note: TikTok trends integration requires paid Apify actor subscription")
        else:
            print(f"✓ GET /api/attract/trending - Returns {len(data['videos'])} trending videos")
        
        # Verify video structure if videos exist
        if data["videos"]:
            video = data["videos"][0]
            assert "id" in video
            assert "title" in video
            print(f"  Sample video: {video.get('title', 'N/A')[:50]}...")


# ============================================
# Cleanup Test Data
# ============================================

class TestCleanup:
    """Cleanup any remaining test data"""
    
    def test_cleanup_test_videos(self, api_client):
        """Remove any TEST_ prefixed videos"""
        response = api_client.get(f"{BASE_URL}/api/youtube/videos")
        if response.status_code == 200:
            videos = response.json().get("videos", [])
            deleted = 0
            for video in videos:
                if video.get("title", "").startswith("TEST_"):
                    api_client.delete(f"{BASE_URL}/api/youtube/videos/{video['id']}")
                    deleted += 1
            print(f"✓ Cleanup: Deleted {deleted} test videos")
    
    def test_cleanup_test_ideas(self, api_client):
        """Remove any TEST_ prefixed ideas"""
        response = api_client.get(f"{BASE_URL}/api/attract/ideas")
        if response.status_code == 200:
            ideas = response.json().get("ideas", [])
            deleted = 0
            for idea in ideas:
                if idea.get("title", "").startswith("TEST_"):
                    api_client.delete(f"{BASE_URL}/api/attract/ideas/{idea['id']}")
                    deleted += 1
            print(f"✓ Cleanup: Deleted {deleted} test ideas")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
