import {GuestRoute} from '@common/auth/guards/guest-route';
import {TwoFactorChallengePage} from '@common/auth/ui/account-settings/two-factor/two-factor-challenge-page';
import {LoginPage} from '@common/auth/ui/login-page';
import {ReactNode, useState} from 'react';

/**
 * The challenge lives in component state, but a refresh remounts the tree and
 * dropped the user back on the password form with a challenge still pending
 * server side. sessionStorage is scoped to the tab, which is the same lifetime
 * the pending challenge has, so the flag is written there and read back on
 * mount.
 */
const CHALLENGE_PENDING_KEY = 'keekii.two-factor-challenge-pending';

function readChallengePending(): boolean {
  try {
    return sessionStorage.getItem(CHALLENGE_PENDING_KEY) === 'true';
  } catch {
    // Storage can be blocked entirely; the challenge still works, it just
    // will not survive a refresh.
    return false;
  }
}

function writeChallengePending(pending: boolean): void {
  try {
    if (pending) {
      sessionStorage.setItem(CHALLENGE_PENDING_KEY, 'true');
    } else {
      sessionStorage.removeItem(CHALLENGE_PENDING_KEY);
    }
  } catch {
    // See readChallengePending().
  }
}

interface Props {
  bottomMessages?: ReactNode;
}
export function LoginPageWrapper({bottomMessages}: Props) {
  const [isTwoFactor, setIsTwoFactor] = useState(readChallengePending);

  const setChallengePending = (pending: boolean) => {
    setIsTwoFactor(pending);
    writeChallengePending(pending);
  };

  const component = isTwoFactor ? (
    <TwoFactorChallengePage
      onSuccess={() => setChallengePending(false)}
      onCancel={() => setChallengePending(false)}
    />
  ) : (
    <LoginPage
      onTwoFactorChallenge={() => setChallengePending(true)}
      bottomMessages={bottomMessages}
    />
  );

  return <GuestRoute>{component}</GuestRoute>;
}
