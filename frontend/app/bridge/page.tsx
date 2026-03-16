"use client"

import { useEffect, useMemo, useState } from "react"
import { ethers } from "ethers"
import { ApiPromise, WsProvider } from "@polkadot/api"
import { decodeAddress } from "@polkadot/util-crypto"
import { hexToU8a, u8aToHex } from "@polkadot/util"

import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type BuildResult = {
  destinationHex: string
  messageHex: string
  extrinsicHex: string
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    }
  }
}

const EVM_RPC = process.env.NEXT_PUBLIC_EVM_RPC_URL ?? "https://testnet-passet-hub-eth-rpc.polkadot.io"
const WS_RPC = process.env.NEXT_PUBLIC_WS_RPC_URL ?? "wss://asset-hub-paseo-rpc.dwellir.com"
const XCM_TRANSFER = process.env.NEXT_PUBLIC_XCM_TRANSFER_ADDRESS ?? ""

const XCM_ABI = [
  "function sendCrossChain(bytes destination, bytes message) external returns (bytes32)",
  "function send(bytes destination, bytes message, address recipient) external returns (bytes32)",
]

function normalizeHexAddress(input: string): string {
  if (!ethers.isAddress(input)) {
    throw new Error("Invalid EVM address")
  }
  return ethers.getAddress(input)
}

async function ensureApi(current: ApiPromise | null): Promise<ApiPromise> {
  if (current && current.isConnected) {
    return current
  }
  const provider = new WsProvider(WS_RPC)
  return ApiPromise.create({ provider })
}

function amountToPlanck(amount: string, decimals: number): bigint {
  if (!amount || Number(amount) <= 0) {
    throw new Error("Amount must be greater than 0")
  }
  return ethers.parseUnits(amount, decimals)
}

function shortHex(hex: string, chars = 14): string {
  if (hex.length <= chars) return hex
  return `${hex.slice(0, chars)}...${hex.slice(-8)}`
}

