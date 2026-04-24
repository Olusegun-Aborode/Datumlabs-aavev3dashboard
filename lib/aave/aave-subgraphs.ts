// lib/aave/aave-subgraphs.ts
// Aave's official subgraphs on The Graph's decentralized network. Used for
// historical reserve data (paramsHistory) which AaveKit doesn't expose.
//
// Each entry maps a chainId → the subgraph ID for that chain's *default*
// (Core) Aave V3 market. A chain can have multiple markets (Ethereum has
// Core, Lido, EtherFi, Horizon, GHO) — those need a per-market override
// keyed by the AaveKit market address. If we don't know which subgraph
// to query, callers should treat that gracefully and skip historical
// charts for the affected reserve.

const DEFAULT_BY_CHAIN: Record<number, string> = {
    1:      'Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g',  // Ethereum Core
    42161:  'DLuE98kEb5pQNXAcKFQGQgfSQ57Xdou4jnVbAEqMfy3B',  // Arbitrum
    43114:  '2h9woxy8RTjHu1HJsCEnmzpPHFArU33avmUh4f71JpVn',  // Avalanche
    8453:   'GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF',  // Base
    10:     'DSfLz8oQBUeU5atALgUFQKMTSYV9mZAVYp4noLSXAfvb',  // Optimism
    137:    'Co2URyXjnxaw8WqxKyVHdirq9Ahhm5vcTs4dMedAq211',  // Polygon
    56:     '7Jk85XgkV1MQ7u56hD8rr65rfASbayJXopugWkUoBMnZ',  // BNB
    100:    'HtcDaL8L8iZ2KQNNS44EBVmLruzxuNAz1RkBYdui1QUT',  // Gnosis
    59144:  'Gz2kjnmRV1fQj3R8cssoZa5y9VTanhrDo4Mh7nWW1wHa',  // Linea
    534352: '74JwenoHZb2aAYVGCCSdPWzi9mm745dyHyQQVoZ7Sbub',  // Scroll
    324:    'ENYSc8G3WvrbhWH8UZHrqPWYRcuyCaNmaTmoVp7uzabM',  // zkSync
    146:    'FQcacc4ZJaQVS9euWb76nvpSq2GxavBnUM6DU6tmspbi',  // Sonic
    42220:  'GAVWZzGwQ6d6QbFojyFWxpZ2GB9Rf5hZgGyJHCEry8kn',  // Celo
    1868:   '5waxmqS3rkRtZPoV2mL5RCToupVxVbTd7hjicxMGebYm',  // Soneium
    57073:  '6AY9ccNwMwd3G27zp9vUKWCi9ugvNS6gkh5EEBY2xnPC',  // Ink
    4326:   'DnfLSdosqrcZ8pb8G2rL954SdRB8Pk4jjkgjtfwfx7cY',  // MegaETH
};

// Per-market overrides for chains where multiple AaveKit markets exist on
// the same chain. Keyed by lowercased AaveKit market address.
const MARKET_OVERRIDES: Record<string, string> = {
    // Ethereum Lido market
    '0x4e033931ad43597d96d6bcc25c280717730b58b1': '5vxMbXRhG1oQr55MWC5j6qg78waWujx1wjeuEWDA6j3',
    // Ethereum EtherFi market
    '0x0aa97c284e98396202b6a04024f5e2c65026f3c0': '8o4HGApJkAqnvxAHShG4w5xiXihHyL7HkeDdQdRUYmqZ',
    // Ethereum GHO market
    '0xb50201558b00496a145fe76f7424749556e326d8': 'BQN5t5Mgti3BNLsZYEiL1MtiBJLa1DQJnaquXR1zTBjn',
};

export function getAaveSubgraphId(chainId: number, marketAddress?: string): string | null {
    if (marketAddress) {
        const override = MARKET_OVERRIDES[marketAddress.toLowerCase()];
        if (override) return override;
    }
    return DEFAULT_BY_CHAIN[chainId] || null;
}

export function getAaveSubgraphUrl(chainId: number, marketAddress?: string): string | null {
    const id = getAaveSubgraphId(chainId, marketAddress);
    if (!id) return null;
    const apiKey = process.env.NEXT_PUBLIC_THEGRAPH_API_KEY;
    if (!apiKey) return null;
    return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${id}`;
}
