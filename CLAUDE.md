# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Recent Major Changes

### RAG and Vector Database Integration (January 2025)
- **New Capability**: Agents now have access to historical knowledge through RAG (Retrieval-Augmented Generation)
- **Key Components**:
  - `VectorStoreManager`: ChromaDB integration for vector storage
  - `DocumentProcessor`: Intelligent chunking and metadata extraction
  - `RAGPipeline`: Orchestrates retrieval and generation
  - `KnowledgeIndexer`: Automated indexing of Jira, Confluence, and platform data
  - `AgentRAGIntegration`: Seamless integration with agent tool execution
- **Benefits**: Context-aware decisions, knowledge preservation, continuous learning
- **Documentation**: See `examples/rag_demo.py` for usage examples

### Agent Tool Execution (January 2025)
- **New Capability**: Agents can now dynamically analyze natural language queries and execute MCP tools
- **Key Components**:
  - `AgentToolExecutor`: Bridges agents and MCP adapters
  - Enhanced `Agent` model with `analyze_and_execute_tools()` method
  - `AgentConversationManager`: Orchestrates agent-based conversations
  - New API endpoints in `/conversations/chat/agent`
- **Benefits**: Natural language interface, persona-driven tool selection, dynamic execution
- **Documentation**: See `docs/AGENT_TOOL_EXECUTION_ARCHITECTURE.md`

## Commands

### Platform Startup (All Services)
```bash
# Start all services with one command
./start-pm-platform.sh           # Starts Assistant-MCP, Backend API, Frontend UI

# Individual service management
./start-pm-platform.sh start     # Start all services
./start-pm-platform.sh stop      # Stop all services  
./start-pm-platform.sh status    # Check service status
./start-pm-platform.sh logs      # Monitor logs

# Comprehensive testing
./test/run-tests.sh              # Full test suite (Python + TypeScript)
./test/run-tests.sh --skip-install  # Skip dependency installation
```

### Core Platform (Python)
```bash
# Setup and installation
cd intel-platform-feature-planning
python -m venv venv
source venv/bin/activate
pip install -e ".[dev]"

# CLI operations  
pm-intel init                    # Interactive setup wizard
pm-intel validate               # Test configuration and connectivity
pm-intel workflow list          # Show available workflows
pm-intel workflow run <name>    # Execute specific workflow
pm-intel serve                  # Start FastAPI server (port 8000)
pm-intel health                 # System health check

# Testing
pytest                          # All tests
pytest tests/unit              # Unit tests only
pytest tests/integration       # Integration tests
pytest tests/e2e               # End-to-end tests
pytest --cov=pm_intelligence   # With coverage report
pytest -xvs tests/unit/test_workflow_engine.py  # Single test verbose

# Code quality
black src tests && isort src tests && flake8 src tests && mypy src
```

### Conversational UI (React)
```bash
cd conversational-ui/frontend
npm install                     # Install dependencies
npm run dev                     # Development server (port 3000)
npm run build                   # Production build
npm run test                    # Vitest tests
npm run test:coverage          # Test coverage
npm run lint                   # ESLint
```

## Architecture

### High-Level System Design
Multi-service PM automation platform with AI-powered workflow orchestration:

```
Frontend (React/Vite) → Backend (FastAPI) → MCP Orchestrator → External Services
                                           ↓                    ↘
                                   State Manager            Assistant-MCP (AI)
                                           ↓
                                      SQLite DB
```

### Core Components Architecture

**Workflow Engine** (`intel-platform-feature-planning/src/pm_intelligence/core/workflow_engine.py`)
- DAG-based execution with parallel processing
- Checkpointing and failure recovery
- Event-driven state transitions

**MCP Orchestrator** (`intel-platform-feature-planning/src/pm_intelligence/core/mcp_orchestrator.py`)  
- Connection pooling with circuit breakers
- Rate limiting (100 req/min) and retry logic
- Manages Jira, Confluence, Assistant adapters

**Multi-Agent System** (`intel-platform-feature-planning/src/pm_intelligence/agents/`)
- Factory pattern for agent creation
- Collaborative patterns for complex workflows
- Learning capabilities with adaptive behavior

**Security Layer** (`intel-platform-feature-planning/src/pm_intelligence/security/`)
- AES-256-GCM encryption for credentials
- Comprehensive audit logging
- Input validation and sanitization

