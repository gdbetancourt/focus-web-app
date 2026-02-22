#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class LeaderlixAPITester:
    def __init__(self, base_url="https://persona-assets.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.user_id = None
        
        # Test credentials - using provided admin user
        self.test_user = {
            "email": "admin@leaderlix.com",
            "password": "admin123",
            "name": "Admin User"
        }

    def log_result(self, test_name, success, details="", endpoint=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            
        result = {
            "test_name": test_name,
            "success": success,
            "endpoint": endpoint,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    Details: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json()
                    self.log_result(name, True, f"Status: {response.status_code}", endpoint)
                    return True, response_data
                except:
                    self.log_result(name, True, f"Status: {response.status_code} (no JSON)", endpoint)
                    return True, {}
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json().get('detail', '')
                    if error_detail:
                        error_msg += f" - {error_detail}"
                except:
                    pass
                self.log_result(name, False, error_msg, endpoint)
                return False, {}

        except Exception as e:
            self.log_result(name, False, f"Request error: {str(e)}", endpoint)
            return False, {}

    def test_user_registration(self):
        """Test user registration"""
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=self.test_user
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response.get('user', {}).get('id')
            return True
        return False

    def test_user_login(self):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": self.test_user["email"], "password": self.test_user["password"]}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response.get('user', {}).get('id')
            return True
        return False

    def test_protected_route(self):
        """Test protected route access"""
        success, response = self.run_test(
            "Protected Route - Get User Profile",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_events_sync(self):
        """Test HubSpot Events sync from Cohortes pipeline"""
        # Get events
        success1, _ = self.run_test(
            "Get Events",
            "GET",
            "events/",
            200
        )
        
        # Sync events from HubSpot Cohortes pipeline
        success2, sync_response = self.run_test(
            "Sync Events from HubSpot Cohortes",
            "POST",
            "events/sync",
            200
        )
        
        if success2:
            # Check if sync response has expected structure
            if 'message' in sync_response and 'events' in sync_response:
                self.log_result("Events Sync Response Structure", True, f"Synced events: {len(sync_response.get('events', []))}")
            else:
                self.log_result("Events Sync Response Structure", False, "Missing expected fields in sync response")
        
        return success1 and success2

    def test_hubspot_contacts(self):
        """Test HubSpot contacts endpoints"""
        # Get contacts
        success1, contacts_response = self.run_test(
            "Get HubSpot Contacts",
            "GET",
            "hubspot/contacts",
            200
        )
        
        # Sync contacts
        success2, _ = self.run_test(
            "Sync HubSpot Contacts",
            "POST",
            "hubspot/sync",
            200
        )
        
        return success1 and success2

    def test_templates_crud(self):
        """Test Templates CRUD operations"""
        # Get templates
        success1, _ = self.run_test(
            "Get Templates",
            "GET",
            "templates/",
            200
        )
        
        # Create template
        template_data = {
            "name": "Test Template",
            "subject": "Test Subject - {{evento_titulo}}",
            "body_html": "<p>Hello {{nombre}}, join our event {{evento_titulo}}!</p>",
            "variables": ["nombre", "evento_titulo"]
        }
        
        success2, create_response = self.run_test(
            "Create Template",
            "POST",
            "templates/",
            200,
            data=template_data
        )
        
        template_id = None
        if success2 and 'id' in create_response:
            template_id = create_response['id']
            
            # Get specific template
            success3, _ = self.run_test(
                "Get Specific Template",
                "GET",
                f"templates/{template_id}",
                200
            )
            
            # Update template
            updated_data = {**template_data, "name": "Updated Test Template"}
            success4, _ = self.run_test(
                "Update Template",
                "PUT",
                f"templates/{template_id}",
                200,
                data=updated_data
            )
            
            # Delete template
            success5, _ = self.run_test(
                "Delete Template",
                "DELETE",
                f"templates/{template_id}",
                200
            )
            
            return success1 and success2 and success3 and success4 and success5
        
        return success1 and success2

    def test_campaigns_crud(self):
        """Test Campaigns CRUD operations"""
        # First create a template for the campaign
        template_data = {
            "name": "Campaign Test Template",
            "subject": "Campaign Test",
            "body_html": "<p>Test campaign email</p>",
            "variables": []
        }
        
        template_success, template_response = self.run_test(
            "Create Template for Campaign",
            "POST",
            "templates/",
            200,
            data=template_data
        )
        
        if not template_success or 'id' not in template_response:
            return False
            
        template_id = template_response['id']
        
        # Get campaigns
        success1, _ = self.run_test(
            "Get Campaigns",
            "GET",
            "campaigns/",
            200
        )
        
        # Create campaign
        campaign_data = {
            "name": "Test Campaign",
            "template_id": template_id,
            "event_ids": [],
            "contact_ids": [],
            "use_ai_generation": False
        }
        
        success2, create_response = self.run_test(
            "Create Campaign",
            "POST",
            "campaigns/",
            200,
            data=campaign_data
        )
        
        campaign_id = None
        if success2 and 'id' in create_response:
            campaign_id = create_response['id']
            
            # Get specific campaign
            success3, _ = self.run_test(
                "Get Specific Campaign",
                "GET",
                f"campaigns/{campaign_id}",
                200
            )
            
            # Delete campaign
            success4, _ = self.run_test(
                "Delete Campaign",
                "DELETE",
                f"campaigns/{campaign_id}",
                200
            )
            
            # Clean up template
            self.run_test(
                "Cleanup Template",
                "DELETE",
                f"templates/{template_id}",
                200
            )
            
            return success1 and success2 and success3 and success4
        
        return success1 and success2

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        if success:
            # Check if response has expected fields
            expected_fields = ['total_contacts', 'total_events', 'total_campaigns', 'total_templates']
            has_fields = all(field in response for field in expected_fields)
            if not has_fields:
                self.log_result("Dashboard Stats Fields", False, "Missing expected fields in response")
                return False
            else:
                self.log_result("Dashboard Stats Fields", True, "All expected fields present")
        
        return success

    def test_settings(self):
        """Test settings endpoints"""
        # Get settings
        success1, _ = self.run_test(
            "Get Settings",
            "GET",
            "settings/",
            200
        )
        
        # Update settings
        settings_data = {
            "linkedin_url": "https://www.linkedin.com/company/test/",
            "sender_email": "test@example.com"
        }
        
        success2, _ = self.run_test(
            "Update Settings",
            "PUT",
            "settings/",
            200,
            data=settings_data
        )
        
        return success1 and success2

    def test_email_preview(self):
        """Test email preview with AI generation"""
        # First create a template
        template_data = {
            "name": "Preview Test Template",
            "subject": "Test Preview - {{evento_titulo}}",
            "body_html": "<p>Hello {{nombre}}, join our event {{evento_titulo}}!</p>",
            "variables": ["nombre", "evento_titulo"]
        }
        
        template_success, template_response = self.run_test(
            "Create Template for Preview",
            "POST",
            "templates/",
            200,
            data=template_data
        )
        
        if not template_success or 'id' not in template_response:
            return False
            
        template_id = template_response['id']
        
        # Get contacts to use for preview
        contacts_success, contacts_response = self.run_test(
            "Get Contacts for Preview",
            "GET",
            "hubspot/contacts",
            200
        )
        
        if contacts_success and contacts_response and len(contacts_response) > 0:
            contact_id = contacts_response[0]['id']
            
            # Test email preview generation
            preview_data = {
                "template_id": template_id,
                "contact_id": contact_id,
                "event_ids": []
            }
            
            preview_success, preview_response = self.run_test(
                "Generate Email Preview",
                "POST",
                "preview/",
                200,
                data=preview_data
            )
            
            if preview_success:
                # Check if preview response has expected fields
                expected_fields = ['contact_name', 'subject', 'body_html', 'generated_at']
                has_fields = all(field in preview_response for field in expected_fields)
                if has_fields:
                    self.log_result("Preview Response Structure", True, "All expected fields present")
                else:
                    self.log_result("Preview Response Structure", False, "Missing expected fields in preview response")
            
            # Clean up template
            self.run_test(
                "Cleanup Preview Template",
                "DELETE",
                f"templates/{template_id}",
                200
            )
            
            return preview_success
        else:
            # Clean up template
            self.run_test(
                "Cleanup Preview Template",
                "DELETE",
                f"templates/{template_id}",
                200
            )
            self.log_result("Email Preview Test", False, "No contacts available for preview test")
            return False

    def test_email_logs(self):
        """Test email logs endpoint"""
        success, _ = self.run_test(
            "Get Email Logs",
            "GET",
            "email-logs",
            200
        )
        return success

    def test_deal_movements(self):
        """Test deal movements endpoint"""
        success, _ = self.run_test(
            "Get Deal Movements",
            "GET",
            "deal-movements",
            200
        )
        return success

    def test_scheduler_info(self):
        """Test scheduler info endpoint"""
        success, response = self.run_test(
            "Get Scheduler Info",
            "GET",
            "scheduler/info",
            200
        )
        
        if success:
            # Check if response has expected fields
            expected_fields = ['schedule', 'description', 'next_run', 'status']
            has_fields = all(field in response for field in expected_fields)
            if has_fields:
                self.log_result("Scheduler Info Structure", True, f"Status: {response.get('status')}")
            else:
                self.log_result("Scheduler Info Structure", False, "Missing expected fields in scheduler response")
        
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Leaderlix API Tests")
        print("=" * 50)
        
        # Test authentication first
        print("\n📋 Testing Authentication...")
        if not self.test_user_registration():
            # If registration fails, try login (user might already exist)
            if not self.test_user_login():
                print("❌ Authentication failed - stopping tests")
                return False
        
        # Test protected routes
        if not self.test_protected_route():
            print("❌ Protected route access failed")
            return False
        
        # Test all endpoints
        print("\n📋 Testing Events Integration (HubSpot Cohortes)...")
        self.test_events_sync()
        
        print("\n📋 Testing HubSpot Integration...")
        self.test_hubspot_contacts()
        
        print("\n📋 Testing Templates CRUD...")
        self.test_templates_crud()
        
        print("\n📋 Testing Campaigns CRUD...")
        self.test_campaigns_crud()
        
        print("\n📋 Testing Email Preview with AI...")
        self.test_email_preview()
        
        print("\n📋 Testing Dashboard...")
        self.test_dashboard_stats()
        
        print("\n📋 Testing Settings...")
        self.test_settings()
        
        print("\n📋 Testing Email Logs...")
        self.test_email_logs()
        
        print("\n📋 Testing Deal Movements...")
        self.test_deal_movements()
        
        print("\n📋 Testing Scheduler Info...")
        self.test_scheduler_info()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        print(f"Total tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        # Show failed tests
        failed_tests = [r for r in self.test_results if not r['success']]
        if failed_tests:
            print(f"\n❌ Failed Tests ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"  - {test['test_name']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = LeaderlixAPITester()
    
    try:
        success = tester.run_all_tests()
        tester.print_summary()
        
        # Save results to file
        with open('/app/test_reports/backend_test_results.json', 'w') as f:
            json.dump({
                'summary': {
                    'total_tests': tester.tests_run,
                    'passed_tests': tester.tests_passed,
                    'failed_tests': tester.tests_run - tester.tests_passed,
                    'success_rate': (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0
                },
                'results': tester.test_results,
                'timestamp': datetime.now().isoformat()
            }, f, indent=2)
        
        return 0 if success else 1
        
    except Exception as e:
        print(f"❌ Test execution failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())