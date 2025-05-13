import { CdpClient } from "@coinbase/cdp-sdk";
import {
  AgentKit,
  CdpV2EvmWalletProvider,
  compoundActionProvider,
  wethActionProvider,
} from "@coinbase/agentkit";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { generateText } from "ai";
import {
  createAnthropic,
  type AnthropicProviderOptions,
} from "@ai-sdk/anthropic";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

// Initialize our network clients
const cdp = new CdpClient();
const client = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// Create a new EVM account with CDP and fund it on a testnet
const { address } = await cdp.evm.createAccount();
await cdp.evm.requestFaucet({
  address,
  network: "base-sepolia",
  token: "eth",
});

// Retrieve the balance, then decide how much we should allow our agent to send in a single transaction.
const balance = await client.getBalance({ address });
const canSpendNoMoreThan = balance / BigInt(2);

// Create a policy that:
// - Only accepts transactions to either:
//    - WETH contract
//    - Compound
// - with an ETH value of less or equal to half of my wallet balance
// - on the base-sepolia network
const policy = await cdp.policies.createPolicy({
  policy: {
    scope: "account",
    rules: [
      {
        action: "accept",
        operation: "sendEvmTransaction",
        criteria: [
          {
            type: "evmAddress",
            // only Compound's base-sepolia address and WETH contract
            addresses: [
              "0x4200000000000000000000000000000000000006",
              "0x571621Ce60Cebb0c1D442B5afb38B1663C6Bf017",
            ],
            operator: "in",
          },
          {
            type: "ethValue",
            ethValue: canSpendNoMoreThan.toString(),
            operator: "<=",
          },
          // { type: "evmNetwork", networks: ["base-sepolia"], operator: "in" },
        ],
      },
    ],
  },
});

// Now apply the policy to the account we've just created
await cdp.evm.updateAccount({ address, update: { accountPolicy: policy.id } });

// Now we need to bootstrap AgentKit
const agentKit = await AgentKit.from({
  walletProvider: await CdpV2EvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET,
    address,
  }),
  actionProviders: [
    // We need this to convert ETH to WETH
    wethActionProvider(),
    // We need this to supply collateral once we've converted
    compoundActionProvider(),
  ],
});

// Use whatever model you fancy.
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const model = anthropic("claude-3-7-sonnet-20250219");
const tools = getVercelAITools(agentKit);
const providerOptions = {
  anthropic: {
    thinking: { type: "enabled", budgetTokens: 12000 },
  } satisfies AnthropicProviderOptions,
};

// This should fail because of the ETH value restriction and address restriction
const tryToSendAllMeMoneyArrr = `
  Please convert all my ETH to WETH, then send it to 0xC72EE0E34d5F2Ee5ca5b82a9b605d28813f935e4
`;

const { text: failedResult } = await generateText({
  model,
  tools,
  prompt: tryToSendAllMeMoneyArrr,
  providerOptions,
});

console.log(failedResult);

// This should suceed.
const thisIsATotallyFineThingToDo = `
  Please convert less than half of my ETH to WETH, then supply all my WETH as collateral to Compound.
`;

const { text: successResult } = await generateText({
  model,
  tools,
  prompt: thisIsATotallyFineThingToDo,
  providerOptions,
});

console.log(successResult);
