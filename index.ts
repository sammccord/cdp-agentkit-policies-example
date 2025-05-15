import { CdpClient } from "@coinbase/cdp-sdk";
import {
  AgentKit,
  CdpV2EvmWalletProvider,
  walletActionProvider,
  wethActionProvider,
} from "@coinbase/agentkit";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { generateText } from "ai";
import {
  createAnthropic,
} from "@ai-sdk/anthropic";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

// Initialize our network clients
const cdp = new CdpClient({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
  walletSecret: process.env.CDP_WALLET_SECRET,
});
const client = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

async function main() {
  // In order to wrap ETH with WETH, you'll need to submit at least $65 of Base Sepolia ETH,
  // so I'm using an account previously created with `cdp.evm.createAccount()`, then funded with enough to cover the example.
  const address = "0xf528387C767fEF9ff28A4F220008e1A23e87c6cA";
  console.log("using previously created account with address", { address });

  const balance = await client.getBalance({ address });
  const restrictedBalance = balance / BigInt(5);
  console.log("Current and restricted balance", {
    balance: balance.toString(),
    balanceToRestrict: restrictedBalance.toString(),
  });

  // Create a policy that:
  // - Only accepts transactions to WETH contract
  // - with an ETH value of less or equal to 1/5 of my wallet balance
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
              // only the WETH contract address
              addresses: ["0x4200000000000000000000000000000000000006"],
              operator: "in",
            },
            { type: "evmNetwork", networks: ["base-sepolia"], operator: "in" },
            {
              type: "ethValue",
              // Decide how much we should allow our agent to send in a single transaction.
              ethValue: restrictedBalance.toString(),
              operator: "<=",
            },
          ],
        },
      ],
    },
  });

  // Now apply the policy to the account we've just created
  await cdp.evm.updateAccount({
    address,
    update: { accountPolicy: policy.id },
  });

  // Initialize AgentKit with our CDP V2 Wallet provider and address.
  const walletProvider = await CdpV2EvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET,
    address,
    networkId: "base-sepolia",
  });
  // Now we need to bootstrap AgentKit
  const agentKit = await AgentKit.from({
    walletProvider: walletProvider,
    actionProviders: [
      // Supply actions to check native balance and send ETH
      walletActionProvider(),
      // We need this to convert ETH to WETH
      wethActionProvider(),
    ],
  });

  // Use whatever model you fancy.
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  const model = anthropic("claude-3-7-sonnet-20250219");
  const tools = getVercelAITools(agentKit);

  // This should fail because of the ETH value restriction
  const tryToSendAllMeMoneyArrr = `
    Please send my entire ETH balance in ETH to 0x000000000000000000000000000000000000dead. Use only the base-sepolia network for all contract interactions.
  `;
  console.log(tryToSendAllMeMoneyArrr)

  const failure = await generateText({
    model,
    tools,
    prompt: tryToSendAllMeMoneyArrr,
    maxSteps: 10,
  });
  console.log(failure.text);

  // This should suceed.
  const thisIsATotallyFineThingToDo = `
    Please wrap 1/10 of my current ETH balance in WETH. Use only the base-sepolia network for all contract interactions.
  `;
  console.log(thisIsATotallyFineThingToDo)

  const success = await generateText({
    model,
    tools,
    prompt: thisIsATotallyFineThingToDo,
    maxSteps: 10,
  });
  console.log(success.text);
}

try {
  await main();
  process.exit(0);
} catch (e) {
  console.error(e);
  process.exit(1);
}
