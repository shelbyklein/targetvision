#!/usr/bin/env python3
"""
Simple test runner for TargetVision tests
"""

import sys
import subprocess
import argparse

def run_tests(test_args=None):
    """Run tests with basic pytest"""
    
    cmd = ["python", "-m", "pytest", "-v"]
    
    if test_args:
        cmd.extend(test_args)
    else:
        # Default to simple tests
        cmd.extend(["tests/test_simple.py", "tests/test_ai_basic.py"])
    
    print("="*60)
    print(f"Running: {' '.join(cmd)}")
    print("="*60)
    
    result = subprocess.run(cmd)
    
    if result.returncode == 0:
        print("\n🎉 All tests passed!")
        return True
    else:
        print(f"\n❌ Some tests failed (exit code: {result.returncode})")
        return False

def main():
    parser = argparse.ArgumentParser(description="Simple test runner for TargetVision")
    parser.add_argument("--all", action="store_true", help="Run all basic tests")
    parser.add_argument("--simple", action="store_true", help="Run only simple tests")
    parser.add_argument("--ai", action="store_true", help="Run AI tests")
    parser.add_argument("--file", type=str, help="Run specific test file")
    
    args = parser.parse_args()
    
    if args.simple:
        success = run_tests(["tests/test_simple.py"])
    elif args.ai:
        success = run_tests(["tests/test_ai_basic.py"])  
    elif args.file:
        success = run_tests([args.file])
    elif args.all:
        success = run_tests(["tests/test_simple.py", "tests/test_ai_basic.py"])
    else:
        # Default: run both simple and AI tests
        print("Running default test suite (simple + AI basic tests)")
        success = run_tests()
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()