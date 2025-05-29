import WebSocket from 'ws';
import { Connection, Keypair } from '@solana/web3.js';
import { PUMP_FUN_PROGRAM_ID, CONFIG } from '../config/constants';
import { logSuccess, logInfo, logError, logWarning } from '../utils/logger';
import { decodeCreateTransaction } from './decoder';
import { processCreateTransaction } from './processor';

let processedTx = new Set<string>();

// WebSocket to detect new tokens
export function startTransactionDecoder(
    connection: Connection, 
    candidateTokens: Map<string, any>, 
    detectedTokens: Map<string, any>, 
    activePositions: Map<string, any>,
    wallet: Keypair
) {
    logInfo('Starting WebSocket connection...');
    logInfo(`🔗 Connecting to: ${CONFIG.WS_ENDPOINT}`);
    
    const ws = new WebSocket(CONFIG.WS_ENDPOINT, {
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    });
    
    ws.on('open', () => {
        logSuccess('WebSocket connected! Monitoring pump.fun transactions...');
        logSuccess(`✅ Using ${CONFIG.WS_ENDPOINT.includes('helius') ? 'HELIUS PREMIUM' : CONFIG.WS_ENDPOINT.includes('quicknode') ? 'QUICKNODE PREMIUM' : 'PUBLIC'} endpoint`);
        
        const subscribeMessage = {
            jsonrpc: '2.0',
            id: 1,
            method: 'logsSubscribe',
            params: [
                {
                    mentions: [PUMP_FUN_PROGRAM_ID.toString()]
                },
                {
                    commitment: 'processed'
                }
            ]
        };
        
        ws.send(JSON.stringify(subscribeMessage));
        logInfo('Subscribed to pump.fun CREATE transactions');
        console.log(`🎯 BOT READY! Waiting for new tokens...\n`);
    });
    
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.method === 'logsNotification') {
                const logs = message.params.result.value.logs;
                const signature = message.params.result.value.signature;
                
                const isCreateTransaction = logs.some((log: string) => 
                    log.includes('Instruction: Create') || 
                    log.includes('CreateEvent') ||
                    log.includes('Program log: Instruction: Create')
                );
                
                if (isCreateTransaction && !processedTx.has(signature)) {
                    processedTx.add(signature);
                    
                    await processCreateTransaction(connection, signature, candidateTokens, detectedTokens, activePositions, wallet);
                }
            }
        } catch (error) {
            logError(`WebSocket error: ${error}`);
        }
    });
    
    ws.on('error', (error) => {
        logError(`WebSocket connection error: ${error}`);
        logWarning(`🔄 Reconnecting to ${CONFIG.WS_ENDPOINT} in 3 seconds...`);
        setTimeout(() => startTransactionDecoder(connection, candidateTokens, detectedTokens, activePositions, wallet), 3000);
    });
    
    ws.on('close', () => {
        logWarning('WebSocket connection closed. Reconnecting...');
        setTimeout(() => startTransactionDecoder(connection, candidateTokens, detectedTokens, activePositions, wallet), 1000);
    });
}

export function getProcessedTxSet(): Set<string> {
    return processedTx;
}

export function clearProcessedTxCache(): void {
    processedTx.clear();
} 