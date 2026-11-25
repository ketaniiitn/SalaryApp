import { router } from "expo-router";

import { Banner } from "@/components/book";
import { Button } from "@/components/button";

/** Shown on Sign in and Sign up when nothing answered at the server address. */
export function ServerProblem({ onRetry }: { onRetry: () => void }) {
  return (
    <Banner
      title="Can't reach Salary."
      actions={
        <>
          <Button label="Try again" variant="line" small className="flex-1" onPress={onRetry} />
          <Button label="Check address" variant="line" small className="flex-1" onPress={() => router.push("/server")} />
        </>
      }>
      Check that the phone has internet. If it does, the server address may be wrong.
    </Banner>
  );
}
