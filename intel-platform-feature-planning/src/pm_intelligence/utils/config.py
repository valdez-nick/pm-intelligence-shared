"""Configuration management with validation."""

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import BaseSettings, EmailStr, HttpUrl, SecretStr, validator
from pydantic.types import DirectoryPath


class Config(BaseSettings):
    """
    Centralized configuration with:
    - Environment variable support
    - Type validation
    - Default values
    - Secret masking
    """
    
    # Jira Configuration
    jira_url: HttpUrl
    jira_email: EmailStr
    jira_api_token: SecretStr
    
    # Confluence Configuration  
    confluence_url: HttpUrl
    confluence_email: EmailStr
    confluence_api_token: SecretStr
    
    # Slack Configuration (Optional for MVP)
    slack_bot_token: Optional[SecretStr] = None
    slack_app_token: Optional[SecretStr] = None
    
    # GitHub Configuration (Optional for MVP)
    github_token: Optional[SecretStr] = None
    github_org: Optional[str] = None
    
    # Assistant MCP Configuration
    assistant_mcp_url: HttpUrl = "http://localhost:3000"
    assistant_mcp_api_key: Optional[SecretStr] = None
    
    # Platform Configuration
    log_level: str = "INFO"
    db_path: Path = Path("./data/pm_intelligence.db")
    cache_ttl: int = 300
    max_concurrent_workflows: int = 50
    connection_pool_size: int = 20
    
    # Security Configuration
    enable_audit_logging: bool = True
    encryption_key: SecretStr
    
    # Performance Tuning
    batch_size: int = 50
    batch_wait_time: float = 0.5
    request_timeout: float = 30.0
    retry_max_attempts: int = 3
    retry_backoff_factor: float = 2.0
    
    # Development Settings
    debug: bool = False
    enable_profiling: bool = False
    
    @validator("db_path", pre=True)
    def ensure_db_directory(cls, v):
        """Ensure database directory exists."""
        path = Path(v)
        path.parent.mkdir(parents=True, exist_ok=True)
        return path
    
    @validator("log_level")
    def validate_log_level(cls, v):
        """Validate log level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Invalid log level. Must be one of: {valid_levels}")
        return v.upper()
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        env_prefix = "PM_INTEL_"
        case_sensitive = False
        
        # Custom field names for environment variables
        fields = {
            "jira_url": {"env": "JIRA_URL"},
            "jira_email": {"env": "JIRA_EMAIL"},
            "jira_api_token": {"env": "JIRA_API_TOKEN"},
            "confluence_url": {"env": "CONFLUENCE_URL"},
            "confluence_email": {"env": "CONFLUENCE_EMAIL"},
            "confluence_api_token": {"env": "CONFLUENCE_API_TOKEN"},
            "slack_bot_token": {"env": "SLACK_BOT_TOKEN"},
            "slack_app_token": {"env": "SLACK_APP_TOKEN"},
            "github_token": {"env": "GITHUB_TOKEN"},
            "github_org": {"env": "GITHUB_ORG"},
            "assistant_mcp_url": {"env": "ASSISTANT_MCP_URL"},
            "assistant_mcp_api_key": {"env": "ASSISTANT_MCP_API_KEY"},
        }


@lru_cache()
def get_config() -> Config:
    """Get cached configuration instance."""
    return Config()