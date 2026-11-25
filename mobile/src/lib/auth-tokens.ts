type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

let tokens: TokenPair | null = null;
let refreshHandler: (() => Promise<boolean>) | null = null;
let refreshing: Promise<boolean> | null = null;

export function setTokens(next: TokenPair | null) {
  tokens = next;
}

export function getAccessToken(): string | null {
  return tokens?.accessToken ?? null;
}

export function setRefreshHandler(handler: (() => Promise<boolean>) | null) {
  refreshHandler = handler;
}

export function refreshAccessToken(): Promise<boolean> {
  if (!refreshHandler) return Promise.resolve(false);
  if (!refreshing) {
    refreshing = refreshHandler().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}
