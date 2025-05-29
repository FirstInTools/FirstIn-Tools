import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { CONFIG, colors } from './src/config/constants';
import { Position, DetectedToken, CandidateToken } from './src/types/index';
import { logInfo, logError, logSuccess } from './src/utils/logger';
import { maintainBlockhashCache } from './src/utils/cache';
import { startTransactionDecoder, getProcessedTxSet, clearProcessedTxCache } from './src/websocket/client';
import { scanAndSelectBestToken } from './src/scanner/intelligent';
import { displayDashboard } from './src/monitoring/dashboard';
import { updatePositionData } from './src/monitoring/positions';

// Initialize connection and wallet
const connection = new Connection(CONFIG.RPC_ENDPOINT, { commitment: 'processed' });
const wallet = Keypair.fromSecretKey(bs58.decode(CONFIG.PRIVATE_KEY));

// Global state with enriched position data
let activePositions = new Map<string, Position>();
let detectedTokens = new Map<string, DetectedToken>();
let candidateTokens = new Map<string, CandidateToken>();

// Show startup banner once
function showStartupBanner() {
    console.clear();
    console.log(`${colors.bright}${colors.magenta}🚀 FIRSTIN TOOLS - SMART SCANNER v5.0 🚀${colors.reset}`);
    console.log(`${colors.cyan}┌─────────────────────────────────────────────────────────┐${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} 💳 Wallet: ${colors.yellow}${wallet.publicKey.toString().slice(0, 8)}...${wallet.publicKey.toString().slice(-8)}${colors.reset}`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} 💰 Investment: ${colors.green}${CONFIG.BUY_AMOUNT} SOL${colors.reset} per token`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} 🎯 Target: ${colors.green}${CONFIG.TARGET_TOKENS.toLocaleString()} tokens${colors.reset} minimum`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} 🔧 Compute: ${colors.green}${CONFIG.COMPUTE_UNIT_LIMIT.toLocaleString()} units${colors.reset} @ ${colors.green}0.01 lamports/CU${colors.reset}`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} 🔍 Mode: ${colors.bright}${colors.yellow}SMART SCANNER${colors.reset} (${CONFIG.SCAN_INTERVAL/1000}s)`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} 📊 Strategy: ${colors.bright}${colors.green}BEST RATIO${colors.reset} (no rush)`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}└─────────────────────────────────────────────────────────┘${colors.reset}`);
    console.log('');
}

// Bot startup
async function startBot() {
    // Show banner once
    showStartupBanner();
    
    logInfo('Initializing bot...');
    
    // Start cache maintenance
    maintainBlockhashCache(connection);
    
    // Start transaction decoder
    startTransactionDecoder(connection, candidateTokens, detectedTokens, activePositions, wallet);
    
    // 🎯 SMART SCANNER: Start periodic scanner
    if (CONFIG.SCAN_MODE) {
        logInfo(`🔍 Smart Scanner Mode activated - Scanning every ${CONFIG.SCAN_INTERVAL/1000}s`);
        setInterval(async () => {
            // Scan even with active positions (up to MAX_POSITIONS)
            await scanAndSelectBestToken(connection, candidateTokens, activePositions, detectedTokens, wallet);
        }, CONFIG.SCAN_INTERVAL);
    }
    
    // Wait 5 seconds before starting dashboard to let users see the banner
    setTimeout(() => {
        // 🎯 DASHBOARD: Update dashboard every 2 seconds
        setInterval(() => {
            displayDashboard(wallet, activePositions, candidateTokens, detectedTokens, getProcessedTxSet().size);
        }, 2000);
    }, 5000);
    
    // 🎯 MONITORING: Update position data every 2 seconds
    setInterval(async () => {
        for (const mintStr of activePositions.keys()) {
            await updatePositionData(connection, mintStr, activePositions, detectedTokens, wallet);
        }
    }, 2000);
    
    // Maintenance loop
    while (true) {
        try {
            // Clean old detected tokens
            const now = Date.now();
            for (const [mintStr, tokenData] of detectedTokens.entries()) {
                if (now - tokenData.timestamp > 300000) { // 5 minutes
                    detectedTokens.delete(mintStr);
                }
            }
            
            // Clean old candidates
            if (CONFIG.SCAN_MODE) {
                for (const [mintStr, candidate] of candidateTokens.entries()) {
                    const age = (now - candidate.timestamp) / 1000;
                    if (age > CONFIG.SCAN_WINDOW) { // Double the scan window
                        candidateTokens.delete(mintStr);
                    }
                }
            }
            
            // Clean transaction cache
            if (getProcessedTxSet().size > 1000) {
                clearProcessedTxCache();
                logInfo('Transaction cache cleaned');
            }
            
            await new Promise(resolve => setTimeout(resolve, 30000));
            
        } catch (error) {
            logError(`Maintenance error: ${error}`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// Start the bot
startBot().catch(console.error); 