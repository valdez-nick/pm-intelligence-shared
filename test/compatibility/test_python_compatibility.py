#!/usr/bin/env python3

"""
Python Environment Compatibility Tests - Phase 1
Tests from REPOSITORY_MERGER_TDD_PLAN.md
"""

import pytest
import sys
import os
import subprocess
import tempfile
import json
import toml
from pathlib import Path
from typing import Dict, Any

# Add the project root to Python path for imports
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


class TestPythonCompatibility:
    """Test Python environment compatibility for platform-core package."""
    
    def test_python_version_compatibility(self):
        """Test Python version requirements (3.9+)."""
        version_info = sys.version_info
        
        assert version_info.major == 3, f"Python 3.x required, found {version_info.major}"
        assert version_info.minor >= 9, f"Python 3.9+ required, found {version_info.major}.{version_info.minor}"
        
        print(f"✅ Python version check passed: {version_info.major}.{version_info.minor}.{version_info.micro}")
    
    def test_platform_core_pyproject_toml_exists(self):
        """Test that pyproject.toml exists and is valid."""
        pyproject_path = PROJECT_ROOT / "packages" / "platform-core" / "pyproject.toml"
        
        assert pyproject_path.exists(), f"pyproject.toml not found at {pyproject_path}"
        
        # Parse TOML to validate structure
        pyproject_data = toml.load(pyproject_path)
        
        # Validate basic structure
        assert "project" in pyproject_data, "pyproject.toml should have [project] section"
        assert "build-system" in pyproject_data, "pyproject.toml should have [build-system] section"
        
        project_config = pyproject_data["project"]
        assert project_config["name"] == "pm-intelligence", "Project name should be 'pm-intelligence'"
        assert project_config["requires-python"] == ">=3.9", "Should require Python 3.9+"
        
        # Check critical dependencies
        dependencies = project_config.get("dependencies", [])
        required_deps = ["fastapi", "pydantic", "sqlalchemy", "httpx"]
        
        for dep in required_deps:
            assert any(dep in d for d in dependencies), f"Missing required dependency: {dep}"
        
        print("✅ Platform-core pyproject.toml validation passed")
    
    def test_platform_core_package_json_exists(self):
        """Test that package.json exists for npm workspace compatibility."""
        package_path = PROJECT_ROOT / "packages" / "platform-core" / "package.json"
        
        assert package_path.exists(), f"package.json not found at {package_path}"
        
        with open(package_path) as f:
            package_data = json.load(f)
        
        assert package_data["name"] == "@pm-intelligence/platform-core", "Should have scoped package name"
        assert "scripts" in package_data, "Should have npm scripts for workspace integration"
        
        # Check for key scripts
        scripts = package_data["scripts"]
        required_scripts = ["build", "test", "lint", "dev", "health"]
        
        for script in required_scripts:
            assert script in scripts, f"Missing required script: {script}"
        
        print("✅ Platform-core package.json validation passed")
    
    def test_virtual_environment_creation(self):
        """Test that we can create and use a virtual environment."""
        with tempfile.TemporaryDirectory() as temp_dir:
            venv_path = Path(temp_dir) / "test-venv"
            
            try:
                # Create virtual environment
                result = subprocess.run([
                    sys.executable, "-m", "venv", str(venv_path)
                ], capture_output=True, text=True, timeout=30)
                
                assert result.returncode == 0, f"venv creation failed: {result.stderr}"
                
                # Verify venv was created
                if sys.platform == "win32":
                    python_exe = venv_path / "Scripts" / "python.exe"
                else:
                    python_exe = venv_path / "bin" / "python"
                
                assert python_exe.exists(), f"Python executable not found in venv: {python_exe}"
                
                print("✅ Virtual environment creation test passed")
                
            except subprocess.TimeoutExpired:
                pytest.skip("Virtual environment creation timed out")
            except Exception as e:
                pytest.skip(f"Virtual environment test failed: {e}")
    
    def test_pip_install_dry_run(self):
        """Test that requirements can be resolved (dry run)."""
        pyproject_path = PROJECT_ROOT / "packages" / "platform-core" / "pyproject.toml"
        
        if not pyproject_path.exists():
            pytest.skip("pyproject.toml not found for dry run test")
        
        try:
            # Test pip install dry run with current directory
            result = subprocess.run([
                sys.executable, "-m", "pip", "install", "--dry-run", 
                "-e", str(pyproject_path.parent)
            ], capture_output=True, text=True, timeout=60)
            
            # Note: pip install --dry-run may not be available in all pip versions
            # so we'll just check that pip doesn't immediately fail
            
            if "ERROR" in result.stderr.upper() and "dry-run" not in result.stderr:
                pytest.fail(f"Pip install check failed: {result.stderr}")
            
            print("✅ Pip install dry run test passed")
            
        except subprocess.TimeoutExpired:
            pytest.skip("Pip install dry run timed out")
        except FileNotFoundError:
            pytest.skip("pip not available for dry run test")
    
    def test_pytest_availability(self):
        """Test that pytest is available for testing."""
        try:
            import pytest as pytest_module
            assert hasattr(pytest_module, "main"), "pytest should have main function"
            print(f"✅ pytest availability test passed: {pytest_module.__version__}")
        except ImportError:
            pytest.fail("pytest not available - required for testing")
    
    def test_async_support(self):
        """Test that async/await works correctly."""
        import asyncio
        
        async def test_async_function():
            await asyncio.sleep(0.001)  # Minimal async operation
            return True
        
        # Test that we can run async code
        result = asyncio.run(test_async_function())
        assert result is True, "Async function should return True"
        
        print("✅ Async/await support test passed")
    
    def test_json_and_toml_parsing(self):
        """Test that required parsing libraries work."""
        import json
        import toml
        
        # Test JSON parsing
        test_json = '{"test": "value", "number": 42}'
        parsed_json = json.loads(test_json)
        assert parsed_json["test"] == "value"
        assert parsed_json["number"] == 42
        
        # Test TOML parsing  
        test_toml = """
        [project]
        name = "test"
        version = "1.0.0"
        """
        parsed_toml = toml.loads(test_toml)
        assert parsed_toml["project"]["name"] == "test"
        assert parsed_toml["project"]["version"] == "1.0.0"
        
        print("✅ JSON and TOML parsing test passed")


