type Listener = () => void;

let oauthInProgress = false;
const listeners = new Set<Listener>();

export function setOAuthInProgress(value: boolean) {
  if (oauthInProgress === value) return;
  oauthInProgress = value;
  listeners.forEach((l) => l());
}

export function getOAuthInProgress(): boolean {
  return oauthInProgress;
}

export function subscribeOAuth(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}