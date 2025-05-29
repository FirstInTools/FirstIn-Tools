import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { CONFIG, colors } from '../config/constants';
import { logInfo, logSuccess, logWarning, logError, logFire } from '../utils/logger';
import { calculateTokensForSol } from '../utils/calculations';
import { executeBuy } from '../trading/buy';

// 🎯 SMART SCANNER: Analyze and choose the best token
export async function scanAndSelectBestToken(
    connection: Connection,
    candidateTokens: Map<string, any>, 
    activePositions: Map<string, any>, 
    detectedTokens: Map<string, any>,
    wallet: Keypair
): Promise<void> {
    if (activePositions.size >= CONFIG.MAX_POSITIONS || candidateTokens.size === 0) {
        return;
    }
    
    console.log(`\n${colors.bright}${colors.cyan}🔍 SMART SCANNER ACTIVATED!${colors.reset}`);
    logInfo(`📊 Analyzing ${candidateTokens.size} candidate tokens...`);
    
    const now = Date.now();
    const validCandidates: Array<{
        mint: PublicKey;
        curve: PublicKey;
        creator: PublicKey;
        name: string;
        symbol: string;
        ratio: number;
        score: number;
    }> = [];
    
    // Analyze each candidate
    for (const [mintStr, candidate] of candidateTokens.entries()) {
        try {
            // Check age (keep only recent tokens)
            const age = (now - candidate.timestamp) / 1000;
            if (age > CONFIG.SCAN_WINDOW) {
                candidateTokens.delete(mintStr);
                continue;
            }
            
            // Check if we already have this position
            if (activePositions.has(mintStr)) {
                continue;
            }
            
            // Calculate tokens/SOL ratio
            const tokensForSol = await calculateTokensForSol(connection, candidate.curve, CONFIG.RATIO_CHECK_SOL);
            if (!tokensForSol) {
                continue;
            }
            
            const ratio = Number(tokensForSol);
            
            // Check if ratio meets our criteria
            if (ratio >= CONFIG.MIN_TOKENS_FOR_SOL) {
                const score = ratio; // More tokens = better score
                
                validCandidates.push({
                    mint: candidate.mint,
                    curve: candidate.curve,
                    creator: candidate.creator,
                    name: candidate.name,
                    symbol: candidate.symbol,
                    ratio,
                    score
                });
                
                logSuccess(`✅ ${candidate.symbol}: ${ratio.toLocaleString()} tokens (score: ${score.toLocaleString()})`);
            } else {
                logWarning(`❌ ${candidate.symbol}: ${ratio.toLocaleString()} tokens (insufficient)`);
            }
            
        } catch (error) {
            logError(`Analysis error ${candidate.symbol}: ${error}`);
        }
    }
    
    // Choose the best candidate
    if (validCandidates.length > 0) {
        // Sort by score (more tokens = better)
        validCandidates.sort((a, b) => b.score - a.score);
        const bestCandidate = validCandidates[0];
        
        console.log(`\n${colors.bright}${colors.green}🏆 BEST CANDIDATE SELECTED!${colors.reset}`);
        console.log(`${colors.cyan}┌─────────────────────────────────────────────────────────┐${colors.reset}`);
        console.log(`${colors.cyan}│${colors.reset} 🪙 Name: ${colors.bright}${bestCandidate.name}${colors.reset}`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
        console.log(`${colors.cyan}│${colors.reset} 🏷️  Symbol: ${colors.bright}${bestCandidate.symbol}${colors.reset}`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
        console.log(`${colors.cyan}│${colors.reset} 🔑 Mint: ${colors.yellow}${bestCandidate.mint.toString().slice(0, 8)}...${bestCandidate.mint.toString().slice(-8)}${colors.reset}`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
        console.log(`${colors.cyan}│${colors.reset} 🎯 Ratio: ${colors.green}${bestCandidate.ratio.toLocaleString()} tokens${colors.reset}`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
        console.log(`${colors.cyan}│${colors.reset} 🏆 Score: ${colors.green}${bestCandidate.score.toLocaleString()}${colors.reset}`.padEnd(70) + `${colors.cyan}│${colors.reset}`);
        console.log(`${colors.cyan}└─────────────────────────────────────────────────────────┘${colors.reset}`);
        
        // Store selected token info
        detectedTokens.set(bestCandidate.mint.toString(), {
            mint: bestCandidate.mint,
            curve: bestCandidate.curve,
            creator: bestCandidate.creator,
            timestamp: Date.now()
        });
        
        // Buy the best candidate
        logFire('🎯 BUYING BEST CANDIDATE!');
        await executeBuy(connection, {
            mint: bestCandidate.mint,
            curve: bestCandidate.curve,
            creator: bestCandidate.creator,
            name: bestCandidate.name,
            symbol: bestCandidate.symbol
        }, activePositions, detectedTokens, wallet);
        
        // Clean candidates after buy
        candidateTokens.clear();
        
    } else {
        logWarning(`❌ No valid candidates found (${candidateTokens.size} analyzed)`);
        console.log(`${colors.yellow}⏳ Waiting for next scan...${colors.reset}\n`);
    }
} 