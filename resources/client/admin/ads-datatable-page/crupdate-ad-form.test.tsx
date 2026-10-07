import {CrupdateAdForm} from './crupdate-ad-form';
import {createAdDefaults} from './create-ad-dialog';
import {queryClient} from '@common/http/query-client';
import {HookForm} from '@shadcn/forms/form/hook-form';
import {QueryClientProvider} from '@tanstack/react-query';
import {render, screen} from '@testing-library/react';
import {useForm} from 'react-hook-form';
import {expect, it} from 'vitest';

/**
 * Opens the create-ad dialog on a real admin page. The upload slots need the
 * context-based uploader store that FileUploadProvider provides; without it
 * useActiveUpload() reads null and the whole route falls into the error page.
 */
it('renders unless the upload slots have a provider', () => {
  function Form() {
    const form = useForm({defaultValues: createAdDefaults()});
    return (
      <QueryClientProvider client={queryClient}>
        <HookForm.Root form={form} onSubmit={() => {}}>
          <CrupdateAdForm />
        </HookForm.Root>
      </QueryClientProvider>
    );
  }
  render(<Form />);

  expect(screen.getByText('Name')).toBeInTheDocument();
  expect(screen.getByText('Ad type')).toBeInTheDocument();
});