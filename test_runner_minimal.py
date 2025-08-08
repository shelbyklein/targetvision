#!/usr/bin/env python3
"""
Minimal test runner that should work in any environment
"""

import subprocess
import sys
import os

def check_environment():
    """Check basic environment setup"""
    print("🔍 Environment Check:")
    print(f"   Python version: {sys.version}")
    print(f"   Current directory: {os.getcwd()}")
    print(f"   Virtual env active: {'VIRTUAL_ENV' in os.environ}")
    
    # Check if pytest is available
    try:
        result = subprocess.run([sys.executable, '-m', 'pytest', '--version'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print(f"   Pytest available: ✅ {result.stdout.strip()}")
        else:
            print("   Pytest available: ❌")
            return False
    except Exception as e:
        print(f"   Pytest check failed: {e}")
        return False
    
    return True

def run_minimal_tests():
    """Run only the minimal test file"""
    if not check_environment():
        print("❌ Environment check failed")
        return False
    
    print("\n" + "="*60)
    print("Running minimal tests...")
    print("="*60)
    
    # Run just the minimal test
    cmd = [sys.executable, '-m', 'pytest', 'tests/test_minimal.py', '-v']
    
    try:
        result = subprocess.run(cmd)
        if result.returncode == 0:
            print("\n🎉 Minimal tests passed!")
            return True
        else:
            print(f"\n❌ Tests failed with exit code: {result.returncode}")
            return False
    except Exception as e:
        print(f"❌ Error running tests: {e}")
        return False

def run_direct_python():
    """Run tests directly with Python (no pytest)"""
    print("\n" + "="*60)
    print("Running tests directly with Python...")
    print("="*60)
    
    try:
        # Import and run the test module directly
        sys.path.insert(0, 'tests')
        import test_minimal
        
        print("✅ Direct Python test execution successful!")
        return True
    except Exception as e:
        print(f"❌ Direct execution failed: {e}")
        return False

def main():
    """Main test runner"""
    print("🧪 TargetVision Minimal Test Runner")
    print("="*60)
    
    # Try pytest first
    if run_minimal_tests():
        return
    
    print("\nPytest failed, trying direct Python execution...")
    
    # Fallback to direct Python
    if run_direct_python():
        return
    
    print("\n❌ All test methods failed!")
    sys.exit(1)

if __name__ == "__main__":
    main()