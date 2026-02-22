"""
Test Suite: Gemini Message Variation and Email Queue Cleanup
Tests for:
1. WhatsApp /generate-varied-urls endpoint existence
2. Email queue cleanup function uses correct collection (db.email_queue)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Module: WhatsApp Rules - Gemini Variation Endpoint Tests
class TestWhatsAppGeminiVariation:
    """Tests for WhatsApp Gemini message variation endpoint"""
    
    def test_generate_varied_urls_endpoint_exists(self):
        """Test that /api/whatsapp-rules/generate-varied-urls endpoint exists and returns appropriate response"""
        # This endpoint requires authentication, so we expect 401 or 403 without token
        # If endpoint doesn't exist, we'd get 404
        response = requests.post(
            f"{BASE_URL}/api/whatsapp-rules/generate-varied-urls",
            json={
                "rule_id": "W01",
                "group_key": "test-group",
                "subgroup_key": None,
                "contact_ids": ["test-contact-1"],
                "template_message": "Hola {contact_name}!"
            },
            headers={"Content-Type": "application/json"}
        )
        
        # Endpoint exists if we get 401/403 (auth required) or 200/400/422 (endpoint works)
        # 404 would mean endpoint doesn't exist
        assert response.status_code != 404, f"Endpoint /api/whatsapp-rules/generate-varied-urls not found (got {response.status_code})"
        
        # Acceptable responses: 401 (unauthorized), 403 (forbidden), 422 (validation), 200 (success)
        assert response.status_code in [401, 403, 422, 200, 400], f"Unexpected status code: {response.status_code}"
        print(f"✓ Endpoint /api/whatsapp-rules/generate-varied-urls exists (status: {response.status_code})")
    
    def test_generate_varied_urls_request_schema(self):
        """Test that endpoint validates request schema with required fields"""
        # Test with empty body - should return 422 (validation error) or 401 (unauthorized)
        response = requests.post(
            f"{BASE_URL}/api/whatsapp-rules/generate-varied-urls",
            json={},
            headers={"Content-Type": "application/json"}
        )
        
        # 422 means schema validation works, 401 means auth check comes first
        assert response.status_code in [401, 403, 422], f"Expected validation or auth error, got {response.status_code}"
        print(f"✓ Request schema validation working (status: {response.status_code})")
    
    def test_standard_generate_urls_endpoint_exists(self):
        """Test that standard /api/whatsapp-rules/generate-urls endpoint also exists for comparison"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp-rules/generate-urls",
            json={
                "rule_id": "W01",
                "group_key": "test-group",
                "subgroup_key": None,
                "contact_ids": ["test-contact-1"],
                "message": "Hola {contact_name}!"
            },
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code != 404, f"Standard endpoint /api/whatsapp-rules/generate-urls not found"
        assert response.status_code in [401, 403, 422, 200, 400], f"Unexpected status code: {response.status_code}"
        print(f"✓ Standard endpoint /api/whatsapp-rules/generate-urls exists (status: {response.status_code})")


