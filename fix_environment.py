#!/usr/bin/env python3
"""
Fix environment issues for TargetVision testing
"""

import subprocess
import sys
import os

def check_typing_extensions():
    """Check and fix typing_extensions version conflict"""
    print("🔍 Checking typing_extensions...")
    
    try:
        import typing_extensions
        version = getattr(typing_extensions, '__version__', 'unknown')
        print(f"   Current version: {version}")
        
        # Check if TypeIs is available (required by torch)
        has_typeis = hasattr(typing_extensions, 'TypeIs')
        print(f"   Has TypeIs: {'✅' if has_typeis else '❌'}")
        
        if not has_typeis:
            print("   ⚠️ typing_extensions is too old for torch")
            return False
        else:
            print("   ✅ typing_extensions is compatible")
            return True
            
    except ImportError:
        print("   ❌ typing_extensions not found")
        return False

def fix_typing_extensions():
    """Upgrade typing_extensions to compatible version"""
    print("\n🔧 Fixing typing_extensions...")
    
    try:
        # Upgrade typing_extensions
        cmd = [sys.executable, '-m', 'pip', 'install', '--upgrade', 'typing_extensions>=4.6.0']
        print(f"Running: {' '.join(cmd)}")
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ typing_extensions upgraded successfully")
            return True
        else:
            print(f"❌ Failed to upgrade typing_extensions")
            print(f"STDOUT: {result.stdout}")
            print(f"STDERR: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Error upgrading typing_extensions: {e}")
        return False

def check_python_environment():
    """Check Python environment details"""
    print("🐍 Python Environment:")
    print(f"   Version: {sys.version}")
    print(f"   Executable: {sys.executable}")
    print(f"   Platform: {sys.platform}")
    
    # Check if using conda
    using_conda = 'conda' in sys.executable or 'miniconda' in sys.executable
    print(f"   Using conda: {'✅' if using_conda else '❌'}")
    
    # Check virtual environment
    venv_active = 'VIRTUAL_ENV' in os.environ
    conda_env = os.environ.get('CONDA_DEFAULT_ENV')
    print(f"   Virtual env: {'✅' if venv_active else '❌'}")
    print(f"   Conda env: {conda_env if conda_env else 'Not active'}")
    
    return True

def create_minimal_requirements():
    """Create a minimal requirements file for testing"""
    minimal_reqs = """# Minimal requirements for testing
pytest>=7.0.0
pytest-asyncio>=0.21.0
typing_extensions>=4.6.0
"""
    
    try:
        with open('requirements_test_minimal.txt', 'w') as f:
            f.write(minimal_reqs)
        print("✅ Created requirements_test_minimal.txt")
        return True
    except Exception as e:
        print(f"❌ Failed to create minimal requirements: {e}")
        return False

def main():
    print("🛠️ TargetVision Environment Fixer")
    print("="*50)
    
    # Check environment
    check_python_environment()
    
    # Check typing_extensions
    typing_ok = check_typing_extensions()
    
    if not typing_ok:
        print("\n🔧 Attempting to fix typing_extensions...")
        fixed = fix_typing_extensions()
        
        if fixed:
            print("✅ Environment fixed! Please restart your shell and try again.")
        else:
            print("❌ Could not fix automatically.")
            print("\n💡 Manual fix suggestion:")
            print("   pip install --upgrade typing_extensions>=4.6.0")
    else:
        print("✅ Environment looks good!")
    
    # Create minimal requirements
    create_minimal_requirements()
    
    print(f"\n📋 Next steps:")
    print("1. If typing_extensions was updated, restart your shell")
    print("2. Try running: python tests/test_bulletproof.py")
    print("3. Or use: python run_tests_fixed.py --working-only")

if __name__ == "__main__":
    main()