export function chainLabel(chainId: number): string {
  switch (chainId) {
    case 1:
      return "Ethereum";
    case 11155111:
      return "Sepolia";
    case 137:
      return "Polygon";
    case 31337:
      return "Hardhat";
    default:
      return `Chain ${chainId}`;
  }
}

export function getInjected(): Eip1193Provider | null {
  const injected = window.ethereum;
  if (!injected || typeof injected.request !== "function") return null;
  return injected;
}

export async function switchNetwork(provider: Eip1193Provider, chainId: number, rpcUrl: string): Promise<void> {
  const hexId = `0x${chainId.toString(16)}`;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch (err) {
    const code = typeof err === "object" && err !== null && "code" in err ? Number((err as { code: unknown }).code) : 0;
    if (code !== 4902) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexId,
          chainName: chainLabel(chainId),
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [rpcUrl],
        },
      ],
    });
  }
}
