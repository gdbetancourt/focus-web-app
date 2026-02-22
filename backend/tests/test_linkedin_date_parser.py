"""
Test suite for LinkedIn date parser (connected_on field)

Tests the robust date parser that handles:
- Spanish and English month names
- Case-insensitive matching
- Various separators (space, dash, slash)
- Invalid date validation
"""
import pytest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from linkedin_import_worker import parse_linkedin_date


class TestLinkedInDateParser:
    """Tests for parse_linkedin_date function"""
    
    # ===========================================
    # Test Case 1: Basic Spanish format
    # ===========================================
    def test_spanish_month_feb(self):
        """09 feb 2026 → 2026-02-09"""
        result = parse_linkedin_date("09 feb 2026")
        assert result == "2026-02-09"
    
    # ===========================================
    # Test Case 2: Spanish December with capital
    # ===========================================
    def test_spanish_month_dic_capital(self):
        """02 Dic 2025 → 2025-12-02"""
        result = parse_linkedin_date("02 Dic 2025")
        assert result == "2025-12-02"
    
    # ===========================================
    # Test Case 3: English December with capital
    # ===========================================
    def test_english_month_dec_capital(self):
        """02 Dec 2025 → 2025-12-02"""
        result = parse_linkedin_date("02 Dec 2025")
        assert result == "2025-12-02"
    
    # ===========================================
    # Test Case 4: Case variations
    # ===========================================
    def test_lowercase_dic(self):
        """dic (lowercase Spanish December)"""
        result = parse_linkedin_date("15 dic 2024")
        assert result == "2024-12-15"
    
    def test_uppercase_DEC(self):
        """DEC (uppercase English December)"""
        result = parse_linkedin_date("15 DEC 2024")
        assert result == "2024-12-15"
    
    def test_mixed_case_DiC(self):
        """DiC (mixed case)"""
        result = parse_linkedin_date("15 DiC 2024")
        assert result == "2024-12-15"
    
    def test_uppercase_FEB(self):
        """FEB (uppercase)"""
        result = parse_linkedin_date("01 FEB 2025")
        assert result == "2025-02-01"
    
    # ===========================================
    # Test Case 5: Invalid dates (must not break import)
    # ===========================================
    def test_invalid_day_32(self):
        """32 feb 2026 - invalid day should return None"""
        result = parse_linkedin_date("32 feb 2026")
        assert result is None
    
    def test_invalid_feb_30(self):
        """30 feb 2026 - February never has 30 days"""
        result = parse_linkedin_date("30 feb 2026")
        assert result is None
    
    def test_invalid_feb_29_non_leap(self):
        """29 feb 2025 - 2025 is not a leap year"""
        result = parse_linkedin_date("29 feb 2025")
        assert result is None
    
    def test_valid_feb_29_leap_year(self):
        """29 feb 2024 - 2024 IS a leap year"""
        result = parse_linkedin_date("29 feb 2024")
        assert result == "2024-02-29"
    
    def test_invalid_month_13(self):
        """Invalid month name"""
        result = parse_linkedin_date("15 xyz 2024")
        assert result is None
    
    def test_invalid_format_missing_year(self):
        """Missing year"""
        result = parse_linkedin_date("15 feb")
        assert result is None
    
    def test_empty_string(self):
        """Empty string"""
        result = parse_linkedin_date("")
        assert result is None
    
    def test_none_input(self):
        """None input"""
        result = parse_linkedin_date(None)
        assert result is None
    
    # ===========================================
    # Test all Spanish months
    # ===========================================
    def test_spanish_enero(self):
        result = parse_linkedin_date("01 ene 2024")
        assert result == "2024-01-01"
    
    def test_spanish_febrero(self):
        result = parse_linkedin_date("01 feb 2024")
        assert result == "2024-02-01"
    
    def test_spanish_marzo(self):
        result = parse_linkedin_date("01 mar 2024")
        assert result == "2024-03-01"
    
    def test_spanish_abril(self):
        result = parse_linkedin_date("01 abr 2024")
        assert result == "2024-04-01"
    
    def test_spanish_mayo(self):
        result = parse_linkedin_date("01 may 2024")
        assert result == "2024-05-01"
    
    def test_spanish_junio(self):
        result = parse_linkedin_date("01 jun 2024")
        assert result == "2024-06-01"
    
    def test_spanish_julio(self):
        result = parse_linkedin_date("01 jul 2024")
        assert result == "2024-07-01"
    
    def test_spanish_agosto(self):
        result = parse_linkedin_date("01 ago 2024")
        assert result == "2024-08-01"
    
    def test_spanish_septiembre(self):
        result = parse_linkedin_date("01 sep 2024")
        assert result == "2024-09-01"
    
    def test_spanish_octubre(self):
        result = parse_linkedin_date("01 oct 2024")
        assert result == "2024-10-01"
    
    def test_spanish_noviembre(self):
        result = parse_linkedin_date("01 nov 2024")
        assert result == "2024-11-01"
    
    def test_spanish_diciembre(self):
        result = parse_linkedin_date("01 dic 2024")
        assert result == "2024-12-01"
    
    # ===========================================
    # Test all English months
    # ===========================================
    def test_english_january(self):
        result = parse_linkedin_date("01 jan 2024")
        assert result == "2024-01-01"
    
    def test_english_february(self):
        result = parse_linkedin_date("01 feb 2024")
        assert result == "2024-02-01"
    
    def test_english_march(self):
        result = parse_linkedin_date("01 mar 2024")
        assert result == "2024-03-01"
    
    def test_english_april(self):
        result = parse_linkedin_date("01 apr 2024")
        assert result == "2024-04-01"
    
    def test_english_may(self):
        result = parse_linkedin_date("01 may 2024")
        assert result == "2024-05-01"
    
    def test_english_june(self):
        result = parse_linkedin_date("01 jun 2024")
        assert result == "2024-06-01"
    
    def test_english_july(self):
        result = parse_linkedin_date("01 jul 2024")
        assert result == "2024-07-01"
    
    def test_english_august(self):
        result = parse_linkedin_date("01 aug 2024")
        assert result == "2024-08-01"
    
    def test_english_september(self):
        result = parse_linkedin_date("01 sep 2024")
        assert result == "2024-09-01"
    
    def test_english_october(self):
        result = parse_linkedin_date("01 oct 2024")
        assert result == "2024-10-01"
    
    def test_english_november(self):
        result = parse_linkedin_date("01 nov 2024")
        assert result == "2024-11-01"
    
    def test_english_december(self):
        result = parse_linkedin_date("01 dec 2024")
        assert result == "2024-12-01"
    
    # ===========================================
    # Test alternative separators
    # ===========================================
    def test_dash_separator(self):
        """09-feb-2026 with dashes"""
        result = parse_linkedin_date("09-feb-2026")
        assert result == "2026-02-09"
    
    def test_slash_separator(self):
        """09/feb/2026 with slashes"""
        result = parse_linkedin_date("09/feb/2026")
        assert result == "2026-02-09"
    
    def test_dot_separator(self):
        """09.feb.2026 with dots"""
        result = parse_linkedin_date("09.feb.2026")
        assert result == "2026-02-09"
    
    def test_mixed_separators(self):
        """09-feb/2026 with mixed separators"""
        result = parse_linkedin_date("09-feb/2026")
        assert result == "2026-02-09"
    
    # ===========================================
    # Test whitespace handling
    # ===========================================
    def test_extra_leading_space(self):
        result = parse_linkedin_date("  09 feb 2026")
        assert result == "2026-02-09"
    
    def test_extra_trailing_space(self):
        result = parse_linkedin_date("09 feb 2026  ")
        assert result == "2026-02-09"
    
    def test_extra_middle_spaces(self):
        result = parse_linkedin_date("09  feb  2026")
        assert result == "2026-02-09"
    
    # ===========================================
    # Test full month names (Spanish)
    # ===========================================
    def test_full_spanish_enero(self):
        result = parse_linkedin_date("01 enero 2024")
        assert result == "2024-01-01"
    
    def test_full_spanish_diciembre(self):
        result = parse_linkedin_date("25 diciembre 2024")
        assert result == "2024-12-25"
    
    # ===========================================
    # Edge cases for month boundaries
    # ===========================================
    def test_april_30_valid(self):
        """April has 30 days"""
        result = parse_linkedin_date("30 apr 2024")
        assert result == "2024-04-30"
    
    def test_april_31_invalid(self):
        """April does NOT have 31 days"""
        result = parse_linkedin_date("31 apr 2024")
        assert result is None
    
    def test_june_30_valid(self):
        """June has 30 days"""
        result = parse_linkedin_date("30 jun 2024")
        assert result == "2024-06-30"
    
    def test_june_31_invalid(self):
        """June does NOT have 31 days"""
        result = parse_linkedin_date("31 jun 2024")
        assert result is None


