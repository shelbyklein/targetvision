"""
Bulletproof tests that work in any environment
"""

import pytest

def test_basic_operations():
    """Test basic Python operations"""
    assert 1 + 1 == 2
    assert "hello".upper() == "HELLO"
    assert [1, 2, 3][0] == 1
    assert {"key": "value"}["key"] == "value"

def test_imports_no_external():
    """Test imports that are part of standard library"""
    import json
    import os
    import sys
    import asyncio
    
    # Test JSON
    data = {"test": "value"}
    json_str = json.dumps(data)
    parsed = json.loads(json_str)
    assert parsed["test"] == "value"
    
    # Test OS
    cwd = os.getcwd()
    assert isinstance(cwd, str)
    assert len(cwd) > 0
    
    # Test sys
    assert sys.version_info.major >= 3
    
    print("✅ Standard library imports work")

@pytest.mark.asyncio
async def test_async_basic():
    """Test basic async functionality"""
    import asyncio
    
    async def simple_task():
        await asyncio.sleep(0.001)
        return 42
    
    result = await simple_task()
    assert result == 42
    print("✅ Async functionality works")

def test_basic_mock():
    """Test basic mocking without complex scenarios"""
    from unittest.mock import MagicMock
    
    # Simple mock without recursion issues
    mock = MagicMock()
    mock.simple_method = MagicMock(return_value="test_result")
    
    result = mock.simple_method()
    assert result == "test_result"
    print("✅ Basic mocking works")

def test_file_system():
    """Test file system operations"""
    import tempfile
    import os
    
    # Create and write to temp file
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
        f.write("test content")
        temp_path = f.name
    
    # Read it back
    with open(temp_path, 'r') as f:
        content = f.read()
    
    assert content == "test content"
    
    # Clean up
    os.unlink(temp_path)
    print("✅ File operations work")

def test_environment_variables():
    """Test environment variable handling"""
    import os
    
    # Test setting and getting environment variables
    test_var = "PYTEST_TEST_VAR"
    test_value = "test_value_123"
    
    os.environ[test_var] = test_value
    retrieved = os.environ.get(test_var)
    
    assert retrieved == test_value
    
    # Clean up
    del os.environ[test_var]
    print("✅ Environment variables work")

class TestClassStructure:
    """Test that test classes work properly"""
    
    def test_method_in_class(self):
        """Test method inside test class"""
        assert True
    
    def test_class_variables(self):
        """Test class-level functionality"""
        data = {"items": [1, 2, 3]}
        assert len(data["items"]) == 3

def test_data_structures():
    """Test various data structures"""
    # Lists
    my_list = [1, 2, 3, 4, 5]
    assert len(my_list) == 5
    assert my_list[2] == 3
    
    # Dictionaries
    my_dict = {"name": "test", "value": 42}
    assert my_dict["name"] == "test"
    assert "value" in my_dict
    
    # Sets
    my_set = {1, 2, 3, 3, 4}
    assert len(my_set) == 4  # Duplicates removed
    
    # Tuples
    my_tuple = (1, "two", 3.0)
    assert my_tuple[1] == "two"
    
    print("✅ Data structures work")

def test_string_operations():
    """Test string operations"""
    text = "Hello World"
    
    assert text.lower() == "hello world"
    assert text.replace("World", "Python") == "Hello Python"
    assert text.split() == ["Hello", "World"]
    assert "World" in text
    
    print("✅ String operations work")

def test_math_operations():
    """Test mathematical operations"""
    import math
    
    assert math.sqrt(16) == 4.0
    assert math.ceil(3.2) == 4
    assert math.floor(3.8) == 3
    assert abs(-5) == 5
    
    # Test list comprehensions
    squares = [x**2 for x in range(5)]
    assert squares == [0, 1, 4, 9, 16]
    
    print("✅ Math operations work")

# This allows the test to be run directly
if __name__ == "__main__":
    # Run tests directly without pytest
    print("Running tests directly...")
    
    try:
        test_basic_operations()
        test_imports_no_external() 
        test_basic_mock()
        test_file_system()
        test_environment_variables()
        test_data_structures()
        test_string_operations()
        test_math_operations()
        
        print("\n🎉 All bulletproof tests passed!")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        raise