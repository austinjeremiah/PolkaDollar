import { ProtocolProvider } from "@/components/protocol/protocol-provider";
import { ProtocolShell } from "@/components/protocol/protocol-shell";

export default function ProtocolLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtocolProvider>
      <ProtocolShell>{children}</ProtocolShell>
    </ProtocolProvider>
  );
}
