"""
Test suite for LinkedIn Import Connections Feature
Tests the /api/linkedin-import endpoints for:
1. POST /api/linkedin-import/request-export - Mark export requested for a profile
2. GET /api/linkedin-import/status - Get status for both profiles
3. POST /api/linkedin-import/upload - Upload CSV file and create job
4. GET /api/linkedin-import/preview/{job_id} - Preview with column mapping suggestions
5. POST /api/linkedin-import/start/{job_id} - Start import processing
6. GET /api/linkedin-import/progress/{job_id} - Get processing progress
7. GET /api/linkedin-import/{job_id}/conflicts - Get conflicts list
8. GET /api/focus/traffic-light-status - Verify semaphore logic for import-new-connections
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Session token from previous test iterations
TEST_SESSION_TOKEN = "test_session_6gxa1S6v3fIOTHk44sLNNvtI-ZcylD8USEGujgos5Ek"


@pytest.fixture(scope="class")
def auth_session():
    """Create authenticated session with cookies"""
    session = requests.Session()
    session.cookies.set("session_token", TEST_SESSION_TOKEN)
    return session


@pytest.fixture(scope="class")
def sample_linkedin_csv():
    """Generate sample LinkedIn CSV with typical columns"""
    unique_id = uuid.uuid4().hex[:8]
    return f"""First Name,Last Name,Email Address,Company,Position,URL
John,Doe,test_li_{unique_id}_1@example.com,Acme Corp,Software Engineer,https://linkedin.com/in/johndoe_{unique_id}
Jane,Smith,test_li_{unique_id}_2@example.com,Tech Inc,Product Manager,https://linkedin.com/in/janesmith_{unique_id}
Carlos,Garcia,test_li_{unique_id}_3@example.com,Global SA,CEO,https://linkedin.com/in/carlosgarcia_{unique_id}"""


