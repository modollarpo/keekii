import {UploadType} from '@app/site-config';
import {CrupdateAdPayload} from '@app/admin/ads-datatable-page/requests/use-create-ad';
import {restrictionsFromConfig} from '@common/uploads/uploader/create-file-upload';
import {useActiveUpload} from '@common/uploads/uploader/use-active-upload';
import {Button} from '@shadcn/button/button';
import {Field} from '@shadcn/forms/field';
import {HookForm} from '@shadcn/forms/form/hook-form';
import {Trans} from '@ui/i18n/trans';
import {Restrictions} from '@ui/utils/files/validate-file';
import {XIcon} from 'lucide-react';
import {ReactNode} from 'react';
import {useFormContext} from 'react-hook-form';

export type CreativeField = 'video_path' | 'image_path' | 'voiceover_path';

interface Props {
  field: CreativeField;
  label: ReactNode;
  description: ReactNode;
  uploadType: keyof typeof UploadType;
  restrictions: Restrictions;
}

/**
 * A single creative slot (video / still image / voiceover).
 *
 * The uploader is given explicit restrictions instead of relying on the
 * site-wide "uploading types" setting, which is only configured for the
 * music assets.
 */
export function CreativeUploadField({
  field,
  label,
  description,
  uploadType,
  restrictions,
}: Props) {
  const {watch, setValue} = useFormContext<CrupdateAdPayload>();
  const {selectAndUploadFile, percentage, uploadStatus} = useActiveUpload();
  const value = watch(field);
  const isUploading =
    uploadStatus === 'inProgress' || uploadStatus === 'pending';

  return (
    <HookForm.Field name={field}>
      <Field.Label>{label}</Field.Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isUploading}
          onClick={() =>
            selectAndUploadFile({
              uploadType,
              restrictions,
              showToastOnRestrictionFail: true,
              onSuccess: entry => {
                setValue(field, entry.url, {shouldDirty: true});
              },
            })
          }
        >
          {isUploading ? (
            <span className="tabular-nums">{percentage}%</span>
          ) : (
            <>
              <Trans message="Upload" />
            </>
          )}
        </Button>
        {value && !isUploading && (
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded border px-2 py-1">
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="truncate text-sm outline-hidden hover:underline focus-visible:underline"
            >
              {decodeURIComponent(value.split('/').pop() || value)}
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="ml-auto shrink-0"
              onClick={() => setValue(field, null, {shouldDirty: true})}
            >
              <XIcon />
              <span className="sr-only">
                <Trans message="Remove" />
              </span>
            </Button>
          </div>
        )}
      </div>
      <Field.Description>{description}</Field.Description>
      <Field.Error />
    </HookForm.Field>
  );
}

export const AD_VIDEO_RESTRICTIONS: Restrictions = {
  allowedFileTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
  maxFileSize: 512 * 1024 * 1024,
};

export const AD_IMAGE_RESTRICTIONS: Restrictions = {
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  maxFileSize: 25 * 1024 * 1024,
};

export const AD_VOICEOVER_RESTRICTIONS: Restrictions = {
  allowedFileTypes: [
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
  ],
  maxFileSize: 100 * 1024 * 1024,
};
