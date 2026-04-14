import { MediaMaintenanceWorkspace } from '@/components/MediaMaintenanceWorkspace'
import { createShowMetadataBackfill, listShows } from '../lib/api'

export const ShowsPage = () => {
  return (
    <MediaMaintenanceWorkspace
      entityLabel="show"
      entityLabelPlural="Shows"
      loadRecords={listShows}
      createBackfillJob={createShowMetadataBackfill}
    />
  )
}