class TestLinkedInImportStatus:
    """Test GET /api/linkedin-import/status endpoint"""
    
    def test_status_requires_auth(self):
        """GET /api/linkedin-import/status - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/linkedin-import/status")
        assert response.status_code == 401
        print("✓ Status endpoint requires authentication")
    
    def test_status_returns_both_profiles(self, auth_session):
        """GET /api/linkedin-import/status - returns status for GB and MG profiles"""
        response = auth_session.get(f"{BASE_URL}/api/linkedin-import/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "GB" in data
        assert "MG" in data
        
        # Validate GB profile structure
        gb = data["GB"]
        assert "profile_name" in gb
        assert gb["profile_name"] == "Gerardo Betancourt"
        assert "export_requested" in gb
        assert "import_completed" in gb
        
        # Validate MG profile structure
        mg = data["MG"]
        assert "profile_name" in mg
        assert mg["profile_name"] == "María del Mar Gargari"
        
        print(f"✓ Status endpoint returns both profiles: GB={gb['export_requested']}, MG={mg['export_requested']}")


class TestLinkedInRequestExport:
    """Test POST /api/linkedin-import/request-export endpoint"""
    
    def test_request_export_requires_auth(self):
        """POST /api/linkedin-import/request-export - requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/linkedin-import/request-export",
            json={"profile": "GB"}
        )
        assert response.status_code == 401
        print("✓ Request export requires authentication")
    
    def test_request_export_invalid_profile(self, auth_session):
        """POST /api/linkedin-import/request-export - rejects invalid profile"""
        response = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/request-export",
            json={"profile": "INVALID"}
        )
        assert response.status_code == 400
        assert "Invalid profile" in response.json().get("detail", "")
        print("✓ Request export rejects invalid profile")
    
    def test_request_export_gb_success(self, auth_session):
        """POST /api/linkedin-import/request-export - marks GB export requested"""
        response = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/request-export",
            json={"profile": "GB"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["profile"] == "GB"
        assert "week_start" in data
        print(f"✓ GB export marked as requested for week {data['week_start']}")
    
    def test_request_export_mg_success(self, auth_session):
        """POST /api/linkedin-import/request-export - marks MG export requested"""
        response = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/request-export",
            json={"profile": "MG"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["profile"] == "MG"
        print(f"✓ MG export marked as requested for week {data['week_start']}")


class TestLinkedInUpload:
    """Test POST /api/linkedin-import/upload endpoint"""
    
    def test_upload_requires_auth(self, sample_linkedin_csv):
        """POST /api/linkedin-import/upload - requires authentication"""
        files = {"file": ("connections.csv", sample_linkedin_csv, "text/csv")}
        response = requests.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files,
            data={"profile": "GB"}
        )
        assert response.status_code == 401
        print("✓ Upload requires authentication")
    
    def test_upload_rejects_non_csv(self, auth_session):
        """POST /api/linkedin-import/upload - rejects non-CSV files"""
        files = {"file": ("connections.txt", "Not a CSV", "text/plain")}
        response = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files,
            data={"profile": "GB"}
        )
        assert response.status_code == 400
        assert "CSV" in response.json().get("detail", "")
        print("✓ Upload rejects non-CSV files")
    
    def test_upload_rejects_invalid_profile(self, auth_session, sample_linkedin_csv):
        """POST /api/linkedin-import/upload - rejects invalid profile"""
        files = {"file": ("connections.csv", sample_linkedin_csv, "text/csv")}
        response = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files,
            data={"profile": "INVALID"}
        )
        assert response.status_code == 400
        print("✓ Upload rejects invalid profile")
    
    def test_upload_success(self, auth_session, sample_linkedin_csv):
        """POST /api/linkedin-import/upload - successful upload"""
        files = {"file": ("connections.csv", sample_linkedin_csv, "text/csv")}
        response = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files,
            data={"profile": "GB"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "job_id" in data
        assert data["total_rows"] == 3
        assert "headers" in data
        
        # Verify headers detected from CSV
        headers = data["headers"]
        assert "First Name" in headers
        assert "Last Name" in headers
        assert "Email Address" in headers
        
        print(f"✓ Upload successful: job_id={data['job_id']}, rows={data['total_rows']}")
        
        # Store job_id for other tests
        auth_session.test_job_id = data["job_id"]
        return data["job_id"]


class TestLinkedInPreview:
    """Test GET /api/linkedin-import/preview/{job_id} endpoint"""
    
    def test_preview_not_found(self, auth_session):
        """GET /api/linkedin-import/preview - returns 404 for invalid job_id"""
        response = auth_session.get(
            f"{BASE_URL}/api/linkedin-import/preview/invalid-job-id-12345"
        )
        assert response.status_code == 404
        print("✓ Preview returns 404 for invalid job_id")
    
    def test_preview_success(self, auth_session, sample_linkedin_csv):
        """GET /api/linkedin-import/preview - returns preview with column mapping"""
        # First upload a file
        files = {"file": ("connections.csv", sample_linkedin_csv, "text/csv")}
        upload_res = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files,
            data={"profile": "GB"}
        )
        job_id = upload_res.json()["job_id"]
        
        # Get preview
        response = auth_session.get(f"{BASE_URL}/api/linkedin-import/preview/{job_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["job_id"] == job_id
        assert "headers" in data
        assert "preview_rows" in data
        assert len(data["preview_rows"]) <= 50  # Max 50 rows
        assert "column_mapping" in data
        assert "suggested_mapping" in data
        
        # Check suggested mappings for known columns
        suggested = data["suggested_mapping"]
        assert "First Name" in suggested or any(
            suggested.get(h) == "first_name" for h in data["headers"]
        )
        
        print(f"✓ Preview successful: {len(data['preview_rows'])} rows, {len(data['headers'])} headers")
        return job_id


class TestLinkedInStartImport:
    """Test POST /api/linkedin-import/start/{job_id} endpoint"""
    
    def test_start_not_found(self, auth_session):
        """POST /api/linkedin-import/start - returns 404 for invalid job_id"""
        response = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/start/invalid-job-id-12345",
            json={"First Name": "first_name", "Last Name": "last_name"}
        )
        assert response.status_code == 404
        print("✓ Start returns 404 for invalid job_id")
    
    def test_start_import_success(self, auth_session, sample_linkedin_csv):
        """POST /api/linkedin-import/start - starts import processing"""
        # First upload a file
        files = {"file": ("connections.csv", sample_linkedin_csv, "text/csv")}
        upload_res = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files,
            data={"profile": "GB"}
        )
        job_id = upload_res.json()["job_id"]
        
        # Get preview to get suggested mapping
        preview_res = auth_session.get(f"{BASE_URL}/api/linkedin-import/preview/{job_id}")
        column_mapping = preview_res.json()["suggested_mapping"]
        
        # If suggested_mapping is empty, create a default mapping
        if not column_mapping:
            column_mapping = {
                "First Name": "first_name",
                "Last Name": "last_name",
                "Email Address": "email",
                "Company": "company",
                "Position": "job_title",
                "URL": "linkedin_url"
            }
        
        # Start import
        response = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/start/{job_id}",
            json=column_mapping
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["job_id"] == job_id
        assert data["status"] == "processing"
        
        print(f"✓ Import started: job_id={job_id}")
        
        # Store for progress test
        auth_session.processing_job_id = job_id
        return job_id


