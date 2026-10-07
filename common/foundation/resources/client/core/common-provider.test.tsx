import {CommonProvider} from './common-provider';
import {usePasswordConfirmedAction} from '@common/auth/ui/confirm-password/use-password-confirmed-action';
import {queryClient} from '@common/http/query-client';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {setBootstrapData} from '@ui/bootstrap-data/bootstrap-data-store';
import {createMemoryRouter} from 'react-router';
import {expect, it} from 'vitest';

it('mounts ConfirmPasswordDialogProvider so password-gated actions open the dialog', async () => {
  setBootstrapData({
    settings: {themes: []},
    i18n: {active: 'en', locales: [{language: 'en'}]},
  } as any);
  queryClient.setQueryData(['password-confirmation-status'], {confirmed: false});

  function Consumer() {
    const {withConfirmedPassword} = usePasswordConfirmedAction();
    return (
      <button type="button" onClick={() => withConfirmedPassword(() => {})}>
        Enable
      </button>
    );
  }

  const router = createMemoryRouter([{path: '/', element: <Consumer />}], {
    initialEntries: ['/'],
  });

  render(<CommonProvider router={router as never} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', {name: 'Enable'}));

  expect(
    await screen.findByText('Confirm password', {selector: 'h2'}),
  ).toBeInTheDocument();
});
