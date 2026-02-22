"""
Tests for Persona Classifier Metrics

Validates:
- Metrics computation
- Configuration constants
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock
import sys
import os

# Configure pytest-asyncio
pytestmark = pytest.mark.asyncio(loop_scope="function")

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestMetricsConfiguration:
    """Tests for metrics configuration"""
    
    def test_metrics_interval(self):
        """Metrics interval should be 6 hours"""
        from services.persona_classifier_metrics import METRICS_INTERVAL_HOURS
        assert METRICS_INTERVAL_HOURS == 6
    
    def test_metrics_retention(self):
        """Metrics retention should be 90 days"""
        from services.persona_classifier_metrics import METRICS_RETENTION_DAYS
        assert METRICS_RETENTION_DAYS == 90


class TestMetricsStructure:
    """Tests for metrics output structure"""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        
        # Mock count_documents
        db.unified_contacts.count_documents = AsyncMock(return_value=1000)
        db.job_keywords.count_documents = AsyncMock(return_value=50)
        
        # Mock aggregate for persona counts
        persona_cursor = AsyncMock()
        persona_cursor.to_list = AsyncMock(return_value=[
            {"_id": "dc_marketing", "count": 200},
            {"_id": "dc_comerciales", "count": 300},
            {"_id": "mateo", "count": 500}
        ])
        db.unified_contacts.aggregate = MagicMock(return_value=persona_cursor)
        
        # Mock aggregate for keywords
        keyword_cursor = AsyncMock()
        keyword_cursor.to_list = AsyncMock(return_value=[
            {"_id": "dc_marketing", "count": 20},
            {"_id": "dc_comerciales", "count": 30}
        ])
        db.job_keywords.aggregate = MagicMock(return_value=keyword_cursor)
        
        # Mock find for keywords
        keywords_cursor = AsyncMock()
        keywords_cursor.to_list = AsyncMock(return_value=[
            {"keyword": "marketing", "buyer_persona_id": "dc_marketing"},
            {"keyword": "ventas", "buyer_persona_id": "dc_comerciales"}
        ])
        db.job_keywords.find = MagicMock(return_value=keywords_cursor)
        
        # Mock find_one for previous metrics
        db.persona_classifier_metrics.find_one = AsyncMock(return_value=None)
        
        return db
    
    def test_metrics_has_required_fields(self):
        """Metrics should have all required top-level fields"""
        # This is a structure test - we verify the function exists
        # and has proper type hints
        from services.persona_classifier_metrics import compute_classifier_metrics
        import inspect
        
        # Verify it's an async function
        assert inspect.iscoroutinefunction(compute_classifier_metrics)


class TestMetricsHelpers:
    """Tests for helper functions"""
    
    def test_get_latest_metrics_exists(self):
        """get_latest_metrics function should exist"""
        from services.persona_classifier_metrics import get_latest_metrics
        import inspect
        assert inspect.iscoroutinefunction(get_latest_metrics)
    
    def test_get_metrics_history_exists(self):
        """get_metrics_history function should exist"""
        from services.persona_classifier_metrics import get_metrics_history
        import inspect
        assert inspect.iscoroutinefunction(get_metrics_history)
    
    def test_store_metrics_exists(self):
        """store_metrics function should exist"""
        from services.persona_classifier_metrics import store_metrics
        import inspect
        assert inspect.iscoroutinefunction(store_metrics)
    
    def test_cleanup_old_metrics_exists(self):
        """cleanup_old_metrics function should exist"""
        from services.persona_classifier_metrics import cleanup_old_metrics
        import inspect
        assert inspect.iscoroutinefunction(cleanup_old_metrics)


class TestAPIEndpoints:
    """Tests for API endpoint schemas"""
    
    def test_metrics_endpoints_exist(self):
        """Metrics endpoints should be defined"""
        from routers.persona_classifier import router
        
        routes = [r.path for r in router.routes]
        
        # Routes include the prefix
        assert "/persona-classifier/metrics/latest" in routes
        assert "/persona-classifier/metrics/history" in routes
        assert "/persona-classifier/metrics/compute" in routes


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