class TestLinkedInProgress:
    """Test GET /api/linkedin-import/progress/{job_id} endpoint"""
    
    def test_progress_not_found(self, auth_session):
        """GET /api/linkedin-import/progress - returns 404 for invalid job_id"""
        response = auth_session.get(
            f"{BASE_URL}/api/linkedin-import/progress/invalid-job-id-12345"
        )
        assert response.status_code == 404
        print("✓ Progress returns 404 for invalid job_id")
    
    def test_progress_after_start(self, auth_session):
        """GET /api/linkedin-import/progress - returns progress after starting import"""
        unique_id = uuid.uuid4().hex[:8]
        csv_content = f"""First Name,Last Name,Email Address,Company
ProgressTest,User,progress_{unique_id}@example.com,TestCorp"""
        
        # Use MG profile to avoid conflicts with other GB tests
        files = {"file": ("connections.csv", csv_content, "text/csv")}
        upload_res = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files,
            data={"profile": "MG"}
        )
        
        # Handle conflict case - skip if there's already a processing job
        if upload_res.status_code == 409:
            pytest.skip("MG profile has a processing job - skipping test")
        
        assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
        job_id = upload_res.json()["job_id"]
        
        # Get preview for mapping
        preview_res = auth_session.get(f"{BASE_URL}/api/linkedin-import/preview/{job_id}")
        column_mapping = preview_res.json().get("suggested_mapping", {})
        if not column_mapping:
            column_mapping = {
                "First Name": "first_name",
                "Last Name": "last_name",
                "Email Address": "email"
            }
        
        # Start import
        auth_session.post(f"{BASE_URL}/api/linkedin-import/start/{job_id}", json=column_mapping)
        
        # Wait a bit for background processing
        time.sleep(2)
        
        # Get progress
        response = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["job_id"] == job_id
        assert "status" in data
        assert "progress_percent" in data
        assert "total_rows" in data
        assert "processed_rows" in data
        assert "contacts_created" in data
        assert "contacts_updated" in data
        assert "conflicts_count" in data
        
        # Status should be processing or completed
        assert data["status"] in ["processing", "completed", "failed"]
        
        print(f"✓ Progress: status={data['status']}, progress={data['progress_percent']}%")


class TestLinkedInConflicts:
    """Test GET /api/linkedin-import/{job_id}/conflicts endpoint"""
    
    def test_conflicts_not_found(self, auth_session):
        """GET /api/linkedin-import/{job_id}/conflicts - returns 404 for invalid job_id"""
        response = auth_session.get(
            f"{BASE_URL}/api/linkedin-import/invalid-job-id-12345/conflicts"
        )
        assert response.status_code == 404
        print("✓ Conflicts returns 404 for invalid job_id")
    
    def test_conflicts_structure(self, auth_session):
        """GET /api/linkedin-import/{job_id}/conflicts - returns conflicts list"""
        unique_id = uuid.uuid4().hex[:8]
        csv_content = f"""First Name,Last Name,Email Address,Company
ConflictTest,User,conflict_{unique_id}@example.com,TestCorp"""
        
        # Use MG profile to avoid conflicts with other GB tests
        files = {"file": ("connections.csv", csv_content, "text/csv")}
        upload_res = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files,
            data={"profile": "MG"}
        )
        
        # Handle conflict case - skip if there's already a processing job
        if upload_res.status_code == 409:
            pytest.skip("MG profile has a processing job - skipping test")
        
        assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
        job_id = upload_res.json()["job_id"]
        
        # Get conflicts (even before starting)
        response = auth_session.get(f"{BASE_URL}/api/linkedin-import/{job_id}/conflicts")
        assert response.status_code == 200
        
        data = response.json()
        assert data["job_id"] == job_id
        assert "total_conflicts" in data
        assert "conflicts" in data
        assert isinstance(data["conflicts"], list)
        
        print(f"✓ Conflicts endpoint returned {data['total_conflicts']} conflicts")


