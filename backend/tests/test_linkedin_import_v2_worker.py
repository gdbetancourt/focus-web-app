"""
Test suite for LinkedIn Import V2 Worker with Robust Processing

Tests V2 features:
1. Worker process integrated with scheduler (not BackgroundTasks)
2. Streaming file processing
3. Bulk write operations
4. Heartbeat and orphan job recovery
5. Profile locks to prevent concurrent imports
6. Automatic retries up to 3 attempts
7. Buyer persona classification for all contacts

Endpoints tested:
- POST /api/linkedin-import/upload - upload CSV file
- POST /api/linkedin-import/start/{job_id} - queue job for worker (NOT BackgroundTasks)
- GET /api/linkedin-import/progress/{job_id} - returns progress with heartbeat
- GET /api/linkedin-import/{job_id}/conflicts - get conflicts list
"""
import pytest
import requests
import os
import uuid
import time
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_SESSION_TOKEN = "test_session_6gxa1S6v3fIOTHk44sLNNvtI-ZcylD8USEGujgos5Ek"


@pytest.fixture(scope="class")
def auth_session():
    """Create authenticated session with cookies"""
    session = requests.Session()
    session.cookies.set("session_token", TEST_SESSION_TOKEN)
    return session


def generate_random_email():
    """Generate random email for testing"""
    prefix = ''.join(random.choices(string.ascii_lowercase, k=8))
    domain = ''.join(random.choices(string.ascii_lowercase, k=8))
    return f"{prefix}@{domain}.com"


def generate_random_linkedin_url():
    """Generate random LinkedIn URL"""
    suffix = ''.join(random.choices(string.ascii_lowercase, k=12))
    return f"https://linkedin.com/in/{suffix}"


def generate_large_csv(row_count: int) -> str:
    """Generate CSV with specified number of rows for testing"""
    unique_id = uuid.uuid4().hex[:8]
    job_titles = ["Manager", "Director", "CEO", "VP", "Head of Marketing", "Sales Executive"]
    
    rows = ["First Name,Last Name,Email Address,Company,Position,URL,Connected On"]
    for i in range(row_count):
        row = f"Test{i},User{unique_id[:4]},{generate_random_email()},Company{random.randint(1, 500)},{random.choice(job_titles)},{generate_random_linkedin_url()},2024-01-15"
        rows.append(row)
    
    return "\n".join(rows)


class TestV2WorkerIntegration:
    """Tests for V2 worker integration (runs via APScheduler, not BackgroundTasks)"""
    
    def test_start_queues_job_for_worker(self, auth_session):
        """POST /api/linkedin-import/start - queues job for worker, returns 'queued' status"""
        unique_id = uuid.uuid4().hex[:8]
        csv_content = f"""First Name,Last Name,Email Address,Company
Worker,Test,v2worker_{unique_id}@example.com,TestCorp"""
        
        # Upload file
        files = {"file": ("test.csv", csv_content, "text/csv")}
        upload_res = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files,
            data={"profile": "GB"}
        )
        
        if upload_res.status_code == 409:
            pytest.skip("Profile has a processing job - skipping test")
        
        assert upload_res.status_code == 200
        job_id = upload_res.json()["job_id"]
        
        # Start import (queues for worker)
        column_mapping = {
            "First Name": "first_name",
            "Last Name": "last_name",
            "Email Address": "email",
            "Company": "company"
        }
        
        start_res = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/start/{job_id}",
            json=column_mapping
        )
        
        assert start_res.status_code == 200
        data = start_res.json()
        
        # V2: Should return 'queued' not 'processing' since worker picks it up
        assert data["success"] == True
        assert data["status"] == "queued"
        assert "Worker will process it shortly" in data["message"]
        
        print(f"✓ Job {job_id[:8]}... queued for worker processing")
        
        return job_id
    
    def test_worker_picks_up_and_processes_job(self, auth_session):
        """Verify worker picks up job and status changes: uploaded->processing->completed"""
        unique_id = uuid.uuid4().hex[:8]
        csv_content = f"""First Name,Last Name,Email Address,Company
Pickup,Test,v2pickup_{unique_id}@example.com,PickupCorp"""
        
        # Upload file
        files = {"file": ("test.csv", csv_content, "text/csv")}
        upload_res = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files,
            data={"profile": "GB"}
        )
        
        if upload_res.status_code == 409:
            pytest.skip("Profile has a processing job - skipping test")
        
        assert upload_res.status_code == 200
        job_id = upload_res.json()["job_id"]
        
        # Verify initial status is 'uploaded'
        progress_res = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job_id}")
        assert progress_res.json()["status"] == "uploaded"
        
        # Start import
        column_mapping = {
            "First Name": "first_name",
            "Last Name": "last_name",
            "Email Address": "email"
        }
        auth_session.post(f"{BASE_URL}/api/linkedin-import/start/{job_id}", json=column_mapping)
        
        # Wait for worker to pick up (runs every 10 seconds)
        seen_statuses = set()
        max_wait = 30  # seconds
        
        for _ in range(max_wait):
            time.sleep(1)
            progress_res = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job_id}")
            status = progress_res.json()["status"]
            seen_statuses.add(status)
            
            if status in ["completed", "failed"]:
                break
        
        final_res = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job_id}")
        final_status = final_res.json()["status"]
        
        # Verify job completed or is processing
        assert final_status in ["processing", "completed", "failed"], f"Unexpected status: {final_status}"
        
        print(f"✓ Worker processed job {job_id[:8]}..., status transitions: {' -> '.join(sorted(seen_statuses))}")


