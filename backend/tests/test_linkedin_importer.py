"""
Test suite for Enhanced LinkedIn Contact Importer
Tests the /api/contacts/imports endpoints for:
1. POST /api/contacts/imports/upload - Upload CSV file
2. POST /api/contacts/imports/{batch_id}/map - Save column mappings
3. POST /api/contacts/imports/{batch_id}/validate - Validate data
4. POST /api/contacts/imports/{batch_id}/run - Run import
5. GET /api/contacts/imports/{batch_id}/status - Get status
6. GET /api/contacts/imports - List batches
"""
import pytest
import requests
import os
import uuid
from io import BytesIO

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Session token for staff authentication  
TEST_SESSION_TOKEN = "teststaff_jRpK6_PrQ_IboZOMBMUOdjGBBXAarHlrMzsly06s6Xo"


class TestLinkedInImporterEndpoints:
    """Test Enhanced LinkedIn Contact Importer endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Create authenticated session with cookies"""
        session = requests.Session()
        session.cookies.set("session_token", TEST_SESSION_TOKEN)
        return session
    
    @pytest.fixture(scope="class")
    def sample_csv_content(self):
        """Generate sample LinkedIn CSV content"""
        unique_id = uuid.uuid4().hex[:8]
        return f"""Email,First Name,Last Name,Company,Position,Country,Phone
test_import_{unique_id}_1@example.com,Juan,Pérez,Empresa SA,Director Marketing,Mexico,+52 55 1234 5678
test_import_{unique_id}_2@example.com,María,García,Otra Empresa,Gerente RRHH,Colombia,+57 311 123 4567
test_import_{unique_id}_3@example.com,Carlos,López,Mi Company,CEO,Mexico,+52 55 9876 5432"""
    
    def test_list_batches_requires_auth(self):
        """GET /api/contacts/imports - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/contacts/imports")
        assert response.status_code == 401
        print("✓ List batches requires authentication")
    
    def test_list_batches_success(self, auth_session):
        """GET /api/contacts/imports - list recent batches"""
        response = auth_session.get(f"{BASE_URL}/api/contacts/imports?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "batches" in data
        assert isinstance(data["batches"], list)
        print(f"✓ List batches returned {len(data['batches'])} batches")
    
    def test_upload_csv_requires_auth(self, sample_csv_content):
        """POST /api/contacts/imports/upload - requires authentication"""
        files = {"file": ("test.csv", sample_csv_content, "text/csv")}
        response = requests.post(f"{BASE_URL}/api/contacts/imports/upload", files=files)
        assert response.status_code == 401
        print("✓ Upload CSV requires authentication")
    
    def test_upload_csv_success(self, auth_session, sample_csv_content):
        """POST /api/contacts/imports/upload - successful upload"""
        files = {"file": ("linkedin_contacts.csv", sample_csv_content, "text/csv")}
        response = auth_session.post(f"{BASE_URL}/api/contacts/imports/upload", files=files)
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        
        data = response.json()
        assert "batch_id" in data
        assert "headers" in data
        assert "total_rows" in data
        assert "suggested_mappings" in data
        assert data["total_rows"] == 3
        
        # Verify headers detected
        headers = data["headers"]
        assert "Email" in headers
        assert "First Name" in headers
        assert "Country" in headers
        
        print(f"✓ CSV uploaded successfully: batch_id={data['batch_id']}, rows={data['total_rows']}")
        
        # Store batch_id for subsequent tests
        auth_session.batch_id = data["batch_id"]
        return data["batch_id"]
    
    def test_upload_rejects_non_csv(self, auth_session):
        """POST /api/contacts/imports/upload - rejects non-CSV files"""
        files = {"file": ("test.txt", "This is not a CSV", "text/plain")}
        response = auth_session.post(f"{BASE_URL}/api/contacts/imports/upload", files=files)
        
        assert response.status_code == 400
        assert "CSV" in response.json().get("detail", "")
        print("✓ Upload correctly rejects non-CSV files")
    
    def test_map_columns(self, auth_session, sample_csv_content):
        """POST /api/contacts/imports/{batch_id}/map - save column mappings"""
        # First upload
        files = {"file": ("linkedin_contacts.csv", sample_csv_content, "text/csv")}
        upload_response = auth_session.post(f"{BASE_URL}/api/contacts/imports/upload", files=files)
        batch_id = upload_response.json()["batch_id"]
        
        # Map columns
        mapping_data = {
            "mappings": [
                {"csv_column": "Email", "focus_field": "email", "is_primary": True, "separator": None},
                {"csv_column": "First Name", "focus_field": "first_name", "is_primary": False, "separator": None},
                {"csv_column": "Last Name", "focus_field": "last_name", "is_primary": False, "separator": None},
                {"csv_column": "Company", "focus_field": "company", "is_primary": False, "separator": None},
                {"csv_column": "Position", "focus_field": "job_title", "is_primary": False, "separator": None},
                {"csv_column": "Country", "focus_field": "country", "is_primary": False, "separator": None},
                {"csv_column": "Phone", "focus_field": "phone", "is_primary": True, "separator": None}
            ],
            "config": {
                "delimiter": ",",
                "has_headers": True,
                "default_country_code": "+52",
                "multivalue_separator": ";",
                "upsert_policy": "UPDATE_EXISTING",
                "strict_mode": False,
                "overwrite_empty": False
            }
        }
        
        response = auth_session.post(
            f"{BASE_URL}/api/contacts/imports/{batch_id}/map",
            json=mapping_data
        )
        
        assert response.status_code == 200
        assert response.json().get("success") == True
        print(f"✓ Column mappings saved for batch {batch_id}")
        
        return batch_id
    
    def test_validate_import(self, auth_session, sample_csv_content):
        """POST /api/contacts/imports/{batch_id}/validate - validate data"""
        # Upload and map first
        files = {"file": ("linkedin_contacts.csv", sample_csv_content, "text/csv")}
        upload_response = auth_session.post(f"{BASE_URL}/api/contacts/imports/upload", files=files)
        batch_id = upload_response.json()["batch_id"]
        
        mapping_data = {
            "mappings": [
                {"csv_column": "Email", "focus_field": "email", "is_primary": True, "separator": None},
                {"csv_column": "First Name", "focus_field": "first_name", "is_primary": False, "separator": None},
                {"csv_column": "Last Name", "focus_field": "last_name", "is_primary": False, "separator": None},
                {"csv_column": "Country", "focus_field": "country", "is_primary": False, "separator": None}
            ],
            "config": {
                "delimiter": ",",
                "has_headers": True,
                "default_country_code": "+52",
                "multivalue_separator": ";",
                "upsert_policy": "CREATE_ONLY",
                "strict_mode": False,
                "overwrite_empty": False
            }
        }
        auth_session.post(f"{BASE_URL}/api/contacts/imports/{batch_id}/map", json=mapping_data)
        
        # Validate
        response = auth_session.post(f"{BASE_URL}/api/contacts/imports/{batch_id}/validate")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "batch_id" in data
        assert "total_rows" in data
        assert "to_create" in data
        assert "to_update" in data
        assert "can_proceed" in data
        
        print(f"✓ Validation complete: {data['to_create']} to create, {data['to_update']} to update, errors={data['errors']}")
        
        return batch_id
    
    def test_run_import(self, auth_session, sample_csv_content):
        """POST /api/contacts/imports/{batch_id}/run - execute import"""
        # Upload
        unique_id = uuid.uuid4().hex[:8]
        csv_content = f"""Email,First Name,Last Name,Company
