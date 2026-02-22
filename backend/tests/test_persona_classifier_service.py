"""
Tests for Persona Classifier Service

Validates:
- Normalization function
- Classification logic
- Cache behavior
- Override protection
"""

import pytest
import pytest_asyncio
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import sys
import os

# Configure pytest-asyncio
pytestmark = pytest.mark.asyncio(loop_scope="function")

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.persona_classifier_service import (
    normalize_job_title,
    classify_job_title,
    classify_job_title_simple,
    ClassificationResult,
    invalidate_classifier_cache,
    _classifier_cache,
    DEFAULT_BUYER_PERSONA_ID,
    DEFAULT_BUYER_PERSONA_NAME
)


class TestNormalization:
    """Tests for job title normalization"""
    
    def test_normalize_lowercase(self):
        """Should convert to lowercase"""
        assert normalize_job_title("DIRECTOR DE MARKETING") == "director de marketing"
    
    def test_normalize_accents(self):
        """Should remove accents"""
        assert normalize_job_title("Dirección Técnica") == "direccion tecnica"
        assert normalize_job_title("Gerente Médico") == "gerente medico"
        assert normalize_job_title("Coordinación de Logística") == "coordinacion de logistica"
    
    def test_normalize_special_chars(self):
        """Should remove special characters"""
        assert normalize_job_title("VP - Sales & Marketing") == "vp sales marketing"
        assert normalize_job_title("Dir. Comercial (México)") == "dir comercial mexico"
    
    def test_normalize_multiple_spaces(self):
        """Should collapse multiple spaces"""
        assert normalize_job_title("Director    de    Ventas") == "director de ventas"
    
    def test_normalize_trim(self):
        """Should trim whitespace"""
        assert normalize_job_title("  Director  ") == "director"
    
    def test_normalize_empty(self):
        """Should handle empty/None input"""
        assert normalize_job_title("") == ""
        assert normalize_job_title(None) == ""
        assert normalize_job_title("   ") == ""
    
    def test_normalize_unicode(self):
        """Should handle various unicode characters"""
        assert normalize_job_title("Ñoño") == "nono"
        assert normalize_job_title("Über Director") == "uber director"
        assert normalize_job_title("Café Manager") == "cafe manager"
    
    def test_normalize_preserves_numbers(self):
        """Should preserve numbers"""
        assert normalize_job_title("VP Level 2") == "vp level 2"
        assert normalize_job_title("Director 360") == "director 360"


class TestClassificationResult:
    """Tests for ClassificationResult class"""
    
    def test_to_dict(self):
        """Should convert to dictionary correctly"""
        result = ClassificationResult(
            buyer_persona_id="dc_marketing",
            buyer_persona_name="Direcciones de Marketing",
            matched_keywords=["marketing", "digital"],
            priority_used=2,
            normalized_job_title="director de marketing digital",
            original_job_title="Director de Marketing Digital"
        )
        
        d = result.to_dict()
        
        assert d["buyer_persona_id"] == "dc_marketing"
        assert d["buyer_persona_name"] == "Direcciones de Marketing"
        assert d["matched_keywords"] == ["marketing", "digital"]
        assert d["priority_used"] == 2
        assert d["normalized_job_title"] == "director de marketing digital"
        assert d["original_job_title"] == "Director de Marketing Digital"
    
    def test_is_default(self):
        """Should identify default classification"""
        default_result = ClassificationResult(
            buyer_persona_id="mateo",
            buyer_persona_name="Mateo",
            matched_keywords=[],
            priority_used=999,
            normalized_job_title="unknown job",
            original_job_title="Unknown Job"
        )
        assert default_result.is_default is True
        
        matched_result = ClassificationResult(
            buyer_persona_id="dc_marketing",
            buyer_persona_name="Marketing",
            matched_keywords=["marketing"],
            priority_used=1,
            normalized_job_title="marketing",
            original_job_title="Marketing"
        )
        assert matched_result.is_default is False


