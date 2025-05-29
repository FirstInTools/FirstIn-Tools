import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { CONFIG } from '../config/constants';
import { logInfo, logSuccess, logWarning, logError } from '../utils/logger';
import { calculateSolForTokens } from '../utils/calculations';
import { executeSell } from '../trading/sell';

// 🎯 MONITORING: Start monitoring a token
export async function startTokenMonitoring(
    connection: Connection,
    mintStr: string, 
    activePositions: Map<string, any>, 
    detectedTokens: Map<string, any>,
    wallet: Keypair
): Promise<void> {
    const position = activePositions.get(mintStr);
    if (!position) return;
    
    logInfo(`📊 Starting monitoring: ${position.symbol}`);
    
    // Monitoring interval
    const intervalId = setInterval(async () => {
        await updatePositionData(connection, mintStr, activePositions, detectedTokens, wallet);
    }, 2000);
    
    // Update interval ID
    position.intervalId = intervalId;
    activePositions.set(mintStr, position);
    
    // Sale timeout
    setTimeout(async () => {
        const currentPosition = activePositions.get(mintStr);
        if (currentPosition && currentPosition.monitoringActive) {
            logWarning(`⏰ TIMEOUT ${position.symbol} - Sale forced`);
            await executePositionSell(connection, mintStr, 'TIMEOUT', activePositions, detectedTokens, wallet);
        }
    }, CONFIG.HOLD_TIMEOUT);
}

// 🎯 MONITORING: Update position data
export async function updatePositionData(
    connection: Connection,
    mintStr: string, 
    activePositions: Map<string, any>, 
    detectedTokens: Map<string, any>,
    wallet: Keypair
): Promise<void> {
    const position = activePositions.get(mintStr);
    if (!position || !position.monitoringActive) return;
    
    try {
        // Verify balance
        const tokenBalance = await connection.getTokenAccountBalance(position.userTokenAccount);
        const currentTokens = BigInt(tokenBalance.value.amount);
        
        // Update balance in position
        position.currentBalance = currentTokens;
        position.lastUpdate = Date.now();
        
        if (currentTokens > BigInt(0)) {
            // Calculate current value
            const currentSolValue = await calculateSolForTokens(connection, position.curve, currentTokens);
            
            if (currentSolValue && currentSolValue > 0) {
                const profit = ((currentSolValue - position.buyAmount) / position.buyAmount) * 100;
                
                // Update values in position
                position.currentSolValue = currentSolValue;
                position.currentProfit = profit;
                activePositions.set(mintStr, position);
                
                // Verify take profit
                if (profit >= CONFIG.TAKE_PROFIT) {
                    logSuccess(`🎉 TAKE PROFIT ${position.symbol}: +${profit.toFixed(2)}%`);
                    await executePositionSell(connection, mintStr, 'TAKE_PROFIT', activePositions, detectedTokens, wallet);
                    return;
                }
            } else {
                // Impossible to calculate value
                position.currentSolValue = undefined;
                position.currentProfit = undefined;
                activePositions.set(mintStr, position);
            }
        } else {
            // No tokens = position closed
            logWarning(`❌ ${position.symbol}: No tokens detected`);
            await closePosition(mintStr, activePositions);
        }
        
    } catch (error) {
        // Monitoring error, mark as error
        position.currentSolValue = undefined;
        position.currentProfit = undefined;
        activePositions.set(mintStr, position);
    }
}

// 🎯 SALE: Execute position sale
export async function executePositionSell(
    connection: Connection,
    mintStr: string, 
    reason: string, 
    activePositions: Map<string, any>, 
    detectedTokens: Map<string, any>,
    wallet: Keypair
): Promise<void> {
    const position = activePositions.get(mintStr);
    if (!position) return;
    
    try {
        logInfo(`🔄 SALE ${position.symbol} (${reason})`);
        
        // Stop monitoring
        if (position.intervalId) {
            clearInterval(position.intervalId);
        }
        position.monitoringActive = false;
        activePositions.set(mintStr, position);
        
        // Get current balance
        const tokenBalance = await connection.getTokenAccountBalance(position.userTokenAccount);
        const currentTokens = BigInt(tokenBalance.value.amount);
        
        if (currentTokens > BigInt(0)) {
            const sellSuccess = await executeSell(connection, position.mint, position.curve, currentTokens, detectedTokens, wallet);
            if (sellSuccess) {
                logSuccess(`✅ SALE SUCCESSFUL: ${position.symbol}`);
            } else {
                logError(`❌ SALE FAILED: ${position.symbol}`);
            }
        }
        
        // Close position
        await closePosition(mintStr, activePositions);
        
    } catch (error) {
        logError(`Sale error ${position.symbol}: ${error}`);
        await closePosition(mintStr, activePositions);
    }
}

// 🎯 POSITION: Close a position
export async function closePosition(mintStr: string, activePositions: Map<string, any>): Promise<void> {
    const position = activePositions.get(mintStr);
    if (!position) return;
    
    // Stop monitoring
    if (position.intervalId) {
        clearInterval(position.intervalId);
    }
    
    // Remove position
    activePositions.delete(mintStr);
    
    logInfo(`🔒 Position closed: ${position.symbol}`);
} 