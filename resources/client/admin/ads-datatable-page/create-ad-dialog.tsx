import {CrupdateAdForm, normalizeAdPayload} from '@app/admin/ads-datatable-page/crupdate-ad-form';
import {
  CrupdateAdPayload,
  useCreateAd,
} from '@app/admin/ads-datatable-page/requests/use-create-ad';
import {Button} from '@shadcn/button/button';
import {Dialog} from '@shadcn/dialog/dialog';
import {HookForm} from '@shadcn/forms/form/hook-form';
import {Trans} from '@ui/i18n/trans';
import {useState} from 'react';
import {useForm} from 'react-hook-form';

type CreateAdDialogProps = {
  children: Dialog.TriggerElement;
};

export function CreateAdDialog({children}: CreateAdDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {children}
      <Dialog.Portal>
        <Dialog.Backdrop />
        <CreateAdDialogContent onClose={() => setOpen(false)} />
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CreateAdDialogContent({onClose}: {onClose: () => void}) {
  const form = useForm<CrupdateAdPayload>({defaultValues: createAdDefaults()});
  const createAd = useCreateAd(form);

  const handleSubmit = (values: CrupdateAdPayload) => {
    createAd.mutate(normalizeAdPayload(values), {
      onSuccess: () => onClose(),
    });
  };

  return (
    <HookForm.Root form={form} onSubmit={handleSubmit}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>
            <Trans message="Create new ad" />
          </Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <CrupdateAdForm />
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.CloseButton disabled={createAd.isPending}>
            <Trans message="Cancel" />
          </Dialog.CloseButton>
          <Button type="submit" disabled={createAd.isPending}>
            <Trans message="Create" />
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </HookForm.Root>
  );
}

export function createAdDefaults(): CrupdateAdPayload {
  return {
    type: 'video',
    name: '',
    advertiser_name: '',
    video_path: null,
    image_path: null,
    voiceover_path: null,
    click_through_url: '',
    starts_at: null,
    ends_at: null,
    weight: 1,
    skip_after_seconds: 5,
    is_active: true,
  };
}
