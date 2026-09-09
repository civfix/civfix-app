import { openReportFlow } from "@civfix/ui"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function ReportRoute() {
  return <DeepLinkHost seed={() => openReportFlow()} />
}
