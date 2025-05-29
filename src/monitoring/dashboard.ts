import { Keypair } from '@solana/web3.js';
import { CONFIG, colors } from '../config/constants';

// 🎯 DASHBOARD: Display active positions
export function displayDashboard(
    wallet: Keypair,
    activePositions: Map<string, any>, 
    candidateTokens: Map<string, any>, 
    detectedTokens: Map<string, any>, 
    processedTxSize: number
): void {
    console.clear();
    
    // Header
    console.log(`${colors.bright}${colors.magenta}🚀 FIRSTIN TOOLS - MULTI-POSITIONS DASHBOARD 🚀${colors.reset}`);
    console.log(`${colors.cyan}┌─────────────────────────────────────────────────────────────────────────────────┐${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} 💳 Wallet: ${colors.yellow}${wallet.publicKey.toString().slice(0, 8)}...${wallet.publicKey.toString().slice(-8)}${colors.reset} | 📊 Positions: ${colors.green}${activePositions.size}/${CONFIG.MAX_POSITIONS}${colors.reset} | 🔍 Scanner: ${colors.green}ACTIVE${colors.reset}`.padEnd(90) + `${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}└─────────────────────────────────────────────────────────────────────────────────┘${colors.reset}`);
    
    if (activePositions.size === 0) {
        console.log(`\n${colors.yellow}📊 No active positions - Waiting for new tokens...${colors.reset}`);
        console.log(`${colors.cyan}🔍 Candidates: ${candidateTokens.size} | Next analysis in: ${Math.ceil((10000 - (Date.now() % 10000)) / 1000)}s${colors.reset}`);
        return;
    }
    
    // Active positions
    console.log(`\n${colors.bright}${colors.green}📊 ACTIVE POSITIONS${colors.reset}`);
    console.log(`${colors.cyan}┌─────┬──────────────────┬─────────────┬──────────────┬─────────────┬──────────────┐${colors.reset}`);
    console.log(`${colors.cyan}│ #   │ Token            │ Time        │ Balance      │ SOL Value    │ Profit       │${colors.reset}`);
    console.log(`${colors.cyan}├─────┼──────────────────┼─────────────┼──────────────┼─────────────┼──────────────┤${colors.reset}`);
    
    let positionIndex = 1;
    for (const [mintStr, position] of activePositions.entries()) {
        const elapsed = Math.floor((Date.now() - position.startTime) / 1000);
        const remaining = Math.max(0, Math.floor((CONFIG.HOLD_TIMEOUT - (Date.now() - position.startTime)) / 1000));
        
        const timeStr = `${elapsed}s/${Math.floor(CONFIG.HOLD_TIMEOUT/1000)}s`;
        const symbolStr = position.symbol.slice(0, 12).padEnd(12);
        
        // Format values
        const balanceStr = position.currentBalance ? 
            `${(Number(position.currentBalance) / 1000000).toFixed(0)}M` : 'Calculating...';
        const solValueStr = position.currentSolValue ? 
            `${position.currentSolValue.toFixed(6)} SOL` : 'Calculating...';
        const profitStr = position.currentProfit !== undefined ? 
            `${position.currentProfit > 0 ? '+' : ''}${position.currentProfit.toFixed(2)}%` : 'Calculating...';
        
        // Profit color
        const profitColor = position.currentProfit !== undefined ? 
            (position.currentProfit > 0 ? colors.green : colors.red) : colors.yellow;
        
        console.log(`${colors.cyan}│${colors.reset} ${positionIndex.toString().padStart(3)} ${colors.cyan}│${colors.reset} ${symbolStr}     ${colors.cyan}│${colors.reset} ${timeStr.padEnd(11)} ${colors.cyan}│${colors.reset} ${balanceStr.padEnd(12)} ${colors.cyan}│${colors.reset} ${solValueStr.padEnd(11)} ${colors.cyan}│${colors.reset} ${profitColor}${profitStr.padEnd(12)}${colors.reset} ${colors.cyan}│${colors.reset}`);
        positionIndex++;
    }
    
    console.log(`${colors.cyan}└─────┴──────────────────┴─────────────┴──────────────┴─────────────┴──────────────┘${colors.reset}`);
    
    // Stats
    console.log(`\n${colors.cyan}📊 Stats: ${candidateTokens.size} candidates • ${detectedTokens.size} tokens detected • ${processedTxSize} transactions seen${colors.reset}`);
} 