testlinkedin_run_{unique_id}@example.com,Test,User,TestCorp"""
        
        files = {"file": ("linkedin_contacts.csv", csv_content, "text/csv")}
        upload_response = auth_session.post(f"{BASE_URL}/api/contacts/imports/upload", files=files)
        batch_id = upload_response.json()["batch_id"]
        
        # Map
        mapping_data = {
            "mappings": [
                {"csv_column": "Email", "focus_field": "email", "is_primary": True, "separator": None},
                {"csv_column": "First Name", "focus_field": "first_name", "is_primary": False, "separator": None},
                {"csv_column": "Last Name", "focus_field": "last_name", "is_primary": False, "separator": None},
                {"csv_column": "Company", "focus_field": "company", "is_primary": False, "separator": None}
            ],
            "config": {
                "delimiter": ",",
                "has_headers": True,
                "default_country_code": "+52",
                "multivalue_separator": ";",
                "upsert_policy": "CREATE_ONLY",
                "strict_mode": False,
                "overwrite_empty": False
            }
        }
        auth_session.post(f"{BASE_URL}/api/contacts/imports/{batch_id}/map", json=mapping_data)
        
        # Validate
        auth_session.post(f"{BASE_URL}/api/contacts/imports/{batch_id}/validate")
        
        # Run import
        response = auth_session.post(f"{BASE_URL}/api/contacts/imports/{batch_id}/run")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert "created" in data or "updated" in data
        
        print(f"✓ Import completed: created={data.get('created', 0)}, updated={data.get('updated', 0)}, skipped={data.get('skipped', 0)}")
        
        return batch_id
    
    def test_get_batch_status(self, auth_session, sample_csv_content):
        """GET /api/contacts/imports/{batch_id}/status - get batch status"""
        # Upload a file first
        files = {"file": ("linkedin_contacts.csv", sample_csv_content, "text/csv")}
        upload_response = auth_session.post(f"{BASE_URL}/api/contacts/imports/upload", files=files)
        batch_id = upload_response.json()["batch_id"]
        
        # Get status
        response = auth_session.get(f"{BASE_URL}/api/contacts/imports/{batch_id}/status")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "batch_id" in data
        assert "status" in data
        assert data["status"] == "uploaded"
        
        print(f"✓ Batch status retrieved: {data['status']}")
    
    def test_validate_requires_mapping(self, auth_session, sample_csv_content):
        """POST /api/contacts/imports/{batch_id}/validate - requires mappings first"""
        # Upload but don't map
        files = {"file": ("linkedin_contacts.csv", sample_csv_content, "text/csv")}
        upload_response = auth_session.post(f"{BASE_URL}/api/contacts/imports/upload", files=files)
        batch_id = upload_response.json()["batch_id"]
        
        # Try to validate without mapping
        response = auth_session.post(f"{BASE_URL}/api/contacts/imports/{batch_id}/validate")
        
        # Should fail with 400 because no mappings
        assert response.status_code == 400
        assert "mapping" in response.json().get("detail", "").lower() or "step 2" in response.json().get("detail", "").lower()
        print("✓ Validation correctly requires mapping step first")
    
    def test_duplicate_policy_create_only(self, auth_session):
        """Test CREATE_ONLY duplicate policy skips existing contacts"""
        unique_id = uuid.uuid4().hex[:8]
        email = f"testdup_{unique_id}@example.com"
        
        # First import - creates contact
        csv1 = f"Email,First Name\n{email},First Import"
        files1 = {"file": ("import1.csv", csv1, "text/csv")}
        upload1 = auth_session.post(f"{BASE_URL}/api/contacts/imports/upload", files=files1)
        batch_id1 = upload1.json()["batch_id"]
        
        mapping = {
            "mappings": [{"csv_column": "Email", "focus_field": "email", "is_primary": True, "separator": None}],
            "config": {
                "delimiter": ",", "has_headers": True, "default_country_code": "+52",
                "upsert_policy": "CREATE_ONLY", "strict_mode": False, "overwrite_empty": False
            }
        }
        auth_session.post(f"{BASE_URL}/api/contacts/imports/{batch_id1}/map", json=mapping)
        auth_session.post(f"{BASE_URL}/api/contacts/imports/{batch_id1}/validate")
        result1 = auth_session.post(f"{BASE_URL}/api/contacts/imports/{batch_id1}/run").json()
        
        created_first = result1.get("created", 0)
        
        # Second import - should skip because CREATE_ONLY
        csv2 = f"Email,First Name\n{email},Second Import"
        files2 = {"file": ("import2.csv", csv2, "text/csv")}
        upload2 = auth_session.post(f"{BASE_URL}/api/contacts/imports/upload", files=files2)
        batch_id2 = upload2.json()["batch_id"]
        
        auth_session.post(f"{BASE_URL}/api/contacts/imports/{batch_id2}/map", json=mapping)
        auth_session.post(f"{BASE_URL}/api/contacts/imports/{batch_id2}/validate")
        result2 = auth_session.post(f"{BASE_URL}/api/contacts/imports/{batch_id2}/run").json()
        
        skipped = result2.get("skipped", 0)
        
        print(f"✓ CREATE_ONLY policy: first created={created_first}, second skipped={skipped}")
        assert skipped >= 1 or result2.get("created", 0) == 0, "Should skip existing contacts with CREATE_ONLY policy"
    
    def test_country_field_support(self, auth_session):
        """Test Country field is properly imported"""
        unique_id = uuid.uuid4().hex[:8]
        csv_content = f"""Email,First Name,Country