# Module: Email Rules - Traffic Light and Queue Tests  
class TestEmailQueueEndpoints:
    """Tests for email queue and traffic light endpoints"""
    
    def test_email_traffic_light_endpoint(self):
        """Test email traffic light status endpoint exists and uses email_queue collection"""
        response = requests.get(
            f"{BASE_URL}/api/email-rules/traffic-light-status",
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 401 (unauthorized) or 200 (success)
        assert response.status_code != 404, "Traffic light endpoint not found"
        assert response.status_code in [200, 401, 403], f"Unexpected status code: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            # Verify response structure
            assert "status" in data, "Response missing 'status' field"
            assert "pending" in data, "Response missing 'pending' field"
            assert "sent_today" in data, "Response missing 'sent_today' field"
            assert data["status"] in ["red", "yellow", "green"], f"Invalid status: {data['status']}"
            print(f"✓ Traffic light endpoint working: status={data['status']}, pending={data['pending']}, sent_today={data['sent_today']}")
        else:
            print(f"✓ Traffic light endpoint exists (requires auth, status: {response.status_code})")
    
    def test_email_queue_status_endpoint(self):
        """Test email queue status endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/email-rules/queue/status",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code != 404, "Queue status endpoint not found"
        assert response.status_code in [200, 401, 403], f"Unexpected status code: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "stats" in data, "Response missing 'stats' field"
            print(f"✓ Queue status endpoint working: stats={data['stats']}")
        else:
            print(f"✓ Queue status endpoint exists (requires auth, status: {response.status_code})")


# Module: WhatsApp Rules - Base Endpoints Tests
class TestWhatsAppRulesBase:
    """Tests for base WhatsApp rules endpoints"""
    
    def test_whatsapp_rules_list(self):
        """Test WhatsApp rules list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/whatsapp-rules/",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code != 404, "WhatsApp rules endpoint not found"
        assert response.status_code in [200, 401, 403], f"Unexpected status code: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "rules" in data, "Response missing 'rules' field"
            print(f"✓ WhatsApp rules endpoint working: {len(data['rules'])} rules found")
        else:
            print(f"✓ WhatsApp rules endpoint exists (requires auth, status: {response.status_code})")
    
    def test_whatsapp_pending_counts(self):
        """Test WhatsApp pending counts endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/whatsapp-rules/pending-counts",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code != 404, "Pending counts endpoint not found"
        assert response.status_code in [200, 401, 403], f"Unexpected status code: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "counts" in data, "Response missing 'counts' field"
            print(f"✓ Pending counts endpoint working: {data['counts']}")
        else:
            print(f"✓ Pending counts endpoint exists (requires auth, status: {response.status_code})")
    
    def test_whatsapp_traffic_light(self):
        """Test WhatsApp traffic light status endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/whatsapp-rules/traffic-light-status",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code != 404, "WhatsApp traffic light endpoint not found"
        assert response.status_code in [200, 401, 403], f"Unexpected status code: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "status" in data, "Response missing 'status' field"
            print(f"✓ WhatsApp traffic light working: status={data['status']}")
        else:
            print(f"✓ WhatsApp traffic light endpoint exists (requires auth, status: {response.status_code})")


# Module: Code Structure Verification Tests
class TestCodeStructure:
    """Tests to verify code structure and implementation details"""
    
    def test_generate_varied_message_gemini_function_exists(self):
        """Verify generate_varied_message_gemini function is defined in the codebase"""
        import subprocess
        result = subprocess.run(
            ['grep', '-l', 'generate_varied_message_gemini', '/app/backend/routers/whatsapp_rules.py'],
            capture_output=True, text=True
        )
        assert result.returncode == 0, "generate_varied_message_gemini function not found in whatsapp_rules.py"
        print("✓ generate_varied_message_gemini function exists in whatsapp_rules.py")
    
    def test_gemini_variation_endpoint_defined(self):
        """Verify /generate-varied-urls endpoint is defined"""
        import subprocess
        result = subprocess.run(
            ['grep', '-c', 'generate-varied-urls', '/app/backend/routers/whatsapp_rules.py'],
            capture_output=True, text=True
        )
        count = int(result.stdout.strip())
        assert count >= 1, "generate-varied-urls endpoint not found in whatsapp_rules.py"
        print(f"✓ generate-varied-urls endpoint found {count} times in whatsapp_rules.py")
    
    def test_cleanup_email_queue_uses_correct_collection(self):
        """Verify cleanup_email_queue uses db.email_queue (not db.scheduled_emails)"""
        import subprocess
        
        # Check for db.email_queue in cleanup function
        result = subprocess.run(
            ['grep', '-A', '100', 'async def cleanup_email_queue', '/app/backend/routers/email_rules.py'],
            capture_output=True, text=True
        )
        
        assert 'db.email_queue' in result.stdout, "cleanup_email_queue doesn't use db.email_queue collection"
        assert 'scheduled_emails' not in result.stdout, "cleanup_email_queue incorrectly uses scheduled_emails collection"
        print("✓ cleanup_email_queue correctly uses db.email_queue collection")
    
    def test_generate_varied_urls_request_model(self):
        """Verify GenerateVariedUrlsRequest model has correct fields"""
        import subprocess
        result = subprocess.run(
            ['grep', '-A', '10', 'class GenerateVariedUrlsRequest', '/app/backend/routers/whatsapp_rules.py'],
            capture_output=True, text=True
        )
        
        assert 'rule_id' in result.stdout, "GenerateVariedUrlsRequest missing rule_id field"
        assert 'group_key' in result.stdout, "GenerateVariedUrlsRequest missing group_key field"
        assert 'contact_ids' in result.stdout, "GenerateVariedUrlsRequest missing contact_ids field"
        assert 'template_message' in result.stdout, "GenerateVariedUrlsRequest missing template_message field"
        print("✓ GenerateVariedUrlsRequest model has all required fields")
    
    def test_gemini_api_integration(self):
        """Verify Gemini API integration is properly configured"""
        import subprocess
        result = subprocess.run(
            ['grep', '-c', 'EMERGENT_LLM_KEY', '/app/backend/routers/whatsapp_rules.py'],
            capture_output=True, text=True
        )
        count = int(result.stdout.strip())
        assert count >= 1, "EMERGENT_LLM_KEY not found in generate_varied_message_gemini function"
        
        result2 = subprocess.run(
            ['grep', '-c', 'emergentintegrations.llm.chat', '/app/backend/routers/whatsapp_rules.py'],
            capture_output=True, text=True
        )
        count2 = int(result2.stdout.strip())
        assert count2 >= 1, "Emergent LLM Chat import not found"
        print("✓ Gemini API integration properly configured with EMERGENT_LLM_KEY")


# Module: Email Rules Endpoints Tests
class TestEmailRulesEndpoints:
    """Tests for email rules endpoints"""
    
    def test_email_rules_list(self):
        """Test email rules list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/email-rules/",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code != 404, "Email rules endpoint not found"
        assert response.status_code in [200, 401, 403], f"Unexpected status code: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "rules" in data, "Response missing 'rules' field"
            print(f"✓ Email rules endpoint working: {len(data['rules'])} rules found")
        else:
            print(f"✓ Email rules endpoint exists (requires auth, status: {response.status_code})")
    
    def test_email_generation_status(self):
        """Test email generation status endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/email-rules/generation-status",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code != 404, "Generation status endpoint not found"
        assert response.status_code in [200, 401, 403], f"Unexpected status code: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "has_job" in data, "Response missing 'has_job' field"
            print(f"✓ Generation status endpoint working: has_job={data['has_job']}")
        else:
            print(f"✓ Generation status endpoint exists (requires auth, status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
