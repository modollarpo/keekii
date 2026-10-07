import {
  AD_IMAGE_RESTRICTIONS,
  AD_VIDEO_RESTRICTIONS,
  AD_VOICEOVER_RESTRICTIONS,
  CreativeUploadField,
} from '@app/admin/ads-datatable-page/creative-upload-field';
import {CrupdateAdPayload} from '@app/admin/ads-datatable-page/requests/use-create-ad';
import {FileUploadProvider} from '@common/uploads/uploader/file-upload-provider';
import {Field} from '@shadcn/forms/field';
import {HookForm} from '@shadcn/forms/form/hook-form';
import {Input} from '@shadcn/forms/input/input';
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@shadcn/forms/number-field/number-field';
import {Select} from '@shadcn/forms/select/select';
import {Switch} from '@shadcn/forms/switch/switch';
import {FormDatePicker} from '@ui/forms/input-field/date/date-picker/date-picker';
import {Trans} from '@ui/i18n/trans';
import {useWatch} from 'react-hook-form';

const TYPE_ITEMS = [
  {value: 'video', label: 'Video'},
  {value: 'imageWithVoice', label: 'Image with voiceover'},
];

export function CrupdateAdForm() {
  const type = useWatch<CrupdateAdPayload, 'type'>({name: 'type'});

  return (
    // FileUploadProvider backs the CreativeUploadField slots: their
    // useActiveUpload() reads a context-based uploader store that is null
    // outside an admin page's normal uploads area, and reading null crashes
    // the dialog mount. Covered by the surrounding create/update dialogs.
    <FileUploadProvider>
      <Field.Group>
      <HookForm.Field name="name">
        <Field.Label>
          <Trans message="Name" />
        </Field.Label>
        <Input required autoFocus />
        <Field.Description>
          <Trans message="Internal label. Never shown to listeners." />
        </Field.Description>
        <Field.Error />
      </HookForm.Field>

      <HookForm.Field name="advertiser_name">
        <Field.Label>
          <Trans message="Advertiser" />
        </Field.Label>
        <Input required />
        <Field.Description>
          <Trans message="Shown to the listener while the ad plays." />
        </Field.Description>
        <Field.Error />
      </HookForm.Field>

      <HookForm.Field name="type">
        <Field.Label>
          <Trans message="Ad type" />
        </Field.Label>
        <Select.Root items={TYPE_ITEMS} required>
          <Select.Trigger className="w-full">
            <Select.Value
              placeholder={<Trans message="Select ad type" />}
            />
          </Select.Trigger>
          <Select.Content>
            {TYPE_ITEMS.map(item => (
              <Select.Item key={item.value} value={item.value}>
                <Trans message={item.label} />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
        <Field.Error />
      </HookForm.Field>

      {type === 'video' && (
        <CreativeUploadField
          field="video_path"
          label={<Trans message="Video" />}
          description={
            <Trans message="MP4, WebM or MOV. Plays full screen over the player." />
          }
          uploadType="ads"
          restrictions={AD_VIDEO_RESTRICTIONS}
        />
      )}

      {type === 'imageWithVoice' && (
        <>
          <CreativeUploadField
            field="image_path"
            label={<Trans message="Image" />}
            description={
              <Trans message="JPEG, PNG, WebP or AVIF. Shown behind the voiceover." />
            }
            uploadType="ads"
            restrictions={AD_IMAGE_RESTRICTIONS}
          />
          <CreativeUploadField
            field="voiceover_path"
            label={<Trans message="Voiceover" />}
            description={
              <Trans message="MP3, M4A, WAV or OGG. Plays while the image is on screen." />
            }
            uploadType="ads"
            restrictions={AD_VOICEOVER_RESTRICTIONS}
          />
        </>
      )}

      <HookForm.Field name="click_through_url">
        <Field.Label>
          <Trans message="Click through URL" />
        </Field.Label>
        <Input
          type="url"
          placeholder="https://example.com"
          disabled={type !== 'video'}
        />
        <Field.Description>
          {type === 'video' ? (
            <Trans message="Optional landing page opened when the listener clicks the ad." />
          ) : (
            <Trans message="Only video ads are clickable." />
          )}
        </Field.Description>
        <Field.Error />
      </HookForm.Field>

      <FormDatePicker
        size="sm"
        name="starts_at"
        granularity="minute"
        label={<Trans message="Starts at" />}
        description={
          <Trans message="Leave empty to start serving immediately." />
        }
      />

      <FormDatePicker
        size="sm"
        name="ends_at"
        granularity="minute"
        label={<Trans message="Ends at" />}
        description={<Trans message="Leave empty to never stop serving." />}
      />

      <HookForm.Field name="weight">
        <Field.Label>
          <Trans message="Weight" />
        </Field.Label>
        <NumberField min={1} max={100000} required>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberField>
        <Field.Description>
          <Trans message="Relative share of impressions compared to other ads." />
        </Field.Description>
        <Field.Error />
      </HookForm.Field>

      {type === 'video' && (
        <HookForm.Field name="skip_after_seconds">
          <Field.Label>
            <Trans message="Skip after" />
          </Field.Label>
          <NumberField min={0} max={600}>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberField>
          <Field.Description>
            <Trans message="Seconds before the skip button appears. 0 offers no skip button." />
          </Field.Description>
          <Field.Error />
        </HookForm.Field>
      )}

      <HookForm.Field name="is_active">
        <Field.Label>
          <Switch />
          <Trans message="Active" />
        </Field.Label>
        <Field.Error />
      </HookForm.Field>
    </Field.Group>
    </FileUploadProvider>
  );
}

export function normalizeAdPayload(
  values: CrupdateAdPayload,
): CrupdateAdPayload {
  return {
    ...values,
    name: values.name.trim(),
    advertiser_name: values.advertiser_name.trim(),
    click_through_url: values.click_through_url?.trim() || null,
    video_path: values.video_path || null,
    image_path: values.image_path || null,
    voiceover_path: values.voiceover_path || null,
    starts_at: values.starts_at || null,
    ends_at: values.ends_at || null,
    skip_after_seconds:
      values.type === 'video' ? values.skip_after_seconds : null,
  };
}