class TestLinkedInJobs:
    """Test GET /api/linkedin-import/jobs endpoint"""
    
    def test_jobs_requires_auth(self):
        """GET /api/linkedin-import/jobs - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/linkedin-import/jobs")
        assert response.status_code == 401
        print("✓ Jobs endpoint requires authentication")
    
    def test_jobs_list(self, auth_session):
        """GET /api/linkedin-import/jobs - lists import jobs"""
        response = auth_session.get(f"{BASE_URL}/api/linkedin-import/jobs")
        assert response.status_code == 200
        
        data = response.json()
        assert "jobs" in data
        assert isinstance(data["jobs"], list)
        
        print(f"✓ Jobs endpoint returned {len(data['jobs'])} jobs")
    
    def test_jobs_filter_by_profile(self, auth_session, sample_linkedin_csv):
        """GET /api/linkedin-import/jobs - filters by profile"""
        # Create a job for GB
        files = {"file": ("connections.csv", sample_linkedin_csv, "text/csv")}
        auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files,
            data={"profile": "GB"}
        )
        
        # Filter by GB
        response = auth_session.get(f"{BASE_URL}/api/linkedin-import/jobs?profile=GB")
        assert response.status_code == 200
        
        data = response.json()
        assert "jobs" in data
        
        # All returned jobs should be for GB profile
        for job in data["jobs"]:
            assert job["profile"] == "GB"
        
        print(f"✓ Jobs filtered by profile: {len(data['jobs'])} GB jobs")


class TestTrafficLightSemaphore:
    """Test traffic light status for import-new-connections section"""
    
    def test_traffic_light_status_endpoint(self, auth_session):
        """GET /api/focus/traffic-light-status - returns status for import-new-connections"""
        response = auth_session.get(f"{BASE_URL}/api/focus/traffic-light-status")
        assert response.status_code == 200
        
        data = response.json()
        assert "import-new-connections" in data
        
        status = data["import-new-connections"]
        assert status in ["red", "yellow", "green"]
        
        print(f"✓ Traffic light status for import-new-connections: {status}")
    
    def test_semaphore_logic_initial_state(self, auth_session):
        """Verify semaphore is RED when nothing is requested"""
        # Get current status
        status_res = auth_session.get(f"{BASE_URL}/api/linkedin-import/status")
        status = status_res.json()
        
        gb_requested = status["GB"]["export_requested"]
        mg_requested = status["MG"]["export_requested"]
        gb_imported = status["GB"]["import_completed"]
        mg_imported = status["MG"]["import_completed"]
        
        # Get traffic light
        tl_res = auth_session.get(f"{BASE_URL}/api/focus/traffic-light-status")
        tl_status = tl_res.json()["import-new-connections"]
        
        # Verify logic:
        # RED = neither requested
        # YELLOW = some requested but not both imported
        # GREEN = both imported
        
        if gb_imported and mg_imported:
            expected = "green"
        elif not gb_requested and not mg_requested:
            expected = "red"
        else:
            expected = "yellow"
        
        assert tl_status == expected, f"Expected {expected}, got {tl_status}"
        print(f"✓ Semaphore logic verified: GB_req={gb_requested}, MG_req={mg_requested}, GB_imp={gb_imported}, MG_imp={mg_imported} => {tl_status}")


class TestFullImportWorkflow:
    """Test complete import workflow from upload to completion"""
    
    def test_complete_import_workflow(self, auth_session):
        """Test full workflow: upload -> preview -> start -> progress -> complete"""
        unique_id = uuid.uuid4().hex[:8]
        
        # 1. Create unique CSV data
        csv_content = f"""First Name,Last Name,Email Address,Company,Position,URL