class TestClassification:
    """Tests for classification function - EXACT MATCH"""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        
        # Mock job_keywords collection - keywords must match EXACTLY
        keywords_data = [
            {"keyword": "director de marketing", "buyer_persona_id": "dc_marketing", "buyer_persona_name": "Direcciones de Marketing"},
            {"keyword": "gerente de ventas", "buyer_persona_id": "dc_comerciales", "buyer_persona_name": "Direcciones Comerciales"},
            {"keyword": "sales manager", "buyer_persona_id": "dc_comerciales", "buyer_persona_name": "Direcciones Comerciales"},
            {"keyword": "director general", "buyer_persona_id": "dc_generales", "buyer_persona_name": "Direcciones Generales"},
            {"keyword": "ceo", "buyer_persona_id": "dc_generales", "buyer_persona_name": "Direcciones Generales"},
            {"keyword": "director medico", "buyer_persona_id": "dc_medicas", "buyer_persona_name": "Direcciones Médicas"},
        ]
        
        mock_keywords_cursor = AsyncMock()
        mock_keywords_cursor.to_list = AsyncMock(return_value=keywords_data)
        db.job_keywords.find = MagicMock(return_value=mock_keywords_cursor)
        
        # Mock priorities collection
        priorities_data = [
            {"buyer_persona_id": "dc_generales", "buyer_persona_name": "Direcciones Generales", "priority": 1},
            {"buyer_persona_id": "dc_marketing", "buyer_persona_name": "Direcciones de Marketing", "priority": 2},
            {"buyer_persona_id": "dc_comerciales", "buyer_persona_name": "Direcciones Comerciales", "priority": 3},
            {"buyer_persona_id": "dc_medicas", "buyer_persona_name": "Direcciones Médicas", "priority": 4},
            {"buyer_persona_id": "mateo", "buyer_persona_name": "Mateo", "priority": 99},
        ]
        
        mock_priorities_cursor = AsyncMock()
        mock_priorities_cursor.sort = MagicMock(return_value=mock_priorities_cursor)
        mock_priorities_cursor.to_list = AsyncMock(return_value=priorities_data)
        db.buyer_persona_priorities.find = MagicMock(return_value=mock_priorities_cursor)
        
        return db
    
    @pytest.mark.asyncio
    async def test_classify_with_exact_match(self, mock_db):
        """Should classify only when keyword EXACTLY matches normalized job title"""
        invalidate_classifier_cache()
        
        # Exact match: "Director de Marketing" normalizes to "director de marketing"
        result = await classify_job_title(mock_db, "Director de Marketing", use_cache=False)
        
        assert result.buyer_persona_id == "dc_marketing"
        assert result.buyer_persona_name == "Direcciones de Marketing"
        assert "director de marketing" in result.matched_keywords
        assert result.normalized_job_title == "director de marketing"
    
    @pytest.mark.asyncio
    async def test_classify_no_partial_match(self, mock_db):
        """Should NOT match partial keywords - exact match only"""
        invalidate_classifier_cache()
        
        # "Director" alone should NOT match "director de marketing" keyword
        result = await classify_job_title(mock_db, "Director", use_cache=False)
        
        # Should return default because no exact match
        assert result.buyer_persona_id == DEFAULT_BUYER_PERSONA_ID
        assert result.is_default is True
    
    @pytest.mark.asyncio
    async def test_classify_no_match(self, mock_db):
        """Should return default when no keywords match"""
        invalidate_classifier_cache()
        
        result = await classify_job_title(mock_db, "Astronaut", use_cache=False)
        
        assert result.buyer_persona_id == DEFAULT_BUYER_PERSONA_ID
        assert result.buyer_persona_name == DEFAULT_BUYER_PERSONA_NAME
        assert result.matched_keywords == []
        assert result.is_default is True
    
    @pytest.mark.asyncio
    async def test_classify_empty_title(self, mock_db):
        """Should return default for empty job title"""
        invalidate_classifier_cache()
        
        result = await classify_job_title(mock_db, "", use_cache=False)
        
        assert result.buyer_persona_id == DEFAULT_BUYER_PERSONA_ID
        assert result.is_default is True
    
    @pytest.mark.asyncio
    async def test_classify_none_title(self, mock_db):
        """Should return default for None job title"""
        invalidate_classifier_cache()
        
        result = await classify_job_title(mock_db, None, use_cache=False)
        
        assert result.buyer_persona_id == DEFAULT_BUYER_PERSONA_ID
        assert result.is_default is True
    
    @pytest.mark.asyncio
    async def test_classify_ceo_exact(self, mock_db):
        """Should match CEO exactly"""
        invalidate_classifier_cache()
        
        result = await classify_job_title(mock_db, "CEO", use_cache=False)
        
        assert result.buyer_persona_id == "dc_generales"
        assert result.priority_used == 1
    
    @pytest.mark.asyncio
    async def test_classify_no_match_longer_title(self, mock_db):
        """Should NOT match if job title is longer than keyword"""
        invalidate_classifier_cache()
        
        # "CEO de Marketing" should NOT match "ceo" keyword (not exact)
        result = await classify_job_title(mock_db, "CEO de Marketing", use_cache=False)
        
        # Should return default because no exact match
        assert result.buyer_persona_id == DEFAULT_BUYER_PERSONA_ID
        assert result.is_default is True
    
    @pytest.mark.asyncio
    async def test_classify_with_accents(self, mock_db):
        """Should match keywords even with accents in job title"""
        invalidate_classifier_cache()
        
        # "Director Médico" normalizes to "director medico" which matches keyword exactly
        result = await classify_job_title(mock_db, "Director Médico", use_cache=False)
        
        # Should match "director medico" keyword after normalization
        assert result.buyer_persona_id == "dc_medicas"
    
    @pytest.mark.asyncio
    async def test_classify_simple(self, mock_db):
        """Should return just ID with simple function"""
        invalidate_classifier_cache()
        
        # "Gerente de Ventas" normalizes to "gerente de ventas" which matches keyword exactly
        result = await classify_job_title_simple(mock_db, "Gerente de Ventas", use_cache=False)
        
        assert result == "dc_comerciales"


