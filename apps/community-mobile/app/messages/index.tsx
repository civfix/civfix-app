import { useNavStore } from "@civfix/ui"
import DeepLinkHost from "@/components/DeepLinkHost"

export default function MessagesHostScreen() {
  return (
    <DeepLinkHost
      seed={() => {
        // originView is nulled with the emptied stack because a non-null originView implies a non-empty
        // stack, and this raw setState bypasses the reducers that maintain that invariant.
        useNavStore.setState({ view: "messaging", stack: [], active: null, originView: null })
      }}
    />
  )
}