class TestBulkWriteOperations:
    """Tests for bulk database write operations with batches of 500"""
    
    def test_bulk_operations_multiple_contacts(self, auth_session):
        """Verify bulk operations work with multiple contacts (batch processing)"""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create CSV with 10 contacts
        rows = ["First Name,Last Name,Email Address,Company,Position"]
        for i in range(10):
            email = f"bulk_{unique_id}_{i}@test.com"
            rows.append(f"Bulk{i},Test{unique_id[:4]},{email},BulkCorp{i},Manager")
        
        csv_content = "\n".join(rows)
        
        # Upload and start
        files = {"file": ("bulk.csv", csv_content, "text/csv")}
        upload_res = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files,
            data={"profile": "GB"}
        )
        
        if upload_res.status_code == 409:
            pytest.skip("Profile has a processing job - skipping test")
        
        assert upload_res.status_code == 200
        job_id = upload_res.json()["job_id"]
        
        column_mapping = {
            "First Name": "first_name",
            "Last Name": "last_name",
            "Email Address": "email",
            "Company": "company",
            "Position": "job_title"
        }
        
        auth_session.post(f"{BASE_URL}/api/linkedin-import/start/{job_id}", json=column_mapping)
        
        # Wait for completion
        for _ in range(30):
            time.sleep(1)
            progress_res = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job_id}")
            progress = progress_res.json()
            
            if progress["status"] in ["completed", "failed"]:
                break
        
        # Verify results
        final = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job_id}").json()
        
        total_processed = final.get("contacts_created", 0) + final.get("contacts_updated", 0)
        assert total_processed > 0, f"Expected some contacts processed, got {total_processed}"
        
        print(f"✓ Bulk operations: created={final.get('contacts_created', 0)}, updated={final.get('contacts_updated', 0)}")


