import { CreateTokenData } from '../types/index';
import { CREATE_INSTRUCTION_SIGNATURE } from '../config/constants';
import { PublicKey } from '@solana/web3.js';

// Decoding CREATE transactions
export function decodeCreateTransaction(data: Buffer): CreateTokenData | null {
    try {
        if (data.length < 8 || !data.subarray(0, 8).equals(CREATE_INSTRUCTION_SIGNATURE)) {
            return null;
        }
        
        let offset = 8;
        
        // Read name
        if (offset + 4 > data.length) return null;
        const nameLength = data.readUInt32LE(offset);
        offset += 4;
        
        if (offset + nameLength > data.length) return null;
        const name = data.subarray(offset, offset + nameLength).toString('utf8');
        offset += nameLength;
        
        // Read symbol
        if (offset + 4 > data.length) return null;
        const symbolLength = data.readUInt32LE(offset);
        offset += 4;
        
        if (offset + symbolLength > data.length) return null;
        const symbol = data.subarray(offset, offset + symbolLength).toString('utf8');
        offset += symbolLength;
        
        // Read URI
        if (offset + 4 > data.length) return null;
        const uriLength = data.readUInt32LE(offset);
        offset += 4;
        
        if (offset + uriLength > data.length) return null;
        const uri = data.subarray(offset, offset + uriLength).toString('utf8');
        
        return {
            mint: PublicKey.default,
            curve: PublicKey.default,
            creator: PublicKey.default,
            name,
            symbol,
            uri
        };
        
    } catch (error) {
        return null;
    }
} 