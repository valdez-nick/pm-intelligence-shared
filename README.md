# PM Intelligence Platform

Transform your product management workflow with AI-powered automation that acts as your intelligent PM co-pilot.

## 🔐 Security First

**Important**: This repository uses environment variables for sensitive configuration. Never commit credentials to the repository. 

- Copy `.env.example` files to `.env` for local configuration
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

### Conversational UI
- **Natural Language Interface**: ChatGPT-style UI for PM tasks
- **Context-Aware**: Maintains conversation context for complex workflows
- **Quick Actions**: Pre-built templates for common PM tasks
- **Real-time Updates**: WebSocket support for live notifications

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

### Prerequisites
- Python 3.8+
- Node.js 18+
- Neo4j (optional, for knowledge graph)
- API credentials for Jira/Confluence

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/pm-intelligence-platform.git
   cd pm-intelligence-platform
   ```

2. **Set up security**
   ```bash
   ./scripts/setup-security.sh
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Install the platform**
   ```bash
   cd intel-platform-feature-planning
   python -m venv venv
   source venv/bin/activate
   pip install -e ".[dev]"
   ```

5. **Start the conversational UI**
   ```bash
   cd ../conversational-ui
   ./start.sh
   ```

Visit http://localhost:3000 to start using the platform!

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