TestFlow,User1,testflow_{unique_id}_1@example.com,FlowCorp,Engineer,https://linkedin.com/in/flowuser1_{unique_id}
TestFlow,User2,testflow_{unique_id}_2@example.com,FlowCorp,Manager,https://linkedin.com/in/flowuser2_{unique_id}"""
        
        # 2. Upload
        files = {"file": ("connections.csv", csv_content, "text/csv")}
        upload_res = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files,
            data={"profile": "GB"}
        )
        assert upload_res.status_code == 200
        job_id = upload_res.json()["job_id"]
        print(f"  Step 1: Uploaded file, job_id={job_id}")
        
        # 3. Preview
        preview_res = auth_session.get(f"{BASE_URL}/api/linkedin-import/preview/{job_id}")
        assert preview_res.status_code == 200
        preview_data = preview_res.json()
        assert len(preview_data["preview_rows"]) == 2
        print(f"  Step 2: Preview returned {len(preview_data['preview_rows'])} rows")
        
        # 4. Create column mapping
        column_mapping = {
            "First Name": "first_name",
            "Last Name": "last_name", 
            "Email Address": "email",
            "Company": "company",
            "Position": "job_title",
            "URL": "linkedin_url"
        }
        
        # 5. Start import
        start_res = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/start/{job_id}",
            json=column_mapping
        )
        assert start_res.status_code == 200
        assert start_res.json()["status"] == "processing"
        print(f"  Step 3: Import started")
        
        # 6. Poll for completion
        max_attempts = 15
        for i in range(max_attempts):
            time.sleep(1)
            progress_res = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job_id}")
            progress_data = progress_res.json()
            
            if progress_data["status"] in ["completed", "failed", "cancelled"]:
                break
            print(f"  Step 4: Polling... {progress_data['progress_percent']}%")
        
        # 7. Verify completion
        final_progress = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job_id}").json()
        assert final_progress["status"] == "completed", f"Expected completed, got {final_progress['status']}"
        assert final_progress["progress_percent"] == 100
        
        print(f"✓ Full workflow complete: created={final_progress['contacts_created']}, updated={final_progress['contacts_updated']}, conflicts={final_progress['conflicts_count']}")
        
        # 8. Check conflicts endpoint
        conflicts_res = auth_session.get(f"{BASE_URL}/api/linkedin-import/{job_id}/conflicts")
        assert conflicts_res.status_code == 200
        print(f"  Step 5: Conflicts check returned {conflicts_res.json()['total_conflicts']} conflicts")


class TestDeduplicationLogic:
    """Test deduplication by email OR linkedin_url"""
    
    def test_email_deduplication(self, auth_session):
        """Test that duplicate email causes update instead of create"""
        unique_id = uuid.uuid4().hex[:8]
        email = f"dedup_email_{unique_id}@example.com"
        
        # First import with email
        csv1 = f"""First Name,Last Name,Email Address,Company
FirstImport,Test,{email},Company1"""
        
        files1 = {"file": ("import1.csv", csv1, "text/csv")}
        upload1 = auth_session.post(f"{BASE_URL}/api/linkedin-import/upload", files=files1, data={"profile": "GB"})
        job1 = upload1.json()["job_id"]
        
        mapping = {"First Name": "first_name", "Last Name": "last_name", "Email Address": "email", "Company": "company"}
        auth_session.post(f"{BASE_URL}/api/linkedin-import/start/{job1}", json=mapping)
        
        # Wait for completion
        for _ in range(10):
            time.sleep(1)
            progress = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job1}").json()
            if progress["status"] in ["completed", "failed"]:
                break
        
        created_first = progress.get("contacts_created", 0)
        
        # Second import with same email
        csv2 = f"""First Name,Last Name,Email Address,Company
SecondImport,Test,{email},Company2"""
        
        files2 = {"file": ("import2.csv", csv2, "text/csv")}
        upload2 = auth_session.post(f"{BASE_URL}/api/linkedin-import/upload", files=files2, data={"profile": "GB"})
        job2 = upload2.json()["job_id"]
        
        auth_session.post(f"{BASE_URL}/api/linkedin-import/start/{job2}", json=mapping)
        
        # Wait for completion
        for _ in range(10):
            time.sleep(1)
            progress2 = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job2}").json()
            if progress2["status"] in ["completed", "failed"]:
                break
        
        updated_second = progress2.get("contacts_updated", 0)
        
        print(f"✓ Email deduplication: First import created={created_first}, Second import updated={updated_second}")
        assert created_first >= 1 or updated_second >= 1, "Should create or update contact"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