### Frontend Architecture
- React + TypeScript with Vite build system
- Tailwind CSS + Radix UI components  
- WebSocket integration for real-time updates
- React Query for API state management

## Development Patterns

### Test-Driven Development (Required)
All new features must follow TDD:
1. **Red**: Write failing test first in `tests/dev/` during development
2. **Green**: Implement minimal code to pass
3. **Refactor**: Move stable tests to `tests/unit/` or `tests/integration/`
4. **Document**: Add comments for landmark code changes

### Security-First Development
- Use `secure_credential_manager` for all sensitive data
- Enable audit logging: `ENABLE_AUDIT_LOGGING=true`
- Validate all inputs with Pydantic models
- Never commit credentials (pre-commit hooks prevent this)

### Async Patterns (Python)
- Use `async with` for all external service calls
- Leverage `asyncio.gather()` for parallel operations
- Implement proper cancellation handling
- Connection pooling: 10 connections default

### Component Patterns (React)
- Feature-based organization: `agents/`, `collaboration/`, `ui/`
- Custom hooks for API interactions (`useChat`, `useWebSocket`)
- Consistent error boundaries and loading states
- TypeScript interfaces in `types/` directory

## Configuration

### Environment Setup Priority
1. `.env.local` (preferred for development)
2. `.env` (fallback)
3. System environment variables

### Required Configuration
```bash
# .env.local
JIRA_URL=https://domain.atlassian.net
JIRA_EMAIL=your_email@company.com  
JIRA_API_TOKEN=your_token

CONFLUENCE_URL=https://domain.atlassian.net/wiki
CONFLUENCE_EMAIL=your_email@company.com
CONFLUENCE_API_TOKEN=your_token

ASSISTANT_MCP_URL=http://localhost:3001  # For AI features
LOG_LEVEL=INFO
DB_PATH=./data/pm_intelligence.db
```

## Project Structure Understanding

### Multi-Service Repository
```
pm-intelligence-platform/
├── intel-platform-feature-planning/    # Core Python platform
│   ├── src/pm_intelligence/           # Main package
│   │   ├── adapters/                  # External service integrations
│   │   ├── agents/                    # Multi-agent system
│   │   ├── api/                       # FastAPI routes
│   │   ├── core/                      # Workflow engine, orchestrator
│   │   └── workflows/                 # Business logic
│   └── tests/                         # Comprehensive test suites
├── conversational-ui/                 # React frontend
│   ├── frontend/src/                  # React components, hooks
│   └── backend/                       # FastAPI bridge (if needed)
├── shared/                            # Common types and utilities
└── scripts/                           # Deployment and setup scripts
```

### Key Integration Points
- **MCP Protocol**: External service communication standard
- **WebSocket**: Real-time updates between frontend/backend
- **Event Bus**: Internal async message passing
- **State Manager**: Workflow persistence and recovery

## Common Troubleshooting

### Service Connectivity Issues
```bash
# Check all service health
./start-pm-platform.sh status

# Validate configuration
cd intel-platform-feature-planning && pm-intel validate

# Test specific connections
curl http://localhost:3001/health  # Assistant-MCP
curl http://localhost:8000/health  # Backend API
curl http://localhost:3000         # Frontend
```

### Test Failures
```bash
# Run with detailed output
pytest -xvs --tb=short

# Check async configuration
pytest --asyncio-mode=auto tests/e2e/

# Isolated environment testing
python -m pytest tests/unit/ --no-cov
```

### Build Issues
```bash
# Clean Python environment
rm -rf venv && python -m venv venv && source venv/bin/activate
pip install -e ".[dev]"

# Clean Node environment  
cd conversational-ui/frontend && rm -rf node_modules && npm install
```

# Development Memory (Previous Context)

## Development Workflow & Testing

## Development Workflow & Testing
- Always run comprehensive test suites before major changes: `pytest tests/` (unit), `python execute_e2e_tests.py` (e2e)
- Validate API endpoints with both success and error scenarios before deployment
- Use deterministic LLM providers in tests to ensure reproducible results
- Execute contract tests before integrating new adapters or external services
- Ensure test coverage includes edge cases, security scenarios, and error handling
- Run UI tests with `npm test` in conversational-ui/frontend/ for frontend changes