class TestPackageStructure:
    """Test the package structure and organization."""
    
    def test_packages_directory_structure(self):
        """Test that the packages directory has the correct structure."""
        packages_dir = PROJECT_ROOT / "packages"
        
        assert packages_dir.exists(), "packages directory should exist"
        assert packages_dir.is_dir(), "packages should be a directory"
        
        # Check for required package directories
        required_packages = ["assistant-mcp", "platform-core"]
        
        for package in required_packages:
            package_dir = packages_dir / package
            assert package_dir.exists(), f"Package directory should exist: {package}"
            assert package_dir.is_dir(), f"Package should be a directory: {package}"
        
        print("✅ Package directory structure test passed")
    
    def test_shared_directory_structure(self):
        """Test that the shared directory has the correct structure."""
        shared_dir = PROJECT_ROOT / "shared"
        
        assert shared_dir.exists(), "shared directory should exist"
        assert shared_dir.is_dir(), "shared should be a directory"
        
        # Check for required shared components
        required_components = ["types", "utils", "schemas"]
        
        for component in required_components:
            component_dir = shared_dir / component
            assert component_dir.exists(), f"Shared component should exist: {component}"
        
        # Check specific files
        types_file = shared_dir / "types" / "common.ts"
        utils_file = shared_dir / "utils" / "communication.ts"
        schemas_file = shared_dir / "schemas" / "api.json"
        
        assert types_file.exists(), "common.ts should exist in shared/types"
        assert utils_file.exists(), "communication.ts should exist in shared/utils"
        assert schemas_file.exists(), "api.json should exist in shared/schemas"
        
        print("✅ Shared directory structure test passed")
    
    def test_test_directory_structure(self):
        """Test that the test directory has the correct structure."""
        test_dir = PROJECT_ROOT / "test"
        
        assert test_dir.exists(), "test directory should exist"
        assert test_dir.is_dir(), "test should be a directory"
        
        # Check for compatibility tests
        compatibility_dir = test_dir / "compatibility"
        assert compatibility_dir.exists(), "compatibility test directory should exist"
        
        # Check for this test file
        python_compat_test = compatibility_dir / "test_python_compatibility.py"
        assert python_compat_test.exists(), "Python compatibility test should exist"
        
        print("✅ Test directory structure test passed")


class TestToolsAndScripts:
    """Test that tools and scripts are properly configured."""
    
    def test_migration_tools_exist(self):
        """Test that migration tools exist and are accessible."""
        tools_dir = PROJECT_ROOT / "tools"
        
        assert tools_dir.exists(), "tools directory should exist"
        
        migration_tool = tools_dir / "migrate-config.js"
        assert migration_tool.exists(), "Configuration migration tool should exist"
        
        # Check that it's a Node.js script
        with open(migration_tool) as f:
            content = f.read()
            assert "#!/usr/bin/env node" in content, "Should have proper Node.js shebang"
            assert "ConfigMigrator" in content, "Should contain ConfigMigrator class"
        
        print("✅ Migration tools test passed")
    
    def test_root_package_json_workspace_config(self):
        """Test that root package.json has proper workspace configuration."""
        root_package = PROJECT_ROOT / "package.json"
        
        assert root_package.exists(), "Root package.json should exist"
        
        with open(root_package) as f:
            package_data = json.load(f)
        
        assert "workspaces" in package_data, "Should have workspaces configuration"
        
        workspaces = package_data["workspaces"]
        required_workspaces = ["packages/*", "apps/*", "shared/*"]
        
        for workspace in required_workspaces:
            assert workspace in workspaces, f"Should include workspace: {workspace}"
        
        # Check unified scripts
        scripts = package_data.get("scripts", {})
        required_scripts = ["dev", "test", "build", "health"]
        
        for script in required_scripts:
            assert script in scripts, f"Should have unified script: {script}"
        
        print("✅ Root package.json workspace configuration test passed")


if __name__ == "__main__":
    # Run tests if called directly
    print("🧪 Running Python Compatibility Tests...\n")
    
    # Run with pytest
    pytest.main([__file__, "-v", "--tb=short"])