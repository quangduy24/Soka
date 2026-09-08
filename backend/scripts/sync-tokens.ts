import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GRAPHQL_URL = 'https://graphql.mainnet.sui.io/graphql';
const TOKENS_FILE = path.resolve(__dirname, '../../src/cetus-tokens.json');

// We use 5 items per batch to stay safely under the GraphQL rate limits
const BATCH_SIZE = 5;

async function syncTokens() {
  console.log(`Loading registry from ${TOKENS_FILE}`);
  let registry: any[];
  try {
    const raw = fs.readFileSync(TOKENS_FILE, 'utf-8');
    registry = JSON.parse(raw);
  } catch (err: any) {
    console.error('Failed to read cetus-tokens.json:', err.message);
    process.exit(1);
  }

  console.log(`Found ${registry.length} tokens. Starting on-chain synchronization...`);

  let updatedCount = 0;

  for (let i = 0; i < registry.length; i += BATCH_SIZE) {
    const batch = registry.slice(i, i + BATCH_SIZE);
    
    // Build aliased GraphQL query
    let query = 'query { \n';
    batch.forEach((t, index) => {
      query += `  c${index}: coinMetadata(coinType: "${t.coinType}") { symbol name decimals iconUrl }\n`;
    });
    query += '}';

    try {
      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!res.ok) {
        console.error(`HTTP error ${res.status} on batch ${i / BATCH_SIZE}`);
        continue;
      }

      const json = await res.json();
      if (json.errors) {
        console.error(`GraphQL errors on batch ${i / BATCH_SIZE}:`, json.errors);
        continue;
      }

      const data = json.data;
      if (!data) continue;

      // Map the results back to the registry
      batch.forEach((t, index) => {
        const onchainData = data[`c${index}`];
        if (onchainData) {
          // Update local registry entry with true on-chain data
          if (onchainData.symbol) t.symbol = onchainData.symbol;
          if (onchainData.name) t.name = onchainData.name;
          if (onchainData.decimals !== undefined && onchainData.decimals !== null) {
            t.decimals = onchainData.decimals;
          }
          if (onchainData.iconUrl) {
            t.logoUrl = onchainData.iconUrl;
          }
          updatedCount++;
        }
      });

      console.log(`Processed batch ${i / BATCH_SIZE + 1} / ${Math.ceil(registry.length / BATCH_SIZE)}`);
      
      // Delay to avoid rate limiting on public RPC
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (err: any) {
      console.error(`Failed to process batch ${i / BATCH_SIZE}:`, err.message);
    }
  }

  // Save the updated registry back to the file
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(registry, null, 2));
  console.log(`\nSync complete! Successfully updated ${updatedCount} tokens with true on-chain metadata.`);
}

syncTokens();