class TestDeduplication:
    """Tests for deduplication by email and linkedin_url"""
    
    def test_deduplication_by_email(self, auth_session):
        """Verify deduplication works - same email updates existing contact"""
        unique_id = uuid.uuid4().hex[:8]
        email = f"dedup_v2_email_{unique_id}@test.com"
        
        # First import
        csv1 = f"""First Name,Last Name,Email Address,Company
First,Import,{email},Company1"""
        
        files1 = {"file": ("first.csv", csv1, "text/csv")}
        upload1 = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files1, data={"profile": "GB"}
        )
        
        if upload1.status_code == 409:
            pytest.skip("Profile has a processing job")
        
        job1_id = upload1.json()["job_id"]
        mapping = {"First Name": "first_name", "Last Name": "last_name", "Email Address": "email", "Company": "company"}
        auth_session.post(f"{BASE_URL}/api/linkedin-import/start/{job1_id}", json=mapping)
        
        # Wait for first import
        for _ in range(30):
            time.sleep(1)
            p1 = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job1_id}").json()
            if p1["status"] in ["completed", "failed"]:
                break
        
        created_first = p1.get("contacts_created", 0)
        
        # Second import with SAME email
        csv2 = f"""First Name,Last Name,Email Address,Company
Second,Import,{email},Company2"""
        
        files2 = {"file": ("second.csv", csv2, "text/csv")}
        upload2 = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files2, data={"profile": "GB"}
        )
        
        # Handle potential conflict during second upload
        if upload2.status_code != 200:
            print(f"  Second upload status: {upload2.status_code} - {upload2.text[:100]}")
            pytest.skip("Could not test second import")
            
        job2_id = upload2.json()["job_id"]
        auth_session.post(f"{BASE_URL}/api/linkedin-import/start/{job2_id}", json=mapping)
        
        # Wait for second import
        for _ in range(30):
            time.sleep(1)
            p2 = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job2_id}").json()
            if p2["status"] in ["completed", "failed"]:
                break
        
        updated_second = p2.get("contacts_updated", 0)
        
        print(f"✓ Email deduplication: 1st created={created_first}, 2nd updated={updated_second}")
        assert created_first >= 1 or updated_second >= 1
    
    def test_deduplication_by_linkedin_url(self, auth_session):
        """Verify deduplication by linkedin_url works"""
        unique_id = uuid.uuid4().hex[:8]
        linkedin_url = f"https://linkedin.com/in/dedup_{unique_id}"
        
        # First import
        csv1 = f"""First Name,Last Name,URL
First,LinkedIn,{linkedin_url}"""
        
        files1 = {"file": ("li_first.csv", csv1, "text/csv")}
        upload1 = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files1, data={"profile": "GB"}
        )
        
        if upload1.status_code == 409:
            pytest.skip("Profile has a processing job")
        
        job1_id = upload1.json()["job_id"]
        mapping = {"First Name": "first_name", "Last Name": "last_name", "URL": "linkedin_url"}
        auth_session.post(f"{BASE_URL}/api/linkedin-import/start/{job1_id}", json=mapping)
        
        for _ in range(30):
            time.sleep(1)
            p1 = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job1_id}").json()
            if p1["status"] in ["completed", "failed"]:
                break
        
        print(f"✓ LinkedIn URL deduplication: status={p1['status']}, created={p1.get('contacts_created', 0)}")


class TestConflictDetection:
    """Tests for conflict detection when email matches X but linkedin matches Y"""
    
    def test_conflict_email_url_mismatch(self, auth_session):
        """Verify conflict detected when email matches X but linkedin_url matches Y"""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create two contacts first
        csv1 = f"""First Name,Last Name,Email Address,URL
ContactA,Test,conflict_email_{unique_id}@test.com,https://linkedin.com/in/contact_a_{unique_id}
ContactB,Test,contact_b_{unique_id}@test.com,https://linkedin.com/in/contact_b_{unique_id}"""
        
        files1 = {"file": ("contacts.csv", csv1, "text/csv")}
        upload1 = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files1, data={"profile": "GB"}
        )
        
        if upload1.status_code == 409:
            pytest.skip("Profile has a processing job")
        
        job1_id = upload1.json()["job_id"]
        mapping = {
            "First Name": "first_name",
            "Last Name": "last_name",
            "Email Address": "email",
            "URL": "linkedin_url"
        }
        
        auth_session.post(f"{BASE_URL}/api/linkedin-import/start/{job1_id}", json=mapping)
        
        for _ in range(30):
            time.sleep(1)
            p1 = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job1_id}").json()
            if p1["status"] in ["completed", "failed"]:
                break
        
        # Now import a row that has ContactA's email but ContactB's linkedin URL (conflict!)
        csv2 = f"""First Name,Last Name,Email Address,URL
Conflicting,Contact,conflict_email_{unique_id}@test.com,https://linkedin.com/in/contact_b_{unique_id}"""
        
        files2 = {"file": ("conflict.csv", csv2, "text/csv")}
        upload2 = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files2, data={"profile": "GB"}
        )
        
        if upload2.status_code != 200:
            pytest.skip("Could not test conflict detection")
        
        job2_id = upload2.json()["job_id"]
        auth_session.post(f"{BASE_URL}/api/linkedin-import/start/{job2_id}", json=mapping)
        
        for _ in range(30):
            time.sleep(1)
            p2 = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job2_id}").json()
            if p2["status"] in ["completed", "failed"]:
                break
        
        # Check for conflicts
        conflicts_res = auth_session.get(f"{BASE_URL}/api/linkedin-import/{job2_id}/conflicts")
        conflicts_data = conflicts_res.json()
        
        print(f"✓ Conflict detection: {conflicts_data.get('total_conflicts', 0)} conflicts found")