class TestCache:
    """Tests for cache behavior"""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        
        keywords_data = [
            {"keyword": "test", "buyer_persona_id": "test_bp", "buyer_persona_name": "Test BP"},
        ]
        
        mock_keywords_cursor = AsyncMock()
        mock_keywords_cursor.to_list = AsyncMock(return_value=keywords_data)
        db.job_keywords.find = MagicMock(return_value=mock_keywords_cursor)
        
        priorities_data = [
            {"buyer_persona_id": "test_bp", "buyer_persona_name": "Test BP", "priority": 1},
        ]
        
        mock_priorities_cursor = AsyncMock()
        mock_priorities_cursor.sort = MagicMock(return_value=mock_priorities_cursor)
        mock_priorities_cursor.to_list = AsyncMock(return_value=priorities_data)
        db.buyer_persona_priorities.find = MagicMock(return_value=mock_priorities_cursor)
        
        return db
    
    @pytest.mark.asyncio
    async def test_cache_invalidation(self, mock_db):
        """Should reload data after cache invalidation"""
        # First call loads cache
        invalidate_classifier_cache()
        await classify_job_title(mock_db, "test title", use_cache=True)
        
        # Cache should be valid now
        assert _classifier_cache._is_valid is True
        
        # Invalidate
        invalidate_classifier_cache()
        
        # Cache should be invalid
        assert _classifier_cache._is_valid is False
    
    @pytest.mark.asyncio
    async def test_cache_reuse(self, mock_db):
        """Should reuse cached data on subsequent calls"""
        invalidate_classifier_cache()
        
        # First call
        await classify_job_title(mock_db, "test title", use_cache=True)
        first_call_count = mock_db.job_keywords.find.call_count
        
        # Second call should use cache
        await classify_job_title(mock_db, "another title", use_cache=True)
        second_call_count = mock_db.job_keywords.find.call_count
        
        # Should not have made additional DB calls
        assert second_call_count == first_call_count


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
