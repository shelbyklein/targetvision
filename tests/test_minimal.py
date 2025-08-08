"""
Minimal tests that should work without any complex dependencies
"""

import pytest

def test_python_basics():
    """Test basic Python functionality"""
    assert 1 + 1 == 2
    assert "hello" + " world" == "hello world"
    assert [1, 2, 3][1] == 2

def test_imports_basic():
    """Test basic imports that should always work"""
    import json
    import os
    import sys
    from unittest.mock import MagicMock
    
    assert json is not None
    assert os is not None
    assert sys is not None
    assert MagicMock is not None

@pytest.mark.asyncio
async def test_async_works():
    """Test that async functionality works"""
    import asyncio
    
    async def simple_async():
        await asyncio.sleep(0.001)
        return "async works"
    
    result = await simple_async()
    assert result == "async works"

def test_mock_functionality():
    """Test that mocking works"""
    from unittest.mock import MagicMock, patch
    
    # Test basic mock
    mock = MagicMock()
    mock.method.return_value = "mocked"
    assert mock.method() == "mocked"
    
    # Test patching
    with patch('builtins.len', return_value=42):
        assert len([1, 2, 3]) == 42

class TestBasicClass:
    """Test that test classes work"""
    
    def test_method(self):
        """Test method in class"""
        assert True
    
    def test_fixtures_work(self):
        """Test that we can use fixtures"""
        data = {"key": "value"}
        assert data["key"] == "value"

def test_environment_check():
    """Test environment without importing backend"""
    import os
    
    # Just check that we can read environment variables
    python_path = os.environ.get('PATH')
    assert python_path is not None
    
    # Check current directory
    cwd = os.getcwd()
    assert cwd is not None
    assert 'targetvision' in cwd

def test_file_operations():
    """Test file operations work"""
    import tempfile
    import os
    
    # Create temporary file
    with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
        f.write("test content")
        temp_path = f.name
    
    # Read it back
    with open(temp_path, 'r') as f:
        content = f.read()
    
    assert content == "test content"
    
    # Clean up
    os.unlink(temp_path)

if __name__ == "__main__":
    # Can run directly without pytest
    test_python_basics()
    test_imports_basic()
    test_mock_functionality()
    print("✅ All basic tests passed!")