## Architecture & Code Organization
- This is a multi-agent PM intelligence platform with modular architecture (agents/, api/, ai/, workflows/)
- Maintain strict separation between core logic, API routes, and UI components
- Use factory patterns for agent creation and adapter patterns for external integrations
- Keep security-related code in dedicated security/ modules with proper credential management
- Follow the established directory structure: core business logic in src/pm_intelligence/
- UI components should be organized by feature (agents/, collaboration/, ui/)

## Testing Strategy & TDD
- Follow TDD approach with comprehensive test coverage across all layers
- Test hierarchy: unit tests → integration tests → e2e tests → contract tests
- Mock external services (Jira, Confluence, Assistant) using fixtures in tests/fixtures/
- Use pytest with proper conftest.py setup for test organization and shared fixtures
- Validate both happy path and error scenarios for all API endpoints
- Create test data generators for complex scenarios (see tests/e2e/test_data_generator.py)
- Use contract testing to ensure adapter compatibility with external APIs

## Security & Compliance
- Never commit credentials - use secure_credential_manager for sensitive data
- Implement audit logging for all security-sensitive operations (see security/audit_logger.py)
- Validate all inputs and sanitize outputs to prevent injection attacks
- Keep security scanner active for agent uploads and external content processing
- Encrypt sensitive configuration data (see credentials.enc pattern)
- Follow principle of least privilege for API access and data handling

## Performance & Reliability
- Use caching mechanisms for expensive operations (AI model calls, external API requests)
- Implement proper error handling with retry logic for external services
- Monitor resource usage, especially for LLM operations and batch processing
- Use websocket connections efficiently for real-time collaboration features
- Implement proper connection pooling for database and external API connections
- Use async/await patterns for I/O bound operations

## API Development Patterns
- Structure API routes in dedicated modules within routes/ directory
- Use consistent error response formats across all endpoints
- Implement proper validation using Pydantic models for request/response schemas
- Support both simple and MCP-enhanced conversation flows
- Implement proper HTTP status codes and error handling
- Use dependency injection for shared services and adapters
- Document API endpoints with proper OpenAPI/Swagger specifications

## AI & LLM Integration
- Use model_manager.py for centralized LLM provider management
- Implement hot-swapping capabilities for different AI models
- Use adaptive intent classification for better user experience
- Implement proper response enhancement pipelines with transformers
- Cache LLM responses where appropriate to reduce costs and latency
- Use deterministic testing providers for consistent test results

## Collaboration & Multi-Agent Systems
- Implement proper agent orchestration using the collaboration/ module patterns
- Use event-driven architecture for agent communication
- Implement conflict resolution strategies for concurrent agent operations
- Support real-time collaboration through websocket connections
- Maintain agent state consistency across distributed operations

## Database & State Management
- Use SQLite for development with proper migration strategies
- Implement proper state management patterns (see core/state_manager.py)
- Use connection pooling and proper transaction management
- Implement data backup and recovery procedures
- Keep database schemas versioned and migration-ready

## Configuration & Environment Management
- Use environment-specific configuration files
- Implement feature flags for gradual rollouts (see core/feature_flags.py)
- Support dynamic configuration updates without service restart
- Maintain separate configurations for development, testing, and production
- Use secure credential management for sensitive configuration values

## Deployment & Operations
- Ensure Docker compatibility with proper multi-stage builds
- Implement health checks for all critical services
- Use proper logging levels and structured logging
- Implement monitoring and alerting for critical system components
- Support graceful shutdown and service restart procedures
- Maintain deployment scripts and documentation

## Code Quality & Standards
- Follow established Python coding standards (PEP 8)
- Use type hints throughout the codebase for better maintainability
- Implement proper error handling with custom exception classes
- Use consistent naming conventions across modules and functions
- Add comprehensive docstrings for complex functions and classes
- Use linting tools and pre-commit hooks for code quality

## Documentation & Knowledge Management
- Keep technical design documents updated in docs/ directory
- Maintain API documentation with examples and usage patterns
- Document architectural decisions and rationale
- Keep README files updated with setup and usage instructions
- Document troubleshooting procedures and common issues
- Maintain changelog for significant changes and releases

## Development Practices
- utilize subagents whenever possible