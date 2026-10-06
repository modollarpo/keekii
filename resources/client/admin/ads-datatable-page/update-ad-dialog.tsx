import {
  CrupdateAdForm,
  normalizeAdPayload,
} from '@app/admin/ads-datatable-page/crupdate-ad-form';
import {UpdateAdPayload, useUpdateAd} from '@app/admin/ads-datatable-page/requests/use-update-ad';
import {Ad} from '@app/web-player/ads/ad';
import {Button} from '@shadcn/button/button';
import {Dialog} from '@shadcn/dialog/dialog';
import {HookForm} from '@shadcn/forms/form/hook-form';
import {Trans} from '@ui/i18n/trans';
import {useState} from 'react';
import {useForm} from 'react-hook-form';

type UpdateAdDialogProps = {
  ad: Ad;
  children: Dialog.TriggerElement;
};

export function UpdateAdDialog({ad, children}: UpdateAdDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {children}
      <Dialog.Portal>
        <Dialog.Backdrop />
        <UpdateAdDialogContent ad={ad} onClose={() => setOpen(false)} />
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function UpdateAdDialogContent({ad, onClose}: {ad: Ad; onClose: () => void}) {
  const form = useForm<UpdateAdPayload>({
    defaultValues: {
      id: ad.id,
      type: ad.type,
      name: ad.name,
      advertiser_name: ad.advertiser_name,
      video_path: ad.video_path,
      image_path: ad.image_path,
      voiceover_path: ad.voiceover_path,
      click_through_url: ad.click_through_url ?? '',
      starts_at: ad.starts_at,
      ends_at: ad.ends_at,
      weight: ad.weight,
      skip_after_seconds: ad.skip_after_seconds,
      is_active: ad.is_active,
    },
  });
  const updateAd = useUpdateAd(form);

  const handleSubmit = (values: UpdateAdPayload) => {
    updateAd.mutate(normalizeAdPayload(values), {
      onSuccess: () => onClose(),
    });
  };

  return (
    <HookForm.Root form={form} onSubmit={handleSubmit}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>
            <Trans message="Update :name ad" values={{name: ad.name}} />
          </Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <CrupdateAdForm />
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.CloseButton disabled={updateAd.isPending}>
            <Trans message="Cancel" />
          </Dialog.CloseButton>
          <Button type="submit" disabled={updateAd.isPending}>
            <Trans message="Save" />
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </HookForm.Root>
  );
}