class TestDateParserIntegration:
    """Integration tests - verify parser works in context"""
    
    def test_real_linkedin_export_samples(self):
        """Test with real samples from LinkedIn exports"""
        samples = [
            ("09 feb 2026", "2026-02-09"),
            ("02 Dic 2025", "2025-12-02"),
            ("02 Dec 2025", "2025-12-02"),
            ("15 ago 2024", "2024-08-15"),
            ("01 ene 2023", "2023-01-01"),
            ("28 Feb 2024", "2024-02-28"),
        ]
        
        for input_val, expected in samples:
            result = parse_linkedin_date(input_val)
            assert result == expected, f"Failed for input '{input_val}': got {result}, expected {expected}"
    
    def test_parser_never_raises_exception(self):
        """Parser should NEVER raise an exception, only return None"""
        bad_inputs = [
            None,
            "",
            "   ",
            "invalid",
            "32 feb 2026",
            "abc def ghi",
            "2024-02-15",  # Wrong format (ISO)
            "15/02/2024",  # Wrong format (numeric month)
            12345,  # Integer (should handle gracefully)
            ["list"],  # List
        ]
        
        for bad_input in bad_inputs:
            try:
                result = parse_linkedin_date(bad_input)
                # Should return None, not raise exception
                assert result is None or isinstance(result, str)
            except Exception as e:
                pytest.fail(f"Parser raised exception for input {bad_input}: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
