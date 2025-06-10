#!/usr/bin/env node

/**
 * Repository Compatibility Tests - Phase 1
 * Tests from REPOSITORY_MERGER_TDD_PLAN.md
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { spawn, exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

describe('Repository Compatibility Validation', () => {
  describe('Node.js Environment', () => {
    test('assistant-mcp package.json compatibility', async () => {
      const packagePath = path.resolve(__dirname, '../../packages/assistant-mcp/package.json');
      
      try {
        await access(packagePath);
        const packageContent = await readFile(packagePath, 'utf-8');
        const packageJson = JSON.parse(packageContent);
        
        // Verify Node.js version compatibility
        assert.ok(packageJson.engines?.node, 'Node.js engine version should be specified');
        assert.match(packageJson.engines.node, />=18\.0\.0/, 'Should require Node.js 18+');
        
        // Check critical dependencies
        assert.ok(packageJson.dependencies, 'Dependencies should be defined');
        assert.ok(packageJson.dependencies['@modelcontextprotocol/sdk'], 'Should have MCP SDK dependency');
        assert.ok(packageJson.dependencies['express'], 'Should have Express dependency');
        assert.ok(packageJson.dependencies['dotenv'], 'Should have dotenv dependency');
        
        // Validate script commands exist
        assert.ok(packageJson.scripts, 'Scripts should be defined');
        assert.ok(packageJson.scripts['start:api'], 'Should have start:api script');
        assert.ok(packageJson.scripts['test'], 'Should have test script');
        assert.ok(packageJson.scripts['health'], 'Should have health script');
        
        console.log('✅ Assistant-MCP package.json validation passed');
      } catch (error) {
        assert.fail(`Package.json validation failed: ${error.message}`);
      }
    });

    test('assistant-mcp can start without errors', async (t) => {
      // Skip if we don't have the full assistant-mcp source
      const serverPath = path.resolve(__dirname, '../../packages/assistant-mcp/src/http-api-server.js');
      
      try {
        await access(serverPath);
      } catch (error) {
        t.skip('Assistant-MCP source not available for startup test');
        return;
      }

      // Test server can start (with short timeout for test)
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          server.kill();
          reject(new Error('Server startup timeout'));
        }, 10000); // 10 second timeout

        const server = spawn('node', [serverPath], {
          env: { 
            ...process.env,
            MCP_HTTP_PORT: '0', // Use dynamic port
            VAULT_PATH: '/tmp/test-vault'
          },
          stdio: 'pipe'
        });

        let output = '';
        server.stdout.on('data', (data) => {
          output += data.toString();
          // Look for successful startup message
          if (output.includes('Assistant MCP HTTP API Server running')) {
            clearTimeout(timeout);
            server.kill();
            resolve();
          }
        });

        server.stderr.on('data', (data) => {
          const error = data.toString();
          if (!error.includes('EADDRINUSE') && !error.includes('ENOENT')) {
            clearTimeout(timeout);
            server.kill();
            reject(new Error(`Server startup error: ${error}`));
          }
        });

        server.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  });

  describe('Python Environment', () => {
    test('platform-core Python requirements compatibility', async () => {
      // Check Python version requirements (3.9+)
      try {
        const { stdout } = await execAsync('python3 --version');
        const versionMatch = stdout.match(/Python (\d+)\.(\d+)/);
        
        if (versionMatch) {
          const major = parseInt(versionMatch[1]);
          const minor = parseInt(versionMatch[2]);
          const version = major + (minor / 10);
          
          assert.ok(version >= 3.9, `Python 3.9+ required, found ${major}.${minor}`);
          console.log(`✅ Python version check passed: ${major}.${minor}`);
        } else {
          assert.fail('Could not determine Python version');
        }
      } catch (error) {
        assert.fail(`Python version check failed: ${error.message}`);
      }
    });

    test('platform-core pyproject.toml validation', async () => {
      const pyprojectPath = path.resolve(__dirname, '../../packages/platform-core/pyproject.toml');
      
      try {
        await access(pyprojectPath);
        const pyprojectContent = await readFile(pyprojectPath, 'utf-8');
        
        // Basic validation that it's a valid TOML structure
        assert.ok(pyprojectContent.includes('[project]'), 'Should have [project] section');
        assert.ok(pyprojectContent.includes('name = "pm-intelligence"'), 'Should have correct project name');
        assert.ok(pyprojectContent.includes('requires-python = ">=3.9"'), 'Should require Python 3.9+');
        
        // Check for critical dependencies
        assert.ok(pyprojectContent.includes('fastapi'), 'Should have FastAPI dependency');
        assert.ok(pyprojectContent.includes('pydantic'), 'Should have Pydantic dependency');
        assert.ok(pyprojectContent.includes('sqlalchemy'), 'Should have SQLAlchemy dependency');
        
        console.log('✅ Platform-core pyproject.toml validation passed');
      } catch (error) {
        assert.fail(`pyproject.toml validation failed: ${error.message}`);
      }
    });

    test('platform-core virtual environment setup', async (t) => {
      // This test checks if we can set up a virtual environment
      const venvPath = path.resolve(__dirname, '../../packages/platform-core/test-venv');
      
      try {
        // Create test virtual environment
        await execAsync(`python3 -m venv ${venvPath}`);
        
        // Verify venv was created
        await access(path.join(venvPath, 'bin', 'python'));
        
        console.log('✅ Virtual environment setup test passed');
        
        // Cleanup
        await execAsync(`rm -rf ${venvPath}`);
      } catch (error) {
        // Skip if venv creation fails (missing dependencies, etc.)
        t.skip(`Virtual environment test skipped: ${error.message}`);
      }
    });
  });

  describe('Shared Infrastructure', () => {
    test('shared types compilation', async () => {
      const typesPath = path.resolve(__dirname, '../../shared/types/common.ts');
      
      try {
        await access(typesPath);
        const typesContent = await readFile(typesPath, 'utf-8');
        
        // Validate key type definitions exist
        assert.ok(typesContent.includes('interface Stakeholder'), 'Should define Stakeholder interface');
        assert.ok(typesContent.includes('interface Project'), 'Should define Project interface');
        assert.ok(typesContent.includes('interface WorkflowStep'), 'Should define WorkflowStep interface');
        assert.ok(typesContent.includes('interface ApiResponse'), 'Should define ApiResponse interface');
        assert.ok(typesContent.includes('interface WSJFScore'), 'Should define WSJFScore interface');
        
        console.log('✅ Shared types validation passed');
      } catch (error) {
        assert.fail(`Shared types validation failed: ${error.message}`);
      }
    });

    test('shared utilities compilation', async () => {
      const utilsPath = path.resolve(__dirname, '../../shared/utils/communication.ts');
      
      try {
        await access(utilsPath);
        const utilsContent = await readFile(utilsPath, 'utf-8');
        
        // Validate key utility classes exist
        assert.ok(utilsContent.includes('class ServiceClient'), 'Should define ServiceClient class');
        assert.ok(utilsContent.includes('class CircuitBreaker'), 'Should define CircuitBreaker class');
        assert.ok(utilsContent.includes('class EventBus'), 'Should define EventBus class');
        assert.ok(utilsContent.includes('class WebSocketManager'), 'Should define WebSocketManager class');
        assert.ok(utilsContent.includes('class ServiceRegistry'), 'Should define ServiceRegistry class');
        
        console.log('✅ Shared utilities validation passed');
      } catch (error) {
        assert.fail(`Shared utilities validation failed: ${error.message}`);
      }
    });

    test('API schemas validation', async () => {
      const schemasPath = path.resolve(__dirname, '../../shared/schemas/api.json');
      
      try {
        await access(schemasPath);
        const schemasContent = await readFile(schemasPath, 'utf-8');
        const schemas = JSON.parse(schemasContent);
        
        // Validate schema structure
        assert.ok(schemas.$schema, 'Should have JSON Schema meta-schema');
        assert.ok(schemas.definitions, 'Should have definitions section');
        assert.ok(schemas.endpoints, 'Should have endpoints section');
        
        // Check key definitions
        assert.ok(schemas.definitions.ApiResponse, 'Should define ApiResponse schema');
        assert.ok(schemas.definitions.Workflow, 'Should define Workflow schema');
        assert.ok(schemas.definitions.MeetingAnalysis, 'Should define MeetingAnalysis schema');
        assert.ok(schemas.definitions.WSJFScore, 'Should define WSJFScore schema');
        
        // Check endpoint definitions
        assert.ok(schemas.endpoints['assistant-mcp'], 'Should define assistant-mcp endpoints');
        assert.ok(schemas.endpoints['platform-core'], 'Should define platform-core endpoints');
        
        console.log('✅ API schemas validation passed');
      } catch (error) {
        assert.fail(`API schemas validation failed: ${error.message}`);
      }
    });
  });

  describe('Migration Tools', () => {
    test('configuration migration tool exists and is executable', async () => {
      const migrationToolPath = path.resolve(__dirname, '../../tools/migrate-config.js');
      
      try {
        await access(migrationToolPath);
        const toolContent = await readFile(migrationToolPath, 'utf-8');
        
        // Validate it's a proper Node.js module
        assert.ok(toolContent.includes('#!/usr/bin/env node'), 'Should have proper shebang');
        assert.ok(toolContent.includes('class ConfigMigrator'), 'Should define ConfigMigrator class');
        assert.ok(toolContent.includes('migrateAssistantConfig'), 'Should have assistant config migration');
        assert.ok(toolContent.includes('migratePlatformConfig'), 'Should have platform config migration');
        
        console.log('✅ Migration tool validation passed');
      } catch (error) {
        assert.fail(`Migration tool validation failed: ${error.message}`);
      }
    });
  });

  describe('Monorepo Structure', () => {
    test('root package.json workspace configuration', async () => {
      const rootPackagePath = path.resolve(__dirname, '../../package.json');
      
      try {
        await access(rootPackagePath);
        const packageContent = await readFile(rootPackagePath, 'utf-8');
        const packageJson = JSON.parse(packageContent);
        
        // Validate workspace configuration
        assert.ok(packageJson.workspaces, 'Should have workspaces configuration');
        assert.ok(Array.isArray(packageJson.workspaces), 'Workspaces should be an array');
        assert.ok(packageJson.workspaces.includes('packages/*'), 'Should include packages/*');
        assert.ok(packageJson.workspaces.includes('apps/*'), 'Should include apps/*');
        assert.ok(packageJson.workspaces.includes('shared/*'), 'Should include shared/*');
        
        // Validate unified scripts
        assert.ok(packageJson.scripts, 'Should have scripts');
        assert.ok(packageJson.scripts.dev, 'Should have dev script');
        assert.ok(packageJson.scripts.test, 'Should have test script');
        assert.ok(packageJson.scripts.build, 'Should have build script');
        assert.ok(packageJson.scripts.health, 'Should have health script');
        
        console.log('✅ Root package.json validation passed');
      } catch (error) {
        assert.fail(`Root package.json validation failed: ${error.message}`);
      }
    });

    test('directory structure exists', async () => {
      const requiredDirs = [
        'packages',
        'shared', 
        'apps',
        'tools',
        'docs',
        'deployment'
      ];

      for (const dir of requiredDirs) {
        const dirPath = path.resolve(__dirname, '../../', dir);
        try {
          await access(dirPath);
          console.log(`✅ Directory exists: ${dir}`);
        } catch (error) {
          assert.fail(`Required directory missing: ${dir}`);
        }
      }
    });
  });
});

// Run tests if called directly
if (import.meta.url === `file://${__filename}`) {
  console.log('🧪 Running Repository Compatibility Tests...\n');
}