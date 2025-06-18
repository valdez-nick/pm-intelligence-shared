# PM Intelligence Platform

Transform your product management workflow with AI-powered automation that acts as your intelligent PM co-pilot.

## 🚀 **New Collaborator? Start Here!**

**Get up and running in 5 minutes:**

```bash
git clone [repository-url]
cd pm-intelligence-platform
./setup-new-collaborator.sh --demo    # For quick demo
# OR
./setup-new-collaborator.sh           # For full setup
```

Then visit **http://localhost:3000** to start using the platform!

📖 **Detailed Setup Guide**: [COLLABORATOR_SETUP.md](COLLABORATOR_SETUP.md)

## 🔐 Security First

**Important**: This repository uses environment variables for sensitive configuration. Never commit credentials to the repository. 

- Copy `.env.example` to `.env` for local configuration
- See [SECURITY.md](SECURITY.md) for security best practices
- Run `./scripts/setup-security.sh` to set up pre-commit hooks

## 🎯 Vision

Build the industry's first truly intelligent PM automation platform that understands context, learns from patterns, and proactively handles routine tasks - allowing PMs to focus on strategy and innovation.

## 🚀 Features

### Core Platform
- **Workflow Automation**: DAG-based workflow engine with parallel execution
- **MCP Integration**: Connects to Jira, Confluence, GitHub, and more
- **AI-Powered Analysis**: Integrated with assistant-mcp for intelligent insights
- **Security & Compliance**: Built-in credential management and audit logging
- **Offline LLM Operation**: Run all AI features locally with Ollama - no internet required!

### Conversational UI
- **Natural Language Interface**: ChatGPT-style UI for PM tasks
- **Context-Aware**: Maintains conversation context for complex workflows
- **Quick Actions**: Pre-built templates for common PM tasks
- **Real-time Updates**: WebSocket support for live notifications

### 🆕 Ollama Integration (January 2025)
- **Complete Offline Operation**: Run all LLM features without internet connectivity
- **Data Privacy**: All AI processing happens locally on your machine
- **Cost Savings**: Zero API costs for LLM operations
- **Model Flexibility**: Use any Ollama-compatible model (Llama 2, Mistral, CodeLlama, etc.)
- **Easy Configuration**: Simply set `PM_INTEL_LLM_OFFLINE_MODE=true`
- See [docs/OLLAMA_INTEGRATION.md](intel-platform-feature-planning/docs/OLLAMA_INTEGRATION.md) for setup guide

## 📁 Repository Structure

```
pm-intelligence-platform/
├── intel-platform-feature-planning/    # Core platform implementation
│   ├── src/pm_intelligence/           # Main Python package
│   ├── tests/                         # Test suites
│   └── docs/                          # Documentation
├── conversational-ui/                 # ChatGPT-style interface
│   ├── backend/                       # FastAPI server
│   └── frontend/                      # React application
├── scripts/                           # Utility scripts
└── docs/                              # Product documentation
```

## 🚀 Quick Start

### Automated Setup (Recommended)

**For new collaborators:**
```bash
./setup-new-collaborator.sh --demo    # 5-minute demo setup
./setup-new-collaborator.sh           # Full production setup
```

**Start the platform:**
```bash
./start-pm-platform.sh                # Starts all services
```

Visit **http://localhost:3000** to start using the platform!

### Manual Setup (Advanced Users)

If you prefer manual control or the automated setup fails:

**Prerequisites:**
- Python 3.8+
- Node.js 18+
- Git
- API credentials (Anthropic/OpenAI for AI, Jira/Confluence for integrations)

**Steps:**
1. Clone repository
2. Copy `.env.example` to `.env` and configure
3. Install Python platform: `cd intel-platform-feature-planning && pip install -e ".[dev]"`
4. Install frontend: `cd conversational-ui/frontend && npm install`
5. Start services: `./start-pm-platform.sh`

📖 **Detailed Instructions**: [COLLABORATOR_SETUP.md](COLLABORATOR_SETUP.md)

## 📚 Documentation

- [QUICKSTART_CONVERSATIONAL_UI.md](QUICKSTART_CONVERSATIONAL_UI.md) - 5-minute setup guide
- [SECURITY.md](SECURITY.md) - Security best practices
- [intel-platform-feature-planning/README.md](intel-platform-feature-planning/README.md) - Core platform docs
- [conversational-ui/README.md](conversational-ui/README.md) - UI documentation

## 🔒 Security

This platform handles sensitive PM data. We take security seriously:

- All credentials stored in environment variables
- Pre-commit hooks scan for exposed secrets
- Audit logging for compliance
- Encrypted credential storage
- Regular security updates

See [SECURITY.md](SECURITY.md) for detailed security practices.

## 🤝 Contributing

We welcome contributions! Please:

1. Run security setup: `./scripts/setup-security.sh`
2. Never commit credentials
3. Use `.env.example` files for configuration templates
4. Follow the security practices in [SECURITY.md](SECURITY.md)

## 📄 License

[Your License Here]

---

Built with ❤️ for Product Managers who deserve better tools.