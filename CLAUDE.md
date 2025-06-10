# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development Setup
```bash
# Setup development environment
cd intel-platform-feature-planning
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -e ".[dev]"
```

### Testing
```bash
# Run all tests with coverage
pytest

# Run specific test types
pytest tests/unit/
pytest tests/integration/
pytest tests/e2e/

# Run single test file
pytest -xvs tests/unit/test_workflow_engine.py

# Run with coverage report
pytest --cov=pm_intelligence --cov-report=html
```

### Code Quality
```bash
# Format code
black src tests

# Sort imports
isort src tests

# Lint code
flake8 src tests

# Type checking
mypy src
```

### Platform Commands
```bash
# Initialize platform configuration
pm-intel init

# Validate setup and credentials
pm-intel validate

# List available workflows
pm-intel workflow list

# Run specific workflows
pm-intel workflow run meeting-intelligence --input transcript="..." --input project_key="PROJ"
pm-intel workflow run sprint-planning --input board_id="123"

# Check platform health
pm-intel health
```

## Architecture

The PM Intelligence Platform is an async Python application that orchestrates MCP (Model Context Protocol) servers for Product Management automation.

### Core Components

- **Workflow Engine** (`src/pm_intelligence/core/workflow_engine.py`): Executes workflows as DAGs with parallel execution and checkpointing
- **MCP Orchestrator** (`src/pm_intelligence/core/mcp_orchestrator.py`): Manages connections to external services with circuit breakers and connection pooling
- **State Manager** (`src/pm_intelligence/core/state_manager.py`): Persists workflow state using SQLite with event sourcing
- **Event Bus** (`src/pm_intelligence/core/event_bus.py`): Handles async messaging with back-pressure

### MCP Adapters

All adapters inherit from `base_adapter.py` and provide standardized interfaces to external services:
- **Jira Adapter**: Full CRUD operations, JQL queries, batch processing
- **Confluence Adapter**: Page management, space operations, CQL search
- **Assistant Adapter**: AI-powered analysis and content generation

### Security Layer

- **Credential Manager**: Secure storage with memory clearing and future keyring integration
- **Audit Logger**: PII masking, tamper-proof event chains, comprehensive audit trails

### Workflows

All workflows extend `BaseWorkflow` and implement:
- Input validation
- Async execution with context management
- Error handling and state persistence

Current workflows:
- **Meeting Intelligence**: Converts meeting transcripts to Jira tickets and documentation
- **Sprint Planning**: Optimizes sprint composition based on velocity and capacity
- **Stakeholder Communications**: Generates personalized updates for different audiences
- **PRD Generator**: Creates comprehensive Product Requirements Documents

## Development Patterns

### Async-First Design
All operations use `async/await` for maximum concurrency. Connection pooling and circuit breakers prevent resource exhaustion.

### Resource Management
- Connection pools (default: 10 connections)
- Rate limiting (100 requests/minute)
- Concurrency control (50 workers max)
- Multi-level caching (in-memory, Redis, SQLite)

### Error Handling
Circuit breaker pattern prevents cascade failures. All workflows support checkpointing and resume.

## Key Files for Common Tasks

### Adding a New Workflow
1. Create workflow class in `src/pm_intelligence/workflows/`
2. Register in `AVAILABLE_WORKFLOWS` dict in `src/pm_intelligence/cli/main.py:711`
3. Add tests in `tests/unit/`

### Adding a New MCP Adapter
1. Inherit from `src/pm_intelligence/adapters/base_adapter.py`
2. Implement required abstract methods
3. Add to orchestrator configuration

### Modifying Security Features
- Credential types: `src/pm_intelligence/security/credential_manager.py`
- Audit events: `src/pm_intelligence/security/audit_logger.py`

## Testing Requirements

- Minimum 80% code coverage (enforced by pytest.ini)
- All async code tested with pytest-asyncio
- Integration tests use service mocks
- Security tests validate credential handling

## Configuration

Environment variables are managed in `.env` files:
- `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
- `CONFLUENCE_URL`, `CONFLUENCE_EMAIL`, `CONFLUENCE_API_TOKEN`
- `PM_INTEL_LOG_LEVEL`, `PM_INTEL_DB_PATH`

## Project Structure

The main implementation is in `intel-platform-feature-planning/src/pm_intelligence/` with the following structure:
- `adapters/` - MCP service integrations
- `ai/` - AI-powered components
- `cli/` - Command-line interface
- `conversation/` - Context and session management
- `core/` - Core platform services
- `security/` - Security and audit features
- `utils/` - Shared utilities
- `workflows/` - PM automation workflows