testcountry_{unique_id}@example.com,Test User,Argentina"""
        
        files = {"file": ("country_test.csv", csv_content, "text/csv")}
        upload_response = auth_session.post(f"{BASE_URL}/api/contacts/imports/upload", files=files)
        batch_id = upload_response.json()["batch_id"]
        
        mapping = {
            "mappings": [
                {"csv_column": "Email", "focus_field": "email", "is_primary": True, "separator": None},
                {"csv_column": "First Name", "focus_field": "first_name", "is_primary": False, "separator": None},
                {"csv_column": "Country", "focus_field": "country", "is_primary": False, "separator": None}
            ],
            "config": {
                "delimiter": ",", "has_headers": True, "default_country_code": "+52",
                "upsert_policy": "CREATE_ONLY", "strict_mode": False, "overwrite_empty": False
            }
        }
        
        auth_session.post(f"{BASE_URL}/api/contacts/imports/{batch_id}/map", json=mapping)
        validate_result = auth_session.post(f"{BASE_URL}/api/contacts/imports/{batch_id}/validate").json()
        
        # Check preview data has country
        preview = validate_result.get("preview_results", [])
        if preview:
            processed = preview[0].get("processed_data", {})
            assert processed.get("country") == "Argentina", f"Country not properly mapped: {processed}"
        
        print("✓ Country field is properly supported")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
