#!/usr/bin/env node

/**
 * Configuration Migration Tool
 * Migrates legacy separate configurations to unified format
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ConfigMigrator {
  constructor() {
    this.unifiedConfig = {
      services: {
        assistantMcp: {
          name: 'assistant-mcp',
          version: '8.1.0',
          port: 3001,
          host: 'localhost',
          healthEndpoint: '/health'
        },
        platformCore: {
          name: 'platform-core',
          version: '1.0.0',
          port: 8000,
          host: 'localhost',
          healthEndpoint: '/health'
        },
        apiGateway: {
          name: 'api-gateway',
          version: '1.0.0',
          port: 9000,
          host: 'localhost',
          healthEndpoint: '/health'
        },
        webUI: {
          name: 'web-ui',
          version: '1.0.0',
          port: 3000,
          host: 'localhost',
          healthEndpoint: '/health'
        }
      },
      database: {
        type: 'sqlite',
        database: './data/pm_intelligence.db'
      },
      credentials: [],
      features: {
        auditLogging: false, // Disabled for development performance
        realTimeUpdates: true,
        caching: true,
        rateLimiting: true
      },
      integrations: {}
    };
  }

  async findConfigFiles() {
    const configFiles = {
      assistantMcp: null,
      platformCore: null,
      legacy: []
    };

    // Look for assistant-mcp configs
    const assistantPaths = [
      '../packages/assistant-mcp/.env.local',
      '../packages/assistant-mcp/.env',
      '../../assistant-mcp/.env.local',
      '../../assistant-mcp/.env'
    ];

    for (const configPath of assistantPaths) {
      const fullPath = path.resolve(__dirname, configPath);
      try {
        await fs.access(fullPath);
        configFiles.assistantMcp = fullPath;
        console.log(`Found assistant-mcp config: ${fullPath}`);
        break;
      } catch (error) {
        // File doesn't exist, continue
      }
    }

    // Look for platform-core configs
    const platformPaths = [
      '../packages/platform-core/.env.local',
      '../packages/platform-core/.env',
      '../intel-platform-feature-planning/.env.local',
      '../intel-platform-feature-planning/.env'
    ];

    for (const configPath of platformPaths) {
      const fullPath = path.resolve(__dirname, configPath);
      try {
        await fs.access(fullPath);
        configFiles.platformCore = fullPath;
        console.log(`Found platform-core config: ${fullPath}`);
        break;
      } catch (error) {
        // File doesn't exist, continue
      }
    }

    return configFiles;
  }

  async parseEnvFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const env = {};
      
      content.split('\\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
          }
        }
      });

      return env;
    } catch (error) {
      console.error(`Error parsing env file ${filePath}:`, error.message);
      return {};
    }
  }

  migrateAssistantConfig(env) {
    const migrated = {
      credentials: [],
      integrations: {}
    };

    // Vault configuration
    if (env.VAULT_PATH) {
      migrated.integrations.obsidian = {
        vaultPath: env.VAULT_PATH,
        enabled: true
      };
    }

    // Anthropic API Key
    if (env.ANTHROPIC_API_KEY) {
      migrated.credentials.push({
        service: 'anthropic',
        type: 'api_token',
        credentials: {
          api_key: env.ANTHROPIC_API_KEY
        }
      });
    }

    // Jira configuration (from assistant-mcp)
    if (env.JIRA_INSTANCE_URL && env.JIRA_API_TOKEN) {
      migrated.integrations.jira = {
        url: env.JIRA_INSTANCE_URL,
        enabled: true
      };

      migrated.credentials.push({
        service: 'jira',
        type: 'api_token',
        credentials: {
          url: env.JIRA_INSTANCE_URL,
          username: env.JIRA_USERNAME || '',
          token: env.JIRA_API_TOKEN
        }
      });
    }

    // Service configuration
    if (env.MCP_HTTP_PORT) {
      this.unifiedConfig.services.assistantMcp.port = parseInt(env.MCP_HTTP_PORT);
    }

    return migrated;
  }

  migratePlatformConfig(env) {
    const migrated = {
      credentials: [],
      integrations: {}
    };

    // Jira configuration (from platform)
    if (env.JIRA_URL && (env.JIRA_API_TOKEN || env.JIRA_TOKEN)) {
      migrated.integrations.jira = {
        url: env.JIRA_URL,
        enabled: true
      };

      migrated.credentials.push({
        service: 'jira',
        type: 'api_token',
        credentials: {
          url: env.JIRA_URL,
          email: env.JIRA_EMAIL || '',
          token: env.JIRA_API_TOKEN || env.JIRA_TOKEN
        }
      });
    }

    // Confluence configuration
    if (env.CONFLUENCE_URL && (env.CONFLUENCE_API_TOKEN || env.CONFLUENCE_TOKEN)) {
      migrated.integrations.confluence = {
        url: env.CONFLUENCE_URL,
        enabled: true
      };

      migrated.credentials.push({
        service: 'confluence',
        type: 'api_token',
        credentials: {
          url: env.CONFLUENCE_URL,
          email: env.CONFLUENCE_EMAIL || '',
          token: env.CONFLUENCE_API_TOKEN || env.CONFLUENCE_TOKEN
        }
      });
    }

    // Assistant MCP URL
    if (env.ASSISTANT_MCP_URL) {
      const url = new URL(env.ASSISTANT_MCP_URL);
      this.unifiedConfig.services.assistantMcp.host = url.hostname;
      this.unifiedConfig.services.assistantMcp.port = parseInt(url.port) || 3001;
    }

    // Database configuration
    if (env.DB_PATH || env.PM_INTEL_DB_PATH) {
      this.unifiedConfig.database.database = env.DB_PATH || env.PM_INTEL_DB_PATH;
    }

    // Feature flags
    if (env.ENABLE_AUDIT_LOGGING !== undefined) {
      this.unifiedConfig.features.auditLogging = env.ENABLE_AUDIT_LOGGING === 'true';
    }

    if (env.LOG_LEVEL || env.PM_INTEL_LOG_LEVEL) {
      this.unifiedConfig.features.logLevel = env.LOG_LEVEL || env.PM_INTEL_LOG_LEVEL;
    }

    return migrated;
  }

  consolidateCredentials(assistantCreds, platformCreds) {
    const credentialMap = new Map();

    // Add assistant credentials
    assistantCreds.forEach(cred => {
      credentialMap.set(cred.service, cred);
    });

    // Merge platform credentials (platform takes precedence for conflicts)
    platformCreds.forEach(cred => {
      if (credentialMap.has(cred.service)) {
        // Merge credentials, preferring platform values
        const existing = credentialMap.get(cred.service);
        const merged = {
          ...existing,
          credentials: {
            ...existing.credentials,
            ...cred.credentials
          }
        };
        credentialMap.set(cred.service, merged);
      } else {
        credentialMap.set(cred.service, cred);
      }
    });

    return Array.from(credentialMap.values());
  }

  consolidateIntegrations(assistantIntegrations, platformIntegrations) {
    return {
      ...assistantIntegrations,
      ...platformIntegrations // Platform takes precedence
    };
  }

  async writeUnifiedConfig(outputPath) {
    const configJson = JSON.stringify(this.unifiedConfig, null, 2);
    await fs.writeFile(outputPath, configJson, 'utf-8');
    console.log(`Unified configuration written to: ${outputPath}`);
  }

  async writeEnvFile(outputPath) {
    const lines = [
      '# Unified PM Intelligence Platform Configuration',
      '# Generated by migration tool',
      '',
      '# Service Ports',
      `ASSISTANT_MCP_PORT=${this.unifiedConfig.services.assistantMcp.port}`,
      `PLATFORM_CORE_PORT=${this.unifiedConfig.services.platformCore.port}`,
      `API_GATEWAY_PORT=${this.unifiedConfig.services.apiGateway.port}`,
      `WEB_UI_PORT=${this.unifiedConfig.services.webUI.port}`,
      '',
      '# Database',
      `DATABASE_PATH=${this.unifiedConfig.database.database}`,
      '',
      '# Features',
      `ENABLE_AUDIT_LOGGING=${this.unifiedConfig.features.auditLogging}`,
      `ENABLE_REAL_TIME_UPDATES=${this.unifiedConfig.features.realTimeUpdates}`,
      `ENABLE_CACHING=${this.unifiedConfig.features.caching}`,
      `ENABLE_RATE_LIMITING=${this.unifiedConfig.features.rateLimiting}`,
      ''
    ];

    // Add integration configurations
    Object.entries(this.unifiedConfig.integrations).forEach(([name, config]) => {
      lines.push(`# ${name.toUpperCase()} Integration`);
      if (config.url) {
        lines.push(`${name.toUpperCase()}_URL=${config.url}`);
      }
      if (config.vaultPath) {
        lines.push(`VAULT_PATH=${config.vaultPath}`);
      }
      lines.push(`${name.toUpperCase()}_ENABLED=${config.enabled}`);
      lines.push('');
    });

    // Add credentials (values will be masked for security)
    this.unifiedConfig.credentials.forEach(cred => {
      lines.push(`# ${cred.service.toUpperCase()} Credentials`);
      Object.entries(cred.credentials).forEach(([key, value]) => {
        const envKey = `${cred.service.toUpperCase()}_${key.toUpperCase()}`;
        // Mask sensitive values in the generated file
        const maskedValue = key.toLowerCase().includes('token') || key.toLowerCase().includes('key') || key.toLowerCase().includes('password')
          ? 'YOUR_' + key.toUpperCase() + '_HERE'
          : value;
        lines.push(`${envKey}=${maskedValue}`);
      });
      lines.push('');
    });

    const envContent = lines.join('\\n');
    await fs.writeFile(outputPath, envContent, 'utf-8');
    console.log(`Environment template written to: ${outputPath}`);
  }

  async generateDocumentation(outputPath) {
    const docs = [
      '# Configuration Migration Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Services Configured',
      '',
      Object.entries(this.unifiedConfig.services).map(([name, config]) => 
        `- **${config.name}**: http://${config.host}:${config.port}`
      ).join('\\n'),
      '',
      '## Integrations',
      '',
      Object.entries(this.unifiedConfig.integrations).map(([name, config]) => 
        `- **${name}**: ${config.enabled ? 'Enabled' : 'Disabled'}${config.url ? ` (${config.url})` : ''}`
      ).join('\\n'),
      '',
      '## Credentials Configured',
      '',
      this.unifiedConfig.credentials.map(cred => 
        `- **${cred.service}**: ${cred.type} authentication`
      ).join('\\n'),
      '',
      '## Next Steps',
      '',
      '1. Review the generated `.env.local` file and update placeholder values',
      '2. Copy sensitive credentials from your original configuration files',
      '3. Test the unified configuration with `npm run health`',
      '4. Update your deployment scripts to use the unified configuration',
      '',
      '## Migration Notes',
      '',
      '- Original configuration files were preserved',
      '- Unified configuration prioritizes platform-core values for conflicts',
      '- Audit logging is disabled by default for development performance',
      '- All credentials require manual verification and update'
    ];

    await fs.writeFile(outputPath, docs.join('\\n'), 'utf-8');
    console.log(`Migration documentation written to: ${outputPath}`);
  }
}

async function main() {
  console.log('🔄 Starting configuration migration...');
  
  const migrator = new ConfigMigrator();
  
  try {
    // Find existing configuration files
    const configFiles = await migrator.findConfigFiles();
    
    if (!configFiles.assistantMcp && !configFiles.platformCore) {
      console.log('⚠️  No configuration files found. Creating default configuration...');
    }

    // Parse existing configurations
    let assistantEnv = {};
    let platformEnv = {};

    if (configFiles.assistantMcp) {
      console.log('📖 Reading assistant-mcp configuration...');
      assistantEnv = await migrator.parseEnvFile(configFiles.assistantMcp);
    }

    if (configFiles.platformCore) {
      console.log('📖 Reading platform-core configuration...');
      platformEnv = await migrator.parseEnvFile(configFiles.platformCore);
    }

    // Migrate configurations
    console.log('🔀 Migrating configurations...');
    const assistantMigrated = migrator.migrateAssistantConfig(assistantEnv);
    const platformMigrated = migrator.migratePlatformConfig(platformEnv);

    // Consolidate
    migrator.unifiedConfig.credentials = migrator.consolidateCredentials(
      assistantMigrated.credentials,
      platformMigrated.credentials
    );

    migrator.unifiedConfig.integrations = migrator.consolidateIntegrations(
      assistantMigrated.integrations,
      platformMigrated.integrations
    );

    // Create output directory
    const outputDir = path.resolve(__dirname, '../config');
    await fs.mkdir(outputDir, { recursive: true });

    // Write outputs
    console.log('💾 Writing unified configuration files...');
    
    await migrator.writeUnifiedConfig(path.join(outputDir, 'unified-config.json'));
    await migrator.writeEnvFile(path.join(outputDir, '.env.local.template'));
    await migrator.generateDocumentation(path.join(outputDir, 'MIGRATION_REPORT.md'));

    // Copy to root for immediate use
    await migrator.writeEnvFile(path.resolve(__dirname, '../.env.local.template'));

    console.log('✅ Configuration migration completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Review config/unified-config.json');
    console.log('2. Copy .env.local.template to .env.local and update credentials');
    console.log('3. Test with: npm run health');
    console.log('');
    console.log('📖 See config/MIGRATION_REPORT.md for detailed information');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${__filename}`) {
  main().catch(console.error);
}

export default ConfigMigrator;