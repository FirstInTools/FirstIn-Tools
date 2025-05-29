import { PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';

dotenv.config();

// 🎯 CONFIGURATION FROM WINNING TRADER (DIVIDED BY 10 FOR SAFER TESTING)
export const CONFIG = {
    RPC_ENDPOINT: process.env.RPC_ENDPOINT!,
    WS_ENDPOINT: process.env.WS_ENDPOINT!, // 🎯 WebSocket endpoint from .env
    PRIVATE_KEY: process.env.PRIVATE_KEY!,
    BUY_AMOUNT: 0.00118,               // 🎯 REDUCED: max_sol_cost (1180000 lamports) - SAFER TESTING
    TARGET_TOKENS: 40012,              // 🎯 REDUCED: Number of tokens (40012000000) - SAFER TESTING
    TAKE_PROFIT: 5,                    // Take profit in %
    HOLD_TIMEOUT: 300000,              // Timeout in ms (5 minutes)
    
    // 🎯 NEW: Multi-positions
    MAX_POSITIONS: 15,                 // Maximum 15 simultaneous positions (BEAST MODE with Helius 50 req/s)
    
    // 🎯 NEW: Smart scanner instead of instant rush
    SCAN_MODE: true,                   // Smart scanner mode
    SCAN_INTERVAL: 20000,              // Scan every 20 seconds (ULTRA-BEAST MODE)
    SCAN_WINDOW: 60,                   // Analyze tokens from last 20 seconds
    
    // Basic optimizations
    INSTANT_BUY: true,                 // Instant buy
    MAX_TX_AGE: 60,                    // Max transaction age (increased for scanning)
    
    // 🎯 EXACT: ComputeBudget from winning trader
    COMPUTE_UNIT_LIMIT: 100000,        // 🎯 EXACT: SetComputeUnitLimit
    COMPUTE_UNIT_PRICE: 10000,         // 🎯 EXACT: SetComputeUnitPrice (0.01 lamports/CU)
    
    // Token/SOL ratio verification
    CHECK_TOKEN_RATIO: true,
    MIN_TOKENS_FOR_SOL: 40012,         // 🎯 REDUCED: Minimum 40,012 tokens - SAFER TESTING
    RATIO_CHECK_SOL: 0.00118,          // 🎯 REDUCED: For maximum 0.00118 SOL - SAFER TESTING
};

// pump.fun program and addresses
export const PUMP_FUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
export const GLOBAL_ACCOUNT = new PublicKey('4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf');
export const FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');
export const EVENT_AUTHORITY = new PublicKey('Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');

// pump.fun instruction signatures
export const CREATE_INSTRUCTION_SIGNATURE = Buffer.from([0x18, 0x1e, 0xc8, 0x28, 0x05, 0x1c, 0x07, 0x77]);
export const BUY_INSTRUCTION_SIGNATURE = Buffer.from([0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea]);

// Console colors
export const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
}; 