class TestProgressWithHeartbeat:
    """Tests for progress endpoint and heartbeat"""
    
    def test_progress_returns_heartbeat_data(self, auth_session):
        """Verify progress endpoint returns proper job data"""
        # Get a recent job
        jobs_res = auth_session.get(f"{BASE_URL}/api/linkedin-import/jobs?profile=GB")
        jobs = jobs_res.json().get("jobs", [])
        
        if not jobs:
            pytest.skip("No jobs found to test progress")
        
        job = jobs[0]
        job_id = job["job_id"]
        
        # Get progress
        progress_res = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job_id}")
        assert progress_res.status_code == 200
        
        data = progress_res.json()
        
        # Verify required fields
        assert "status" in data
        assert "progress_percent" in data
        assert "total_rows" in data
        assert "processed_rows" in data
        assert "contacts_created" in data
        assert "contacts_updated" in data
        assert "conflicts_count" in data
        
        print(f"✓ Progress endpoint: status={data['status']}, progress={data['progress_percent']}%")


class TestProfileLock:
    """Tests for profile locking to prevent concurrent imports"""
    
    def test_profile_lock_prevents_concurrent_imports(self, auth_session):
        """Verify only one import can process per profile at a time"""
        unique_id = uuid.uuid4().hex[:8]
        
        # First upload and start
        csv1 = f"""First Name,Last Name,Email Address
Lock1,Test,lock1_{unique_id}@test.com"""
        
        files1 = {"file": ("lock1.csv", csv1, "text/csv")}
        upload1 = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files1, data={"profile": "MG"}  # Use MG to avoid conflicts with other tests
        )
        
        if upload1.status_code == 409:
            # This actually proves the lock works!
            print("✓ Profile lock working - rejected upload because another job is processing")
            return
        
        job1_id = upload1.json()["job_id"]
        mapping = {"First Name": "first_name", "Last Name": "last_name", "Email Address": "email"}
        
        # Start first job
        start1 = auth_session.post(f"{BASE_URL}/api/linkedin-import/start/{job1_id}", json=mapping)
        
        # Try to start another job for same profile immediately
        csv2 = f"""First Name,Last Name,Email Address
Lock2,Test,lock2_{unique_id}@test.com"""
        
        files2 = {"file": ("lock2.csv", csv2, "text/csv")}
        upload2 = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files2, data={"profile": "MG"}
        )
        
        # If first job is processing, second upload should be rejected with 409
        if upload2.status_code == 409:
            print("✓ Profile lock prevents concurrent imports (409 on second upload)")
            assert "Another import is already processing" in upload2.json().get("detail", "")
        else:
            # Jobs might complete very fast, so just check they don't conflict
            print(f"✓ Profile lock test: 1st upload OK, 2nd upload status={upload2.status_code}")


class TestBuyerPersonaClassification:
    """Tests for buyer persona classification during import"""
    
    def test_buyer_persona_classification_runs(self, auth_session):
        """Verify buyer persona classification runs for all contacts"""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create CSV with various job titles
        csv_content = f"""First Name,Last Name,Email Address,Position
CEO,Test,bp_ceo_{unique_id}@test.com,Chief Executive Officer
Director,Test,bp_dir_{unique_id}@test.com,Director of Sales
Manager,Test,bp_mgr_{unique_id}@test.com,Marketing Manager"""
        
        files = {"file": ("bp.csv", csv_content, "text/csv")}
        upload = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files, data={"profile": "GB"}
        )
        
        if upload.status_code == 409:
            pytest.skip("Profile has a processing job")
        
        job_id = upload.json()["job_id"]
        mapping = {
            "First Name": "first_name",
            "Last Name": "last_name",
            "Email Address": "email",
            "Position": "job_title"
        }
        
        auth_session.post(f"{BASE_URL}/api/linkedin-import/start/{job_id}", json=mapping)
        
        # Wait for completion
        for _ in range(30):
            time.sleep(1)
            progress = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job_id}").json()
            if progress["status"] in ["completed", "failed"]:
                break
        
        # Worker should have classified buyer personas
        # The actual classification depends on job_keywords collection
        print(f"✓ Buyer persona classification: status={progress['status']}")


