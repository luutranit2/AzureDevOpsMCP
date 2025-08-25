/**
 * Logger utility for MCP server
 * 
 * This logger provides different levels of logging that can be controlled via environment variables.
 * For MCP servers running in Claude Desktop, we want to minimize console.log output to prevent
 * notification popups while still allowing error logging to stderr.
 */

// Check if we're running as an MCP server (Claude Desktop integration)
const isMCPServer = process.argv.includes('--mcp') || process.env.MCP_SERVER_MODE === 'true' || !process.stdout.isTTY;

// Log levels: 0 = silent, 1 = errors only, 2 = warnings + errors, 3 = info + warnings + errors, 4 = debug + all
const logLevel = parseInt(process.env.AZURE_DEVOPS_LOG_LEVEL) || (isMCPServer ? 1 : 3);

/**
 * Logger class with different output modes for MCP vs standalone usage
 */
export class Logger {
    static debug(...args) {
        if (logLevel >= 4) {
            if (isMCPServer) {
                // Send debug to stderr to avoid popups in Claude Desktop
                console.error('[DEBUG]', ...args);
            } else {
                console.log('🔧', ...args);
            }
        }
    }

    static info(...args) {
        if (logLevel >= 3) {
            if (isMCPServer) {
                // Send info to stderr to avoid popups in Claude Desktop
                console.error('[INFO]', ...args);
            } else {
                console.log('ℹ️', ...args);
            }
        }
    }

    static warn(...args) {
        if (logLevel >= 2) {
            console.error('⚠️', ...args);
        }
    }

    static error(...args) {
        if (logLevel >= 1) {
            console.error('❌', ...args);
        }
    }

    static success(...args) {
        if (logLevel >= 3) {
            if (isMCPServer) {
                // Send success to stderr to avoid popups in Claude Desktop
                console.error('[SUCCESS]', ...args);
            } else {
                console.log('✅', ...args);
            }
        }
    }

    static progress(...args) {
        if (logLevel >= 3) {
            if (isMCPServer) {
                // Send progress to stderr to avoid popups in Claude Desktop
                console.error('[PROGRESS]', ...args);
            } else {
                console.log('🔄', ...args);
            }
        }
    }

    // Always log critical operations regardless of level
    static critical(...args) {
        console.error('🚨', ...args);
    }
}

// Export convenience functions for backward compatibility
export const logger = Logger;
export default Logger;

// Utility to suppress console.log for MCP mode while preserving stderr
export function configureMCPLogging() {
    if (isMCPServer) {
        // Override console.log to reduce output in MCP mode
        const originalLog = console.log;
        console.log = (...args) => {
            // Only log if it's a JSON response (MCP protocol)
            const firstArg = args[0];
            if (typeof firstArg === 'string' && (firstArg.includes('"jsonrpc"') || firstArg.includes('"result"'))) {
                originalLog(...args);
            } else {
                // Redirect other logs to stderr with reduced verbosity
                if (logLevel >= 2) {
                    console.error('[LOG]', ...args);
                }
            }
        };
    }
} 