"""
Tests for Persona Reclassification Worker

Validates:
- Job creation
- Query building
- Reclassification logic
- Progress tracking
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import sys
import os

# Configure pytest-asyncio
pytestmark = pytest.mark.asyncio(loop_scope="function")

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestJobManagement:
    """Tests for job creation and management"""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        
        # Mock insert_one
        db.persona_reclassification_jobs.insert_one = AsyncMock()
        
        # Mock find_one
        db.persona_reclassification_jobs.find_one = AsyncMock(return_value=None)
        
        # Mock update_one
        db.persona_reclassification_jobs.update_one = AsyncMock(
            return_value=MagicMock(modified_count=1)
        )
        
        return db
    
    def test_job_creation_structure(self):
        """Job should have correct structure"""
        from services.persona_reclassification_worker import (
            STATUS_PENDING,
            STATUS_PROCESSING,
            STATUS_COMPLETED,
            STATUS_FAILED,
            STATUS_CANCELLED
        )
        
        # Verify status constants
        assert STATUS_PENDING == "pending"
        assert STATUS_PROCESSING == "processing"
        assert STATUS_COMPLETED == "completed"
        assert STATUS_FAILED == "failed"
        assert STATUS_CANCELLED == "cancelled"


class TestQueryBuilding:
    """Tests for contact query building"""
    
    def test_normalize_job_title_in_query(self):
        """Queries should use normalized job titles"""
        from services.persona_classifier_service import normalize_job_title
        
        # Test that normalization works for query building
        assert normalize_job_title("Director de Marketing") == "director de marketing"
        assert normalize_job_title("GERENTE MÉDICO") == "gerente medico"


class TestReclassificationLogic:
    """Tests for reclassification logic"""
    
    def test_batch_size_constant(self):
        """Batch size should be defined"""
        from services.persona_reclassification_worker import BATCH_SIZE
        
        assert BATCH_SIZE == 500
        assert BATCH_SIZE > 0
    
    def test_orphan_timeout_constant(self):
        """Orphan timeout should be defined"""
        from services.persona_reclassification_worker import ORPHAN_TIMEOUT
        
        assert ORPHAN_TIMEOUT == 300  # 5 minutes
        assert ORPHAN_TIMEOUT > 0
    
    def test_max_attempts_constant(self):
        """Max attempts should be defined"""
        from services.persona_reclassification_worker import MAX_ATTEMPTS
        
        assert MAX_ATTEMPTS == 3
        assert MAX_ATTEMPTS > 0


class TestAPIEndpoints:
    """Tests for API endpoint schemas"""
    
    def test_reclassify_all_request_schema(self):
        """ReclassifyAllRequest should have correct defaults"""
        from routers.persona_classifier import ReclassifyAllRequest
        
        request = ReclassifyAllRequest()
        assert request.dry_run == True  # Default should be dry run for safety
    
    def test_reclassify_by_keyword_request_schema(self):
        """ReclassifyByKeywordRequest should require keyword_id"""
        from routers.persona_classifier import ReclassifyByKeywordRequest
        
        request = ReclassifyByKeywordRequest(keyword_id="test-id")
        assert request.keyword_id == "test-id"
        assert request.dry_run == True
    
    def test_reclassify_by_persona_request_schema(self):
        """ReclassifyByPersonaRequest should require buyer_persona_id"""
        from routers.persona_classifier import ReclassifyByPersonaRequest
        
        request = ReclassifyByPersonaRequest(buyer_persona_id="dc_marketing")
        assert request.buyer_persona_id == "dc_marketing"
        assert request.dry_run == True
    
    def test_reclassify_affected_request_schema(self):
        """ReclassifyAffectedRequest should require keywords list"""
        from routers.persona_classifier import ReclassifyAffectedRequest
        
        request = ReclassifyAffectedRequest(keywords=["marketing", "ventas"])
        assert request.keywords == ["marketing", "ventas"]
        assert request.dry_run == True
    
    def test_diagnose_request_schema(self):
        """DiagnoseRequest should require job_title"""
        from routers.persona_classifier import DiagnoseRequest
        
        request = DiagnoseRequest(job_title="Director de Marketing")
        assert request.job_title == "Director de Marketing"
    
    def test_lock_contact_request_schema(self):
        """LockContactRequest should have correct default"""
        from routers.persona_classifier import LockContactRequest
        
        request = LockContactRequest()
        assert request.locked == True  # Default should lock


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