export default function BridgePage() {
  const [api, setApi] = useState<ApiPromise | null>(null)
  const [isWsReady, setIsWsReady] = useState(false)

  const [wallet, setWallet] = useState<string>("")
  const [recipientSs58, setRecipientSs58] = useState("")
  const [amount, setAmount] = useState("1")
  const [paraId, setParaId] = useState("2034")
  const [assetDecimals, setAssetDecimals] = useState("18")

  const [buildResult, setBuildResult] = useState<BuildResult | null>(null)
  const [txHash, setTxHash] = useState("")
  const [status, setStatus] = useState("Idle")
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true
    let connectedApi: ApiPromise | null = null

    ;(async () => {
      try {
        const readyApi = await ensureApi(null)
        connectedApi = readyApi
        if (!mounted) return
        setApi(readyApi)
        setIsWsReady(true)
      } catch (err) {
        console.error(err)
        if (mounted) {
          setError("Failed to connect to Polkadot WS endpoint. Check NEXT_PUBLIC_WS_RPC_URL.")
          setIsWsReady(false)
        }
      }
    })()

    return () => {
      mounted = false
      if (connectedApi) {
        void connectedApi.disconnect()
      }
    }
  }, [])

  const canBuild = useMemo(() => {
    return isWsReady && recipientSs58.trim().length > 0 && Number(amount) > 0 && Number(paraId) > 0
  }, [amount, isWsReady, paraId, recipientSs58])

  const connectWallet = async () => {
    setError("")
    if (!window.ethereum) {
      setError("MetaMask not detected in browser.")
      return
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      await provider.send("eth_requestAccounts", [])
      const signer = await provider.getSigner()
      const addr = await signer.getAddress()
      setWallet(addr)
      setStatus(`Wallet connected: ${addr}`)
    } catch (err) {
      console.error(err)
      setError("Wallet connection failed.")
    }
  }

  const buildBytes = async () => {
    setError("")
    setStatus("Building destination + message bytes...")

    try {
      if (!api) {
        throw new Error("Polkadot API not ready")
      }

      const para = Number(paraId)
      const planck = amountToPlanck(amount, Number(assetDecimals))
      const accountId = decodeAddress(recipientSs58.trim())
      const accountHex = u8aToHex(accountId)

      const destination = api.createType("XcmVersionedLocation", {
        V4: {
          parents: 1,
          interior: {
            X1: [{ Parachain: para }],
          },
        },
      })

      const beneficiary = {
        V4: {
          parents: 0,
          interior: {
            X1: [
              {
                AccountId32: {
                  network: null,
                  id: accountHex,
                },
              },
            ],
          },
        },
      }

      const assets = {
        V4: [
          {
            id: {
              Concrete: {
                parents: 1,
                interior: "Here",
              },
            },
            fun: {
              Fungible: planck,
            },
          },
        ],
      }

      const xcmMessage = api.createType("XcmVersionedXcm", {
        V4: [
          {
            WithdrawAsset: [
              {
                id: {
                  Concrete: {
                    parents: 1,
                    interior: "Here",
                  },
                },
                fun: {
                  Fungible: planck,
                },
              },
            ],
          },
          {
            BuyExecution: {
              fees: {
                id: {
                  Concrete: {
                    parents: 1,
                    interior: "Here",
                  },
                },
                fun: {
                  Fungible: planck,
                },
              },
              weightLimit: "Unlimited",
            },
          },
          {
            DepositAsset: {
              assets: "All",
              beneficiary: {
                parents: 0,
                interior: {
                  X1: [
                    {
                      AccountId32: {
                        network: null,
                        id: accountHex,
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      })

      const tx = api.tx.polkadotXcm.limitedReserveTransferAssets(destination, beneficiary, assets, 0, "Unlimited")

      setBuildResult({
        destinationHex: destination.toHex(),
        messageHex: xcmMessage.toHex(),
        extrinsicHex: tx.method.toHex(),
      })
      setStatus("SCALE bytes built successfully.")
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to build XCM bytes")
      setStatus("Build failed")
    }
  }

  const sendToXcmTransfer = async () => {
    setError("")
    setTxHash("")

    try {
      if (!window.ethereum) {
        throw new Error("MetaMask not detected")
      }
      if (!buildResult) {
        throw new Error("Build bytes first")
      }
      if (!XCM_TRANSFER) {
        throw new Error("Set NEXT_PUBLIC_XCM_TRANSFER_ADDRESS in frontend env")
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      await provider.send("eth_requestAccounts", [])
      const signer = await provider.getSigner()
      const signerAddress = await signer.getAddress()

      setStatus("Sending EVM tx to XCMTransfer...")

      const contract = new ethers.Contract(normalizeHexAddress(XCM_TRANSFER), XCM_ABI, signer)

      let tx
      try {
        tx = await contract.sendCrossChain(hexToU8a(buildResult.destinationHex), hexToU8a(buildResult.messageHex))
      } catch {
        tx = await contract.send(hexToU8a(buildResult.destinationHex), hexToU8a(buildResult.messageHex), signerAddress)
      }

      const receipt = await tx.wait()
      setTxHash(receipt?.hash ?? tx.hash)
      setStatus("XCM bytes submitted via contract. Check explorer/logs for dispatch result.")
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Transaction failed")
      setStatus("Send failed")
    }
  }

  return (
    <div className="min-h-screen dot-grid-bg">
      <Navbar />

      <main className="px-4 pb-16 pt-8 lg:px-8">
        <section className="mx-auto w-full max-w-6xl">
          <h1 className="mb-2 text-3xl font-pixel tracking-tight text-foreground lg:text-5xl">POLKA$ BRIDGE</h1>
          <p className="mb-8 max-w-3xl text-sm text-muted-foreground">
            Build SCALE-encoded XCM destination and message bytes with Polkadot WS, then send them through your EVM
            XCMTransfer contract using MetaMask.
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bridge Input</CardTitle>
                <CardDescription>Hydration route over XCM V4 (Asset Hub style payload)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Recipient SS58</label>
                  <Input
                    placeholder="5F..."
                    value={recipientSs58}
                    onChange={(e) => setRecipientSs58(e.target.value)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">Amount</label>
                    <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">Asset Decimals</label>
                    <Input value={assetDecimals} onChange={(e) => setAssetDecimals(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Destination Para ID</label>
                  <Input value={paraId} onChange={(e) => setParaId(e.target.value)} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={connectWallet} variant="outline">
                    {wallet ? `Connected ${shortHex(wallet)}` : "Connect MetaMask"}
                  </Button>
                  <Button onClick={buildBytes} disabled={!canBuild}>
                    Build XCM Bytes
                  </Button>
                </div>

                <Button onClick={sendToXcmTransfer} className="w-full" disabled={!buildResult}>
                  Send pUSD to Hydration
                </Button>

                <p className="text-xs text-muted-foreground">EVM RPC: {EVM_RPC}</p>
                <p className="text-xs text-muted-foreground">WS RPC: {WS_RPC}</p>
                <p className="text-xs text-muted-foreground">XCMTransfer: {XCM_TRANSFER || "not configured"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Encoded Payload</CardTitle>
                <CardDescription>Destination + message hex generated by @polkadot/api types</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Status</p>
                  <p className="text-sm">{status}</p>
                </div>

                {error ? (
                  <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                    {error}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Destination Bytes</p>
                  <p className="break-all rounded-md border bg-muted/30 p-3 text-xs font-mono">
                    {buildResult?.destinationHex ?? "-"}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Message Bytes</p>
                  <p className="break-all rounded-md border bg-muted/30 p-3 text-xs font-mono">
                    {buildResult?.messageHex ?? "-"}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Extrinsic Method Hex</p>
                  <p className="break-all rounded-md border bg-muted/30 p-3 text-xs font-mono">
                    {buildResult?.extrinsicHex ?? "-"}
                  </p>
                </div>

                {txHash ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Last EVM Tx Hash</p>
                    <p className="break-all rounded-md border bg-muted/30 p-3 text-xs font-mono">{txHash}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
