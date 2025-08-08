#!/usr/bin/env python3
"""
Test runner script for TargetVision
"""

import sys
import subprocess
import argparse
from pathlib import Path

def run_command(cmd, description):
    """Run a command and handle errors"""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {' '.join(cmd)}")
    print(f"{'='*60}")
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    
    if result.returncode != 0:
        print(f"❌ {description} failed with return code {result.returncode}")
        return False
    else:
        print(f"✅ {description} completed successfully")
        return True

def main():
    parser = argparse.ArgumentParser(description="Run TargetVision tests")
    parser.add_argument("--unit", action="store_true", help="Run unit tests only")
    parser.add_argument("--integration", action="store_true", help="Run integration tests only")
    parser.add_argument("--api", action="store_true", help="Run API tests only")
    parser.add_argument("--ai", action="store_true", help="Run AI tests only")
    parser.add_argument("--database", action="store_true", help="Run database tests only")
    parser.add_argument("--slow", action="store_true", help="Include slow tests")
    parser.add_argument("--coverage", action="store_true", help="Run with coverage report")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    parser.add_argument("--file", type=str, help="Run specific test file")
    parser.add_argument("--function", type=str, help="Run specific test function")
    
    args = parser.parse_args()
    
    # Base pytest command
    cmd = ["python", "-m", "pytest"]
    
    # Add verbosity
    if args.verbose:
        cmd.extend(["-v", "-s"])
    
    # Add coverage if requested
    if args.coverage:
        cmd.extend([
            "--cov=backend",
            "--cov-report=html",
            "--cov-report=term-missing",
            "--cov-fail-under=80"
        ])
    
    # Add markers based on arguments
    markers = []
    if args.unit:
        markers.append("unit")
    if args.integration:
        markers.append("integration")
    if args.api:
        markers.append("api")
    if args.ai:
        markers.append("ai")
    if args.database:
        markers.append("database")
    
    if markers:
        marker_expr = " or ".join(markers)
        cmd.extend(["-m", marker_expr])
    
    # Exclude slow tests unless explicitly requested
    if not args.slow:
        if markers:
            cmd.extend(["--ignore-glob", "**/test_*slow*"])
        else:
            cmd.extend(["-m", "not slow"])
    
    # Run specific file or function
    if args.file:
        if args.function:
            cmd.append(f"{args.file}::{args.function}")
        else:
            cmd.append(args.file)
    elif args.function:
        cmd.extend(["-k", args.function])
    
    # Default to tests directory
    if not args.file:
        cmd.append("tests/")
    
    # Run the tests
    success = run_command(cmd, "pytest tests")
    
    if success:
        print(f"\n🎉 All tests completed successfully!")
        
        if args.coverage:
            print("\n📊 Coverage report generated in htmlcov/index.html")
            
    else:
        print(f"\n❌ Some tests failed!")
        sys.exit(1)

def install_test_dependencies():
    """Install test dependencies"""
    test_deps = [
        "pytest>=7.0.0",
        "pytest-asyncio>=0.21.0",
        "pytest-cov>=4.0.0",
        "pytest-mock>=3.10.0",
        "httpx>=0.25.0",  # For TestClient
        "faker>=18.0.0"   # For generating test data
    ]
    
    print("Installing test dependencies...")
    for dep in test_deps:
        cmd = [sys.executable, "-m", "pip", "install", dep]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ Installed {dep}")
        else:
            print(f"❌ Failed to install {dep}: {result.stderr}")

if __name__ == "__main__":
    # Check if running from correct directory
    if not Path("backend").exists() or not Path("tests").exists():
        print("❌ Please run from the targetvision project root directory")
        sys.exit(1)
    
    # Check if dependencies are installed
    try:
        import pytest
    except ImportError:
        print("Installing missing test dependencies...")
        install_test_dependencies()
    
    main()