"""
Simple tests to verify test infrastructure works
"""

import pytest
import sys
import os

def test_basic_math():
    """Test that basic Python functionality works"""
    assert 1 + 1 == 2
    assert 2 * 3 == 6

def test_imports_work():
    """Test that we can import basic Python modules"""
    try:
        import json
        import asyncio
        from unittest.mock import MagicMock
        assert json is not None
        assert asyncio is not None
        assert MagicMock is not None
        print("✅ Basic imports successful")
    except ImportError as e:
        pytest.fail(f"Failed to import basic modules: {e}")

@pytest.mark.asyncio
async def test_async_functionality():
    """Test async functionality works in tests"""
    import asyncio
    
    async def async_add(a, b):
        await asyncio.sleep(0.01)  # Simulate async work
        return a + b
    
    result = await async_add(5, 3)
    assert result == 8

def test_mock_functionality():
    """Test that mocking works"""
    from unittest.mock import MagicMock
    
    mock_obj = MagicMock()
    mock_obj.test_method.return_value = "mocked_result"
    
    assert mock_obj.test_method() == "mocked_result"
    mock_obj.test_method.assert_called_once()

class TestBasicFunctionality:
    """Test class structure works"""
    
    def test_class_method(self):
        """Test method in test class"""
        assert True
    
    def test_fixtures(self):
        """Test that pytest fixtures would work"""
        # This would use fixtures in a real test
        assert 2 + 2 == 4

def test_environment_variables():
    """Test environment variable handling"""
    import os
    from dotenv import load_dotenv
    
    # Load .env file
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print("✅ Environment file loaded")
    
    # Check if we have some expected variables
    api_key_exists = bool(os.getenv('ANTHROPIC_API_KEY'))
    smugmug_key_exists = bool(os.getenv('SMUGMUG_API_KEY'))
    
    print(f"ANTHROPIC_API_KEY configured: {api_key_exists}")
    print(f"SMUGMUG_API_KEY configured: {smugmug_key_exists}")
    
    # Test passes regardless of whether keys are set
    assert True

if __name__ == "__main__":
    pytest.main([__file__, "-v"])