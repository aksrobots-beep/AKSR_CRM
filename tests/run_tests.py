#!/usr/bin/env python
"""
AK Success CRM - Selenium Test Runner

This script runs the full test suite for the CRM application.
Make sure the frontend (http://localhost:5173) and backend (http://localhost:3001) are running.

Usage:
    python run_tests.py          # Run all tests
    python run_tests.py -v       # Verbose output
    python run_tests.py -k auth  # Run only auth tests
"""

import subprocess
import sys
import os

def main():
    # Change to tests directory
    tests_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(tests_dir)
    
    print("=" * 60)
    print("AK Success CRM - Selenium Test Suite")
    print("=" * 60)
    print()
    print("Prerequisites:")
    print("  - Frontend running at http://localhost:5173")
    print("  - Backend running at http://localhost:3001")
    print("  - Chrome browser installed")
    print()
    print("Starting tests...")
    print("-" * 60)
    
    # Build pytest command
    cmd = [sys.executable, "-m", "pytest"]
    cmd.extend(sys.argv[1:])  # Pass through any CLI arguments
    
    # Add default options if none provided
    if len(sys.argv) == 1:
        cmd.extend(["-v", "--tb=short"])
    
    # Run tests
    result = subprocess.run(cmd)
    
    print("-" * 60)
    if result.returncode == 0:
        print("✅ All tests passed!")
    else:
        print(f"❌ Tests failed with exit code {result.returncode}")
    
    return result.returncode

if __name__ == "__main__":
    sys.exit(main())