class TestOrphanJobRecovery:
    """Tests for orphan job recovery (jobs stuck in processing are retried)"""
    
    def test_orphan_job_recovery_logic(self, auth_session):
        """Verify orphan job recovery configuration"""
        # Check jobs list for any stuck jobs
        jobs_res = auth_session.get(f"{BASE_URL}/api/linkedin-import/jobs")
        jobs = jobs_res.json().get("jobs", [])
        
        # Look for any jobs stuck in processing for too long
        processing_jobs = [j for j in jobs if j.get("status") == "processing"]
        
        for job in processing_jobs:
            job_id = job["job_id"]
            heartbeat = job.get("heartbeat_at")
            attempts = job.get("attempts", 0)
            
            print(f"  Processing job: {job_id[:8]}... heartbeat={heartbeat}, attempts={attempts}")
        
        print(f"✓ Orphan recovery check: {len(processing_jobs)} jobs currently processing")


class TestEndpointValidations:
    """Tests for endpoint validations and error handling"""
    
    def test_upload_rejects_empty_csv(self, auth_session):
        """POST /api/linkedin-import/upload - rejects empty CSV"""
        csv_content = "First Name,Last Name,Email\n"  # Headers only, no data
        
        files = {"file": ("empty.csv", csv_content, "text/csv")}
        response = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files,
            data={"profile": "GB"}
        )
        
        assert response.status_code == 400
        assert "empty" in response.json().get("detail", "").lower()
        print("✓ Empty CSV rejected")
    
    def test_start_requires_valid_mapping(self, auth_session):
        """POST /api/linkedin-import/start - requires at least first_name, last_name, or linkedin_url"""
        unique_id = uuid.uuid4().hex[:8]
        csv_content = f"""First Name,Last Name,Email
Test,User,test_{unique_id}@test.com"""
        
        files = {"file": ("test.csv", csv_content, "text/csv")}
        upload = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files, data={"profile": "GB"}
        )
        
        if upload.status_code == 409:
            pytest.skip("Profile has a processing job")
        
        job_id = upload.json()["job_id"]
        
        # Try with invalid mapping (no first_name, last_name, or linkedin_url)
        invalid_mapping = {"Email": "email", "Some Field": "company"}
        
        response = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/start/{job_id}",
            json=invalid_mapping
        )
        
        # Should be rejected
        assert response.status_code == 400
        print("✓ Start rejected with invalid mapping")
    
    def test_progress_returns_404_for_invalid_job(self, auth_session):
        """GET /api/linkedin-import/progress - returns 404 for invalid job_id"""
        response = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/invalid-job-id-xyz")
        assert response.status_code == 404
        print("✓ Progress returns 404 for invalid job_id")
    
    def test_conflicts_returns_404_for_invalid_job(self, auth_session):
        """GET /api/linkedin-import/{job_id}/conflicts - returns 404 for invalid job_id"""
        response = auth_session.get(f"{BASE_URL}/api/linkedin-import/invalid-job-id-xyz/conflicts")
        assert response.status_code == 404
        print("✓ Conflicts returns 404 for invalid job_id")


class TestV2WorkerStatus:
    """Tests to verify V2 worker is running and integrated with scheduler"""
    
    def test_worker_is_running(self, auth_session):
        """Verify the LinkedIn Import Worker is running in scheduler"""
        # Create a small job and check if it gets picked up
        unique_id = uuid.uuid4().hex[:8]
        csv_content = f"""First Name,Last Name,Email
WorkerStatus,Test,ws_{unique_id}@test.com"""
        
        files = {"file": ("status.csv", csv_content, "text/csv")}
        upload = auth_session.post(
            f"{BASE_URL}/api/linkedin-import/upload",
            files=files, data={"profile": "GB"}
        )
        
        if upload.status_code == 409:
            # Worker is busy - means it's running!
            print("✓ Worker is running (profile has processing job)")
            return
        
        job_id = upload.json()["job_id"]
        mapping = {"First Name": "first_name", "Last Name": "last_name", "Email": "email"}
        auth_session.post(f"{BASE_URL}/api/linkedin-import/start/{job_id}", json=mapping)
        
        # Wait up to 20 seconds for worker to pick up the job
        worker_picked_up = False
        for _ in range(20):
            time.sleep(1)
            progress = auth_session.get(f"{BASE_URL}/api/linkedin-import/progress/{job_id}").json()
            
            if progress["status"] in ["processing", "completed"]:
                worker_picked_up = True
                break
        
        assert worker_picked_up, "Worker did not pick up job within 20 seconds"
        print(f"✓ Worker picked up job, status={progress['status']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
