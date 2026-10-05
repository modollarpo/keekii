import {queryClient} from '@common/http/query-client';
import {Button} from '@shadcn/button/button';
import {Empty} from '@shadcn/empty/empty';
import {Trans} from '@ui/i18n/trans';
import {CircleAlertIcon} from 'lucide-react';
import {useState} from 'react';
import {useRevalidator} from 'react-router';

export function PageErrorMessage() {
  const revalidator = useRevalidator();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);

    // resetQueries (not removeQueries) so cached queries are refetched instead
    // of being dropped, which left the page stuck in its error state.
    await queryClient.resetQueries();

    // A loader that threw leaves React Router holding the route error, so the
    // query cache reset alone cannot clear this screen. Revalidate re-runs the
    // active loaders and puts the route back in a rendered state if it recovers.
    await revalidator.revalidate();

    setIsRetrying(false);
  };

  return (
    <Empty.Root>
      <Empty.Header>
        <Empty.Media>
          <CircleAlertIcon />
        </Empty.Media>
        <Empty.Title>
          <Trans message="There was an issue loading this page" />
        </Empty.Title>
        <Empty.Description>
          <Trans message="Please try again later" />
        </Empty.Description>
      </Empty.Header>
      <Empty.Content>
        <Button
          variant="outline"
          onClick={() => handleRetry()}
          disabled={isRetrying}
        >
          <Trans message="Retry" />
        </Button>
      </Empty.Content>
    </Empty.Root>
  );
}
