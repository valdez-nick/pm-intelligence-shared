"""
Assistant MCP Server Manager
Handles automatic startup and management of the assistant-mcp server
"""

import asyncio
import os
import signal
import subprocess
import time
from pathlib import Path
from typing import Optional

import httpx


class AssistantMCPManager:
    """Manages the assistant-mcp server lifecycle"""

    def __init__(self, assistant_mcp_path: Optional[str] = None, port: int = 3001):
        self.port = port
        self.base_url = f"http://localhost:{port}"
        self.process: Optional[subprocess.Popen] = None

        # Try to find assistant-mcp path
        if assistant_mcp_path:
            self.assistant_mcp_path = Path(assistant_mcp_path)
        else:
            # Try common locations
            possible_paths = [
                Path.home() / "Documents" / "repos" / "assistant-mcp",
                Path.home() / "assistant-mcp",
                Path.cwd().parent / "assistant-mcp",
                Path(
                    "/Users/nvaldez/Documents/repos/assistant-mcp"
                ),  # Your specific path
            ]

            for path in possible_paths:
                if path.exists() and (path / "package.json").exists():
                    self.assistant_mcp_path = path
                    break
            else:
                self.assistant_mcp_path = None

    async def is_server_running(self) -> bool:
        """Check if the assistant-mcp server is already running"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/health", timeout=2.0)
                return response.status_code == 200
        except:
            return False

    async def start_server(self) -> bool:
        """Start the assistant-mcp server if not already running"""
        # Check if already running
        if await self.is_server_running():
            print(f"✅ Assistant-MCP server already running on port {self.port}")
            return True

        if not self.assistant_mcp_path or not self.assistant_mcp_path.exists():
            print(
                f"❌ Could not find assistant-mcp directory. Please set ASSISTANT_MCP_PATH environment variable."
            )
            return False

        print(f"🚀 Starting assistant-mcp server from {self.assistant_mcp_path}...")

        try:
            # Start the server process
            env = os.environ.copy()
            env["PORT"] = str(self.port)

            self.process = subprocess.Popen(
                ["npm", "run", "start:api"],
                cwd=str(self.assistant_mcp_path),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid if os.name != "nt" else None,
            )

            # Wait for server to be ready
            max_attempts = 30
            for attempt in range(max_attempts):
                await asyncio.sleep(1)
                if await self.is_server_running():
                    print(
                        f"✅ Assistant-MCP server started successfully on port {self.port}"
                    )
                    return True

                # Check if process died
                if self.process.poll() is not None:
                    stdout, stderr = self.process.communicate()
                    print(f"❌ Server failed to start:")
                    if stderr:
                        print(f"   Error: {stderr.decode()}")
                    return False

                if attempt % 5 == 0:
                    print(
                        f"   Waiting for server to start... ({attempt}/{max_attempts})"
                    )

            print(f"❌ Server failed to start within {max_attempts} seconds")
            self.stop_server()
            return False

        except Exception as e:
            print(f"❌ Error starting server: {e}")
            return False

    def stop_server(self):
        """Stop the assistant-mcp server if we started it"""
        if self.process:
            try:
                if os.name == "nt":
                    self.process.terminate()
                else:
                    os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
                self.process.wait(timeout=5)
                print("🛑 Assistant-MCP server stopped")
            except:
                if self.process:
                    self.process.kill()
            finally:
                self.process = None

    async def ensure_server_running(self) -> bool:
        """Ensure the server is running, starting it if necessary"""
        if await self.is_server_running():
            return True
        return await self.start_server()

    def __enter__(self):
        """Context manager entry"""
        asyncio.run(self.ensure_server_running())
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - we don't stop the server automatically"""
        # Note: We don't stop the server here because other processes might be using it
        pass

    async def __aenter__(self):
        """Async context manager entry"""
        await self.ensure_server_running()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        # Note: We don't stop the server here because other processes might be using it
        pass


# Singleton instance
_manager_instance: Optional[AssistantMCPManager] = None


def get_assistant_mcp_manager() -> AssistantMCPManager:
    """Get or create the singleton manager instance"""
    global _manager_instance
    if _manager_instance is None:
        assistant_path = os.getenv("ASSISTANT_MCP_PATH")
        _manager_instance = AssistantMCPManager(assistant_path)
    return _manager_instance
