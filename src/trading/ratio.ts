import { Connection, PublicKey } from '@solana/web3.js';
import { CONFIG } from '../config/constants';
import { logInfo, logSuccess, logWarning, logError } from '../utils/logger';
import { calculateTokensForSol } from '../utils/calculations';

// Token/SOL ratio verification
export async function checkTokenRatio(connection: Connection, curve: PublicKey): Promise<boolean> {
    try {
        if (!CONFIG.CHECK_TOKEN_RATIO) {
            return true;
        }
        
        logInfo(`🔍 Checking tokens/SOL ratio...`);
        
        // Calculate how many tokens we would get for reference amount
        const tokensForRatio = await calculateTokensForSol(connection, curve, CONFIG.RATIO_CHECK_SOL);
        
        if (!tokensForRatio) {
            logWarning('Unable to calculate ratio - buy allowed by default');
            return true;
        }
        
        const tokensNumber = Number(tokensForRatio);
        const ratioOk = tokensNumber >= CONFIG.MIN_TOKENS_FOR_SOL;
        
        if (ratioOk) {
            logSuccess(`✅ Ratio OK: ${tokensNumber.toLocaleString()} tokens for ${CONFIG.RATIO_CHECK_SOL} SOL`);
        } else {
            logWarning(`❌ Insufficient ratio: ${tokensNumber.toLocaleString()} tokens for ${CONFIG.RATIO_CHECK_SOL} SOL (min: ${CONFIG.MIN_TOKENS_FOR_SOL.toLocaleString()})`);
        }
        
        return ratioOk;
        
    } catch (error) {
        logError(`Ratio verification error: ${error}`);
        return true; // In case of error, allow buy
    }
} 