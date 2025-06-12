"""Configuration management with validation."""

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import EmailStr, Field, HttpUrl, SecretStr, field_validator
from pydantic.types import DirectoryPath
from pydantic_settings import BaseSettings


class Config(BaseSettings):
    """
    Centralized configuration with:
    - Environment variable support
    - Type validation
    - Default values
    - Secret masking
    """

    # Jira Configuration
    jira_url: HttpUrl = Field(alias="JIRA_URL")
    jira_email: EmailStr = Field(alias="JIRA_EMAIL")
    jira_api_token: SecretStr = Field(alias="JIRA_API_TOKEN")

    # Confluence Configuration
    confluence_url: HttpUrl = Field(alias="CONFLUENCE_URL")
    confluence_email: EmailStr = Field(alias="CONFLUENCE_EMAIL")
    confluence_api_token: SecretStr = Field(alias="CONFLUENCE_API_TOKEN")

    # Slack Configuration (Optional for MVP)
    slack_bot_token: Optional[SecretStr] = Field(default=None, alias="SLACK_BOT_TOKEN")
    slack_app_token: Optional[SecretStr] = Field(default=None, alias="SLACK_APP_TOKEN")

    # GitHub Configuration (Optional for MVP)
    github_token: Optional[SecretStr] = Field(default=None, alias="GITHUB_TOKEN")
    github_org: Optional[str] = Field(default=None, alias="GITHUB_ORG")

    # Assistant MCP Configuration
    assistant_mcp_url: HttpUrl = Field(
        default="http://localhost:3000", alias="ASSISTANT_MCP_URL"
    )
    assistant_mcp_api_key: Optional[SecretStr] = Field(
        default=None, alias="ASSISTANT_MCP_API_KEY"
    )

    # Platform Configuration
    log_level: str = "INFO"
    db_path: Path = Path("./data/pm_intelligence.db")
    cache_ttl: int = 300
    max_concurrent_workflows: int = 50
    connection_pool_size: int = 20

    # Security Configuration
    enable_audit_logging: bool = True
    encryption_key: SecretStr = Field(
        default="change-me-in-production", alias="PM_INTEL_ENCRYPTION_KEY"
    )

    # Performance Tuning
    batch_size: int = 50
    batch_wait_time: float = 0.5
    request_timeout: float = 30.0
    retry_max_attempts: int = 3
    retry_backoff_factor: float = 2.0

    # Development Settings
    debug: bool = False
    enable_profiling: bool = False

    @field_validator("db_path", mode="before")
    @classmethod
    def ensure_db_directory(cls, v):
        """Ensure database directory exists."""
        path = Path(v)
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v):
        """Validate log level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Invalid log level. Must be one of: {valid_levels}")
        return v.upper()

    model_config = {
        "env_file": [".env.local", ".env"],
        "env_file_encoding": "utf-8",
        "env_prefix": "",
        "case_sensitive": False,
        "extra": "ignore",
    }


@lru_cache()
def get_config() -> Config:
    """Get cached configuration instance."""
    return Config()
