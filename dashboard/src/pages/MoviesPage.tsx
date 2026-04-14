import { MediaMaintenanceWorkspace } from '@/components/MediaMaintenanceWorkspace'
import { createMovieMetadataBackfill, listMovies } from '../lib/api'

export const MoviesPage = () => {
  return (
    <MediaMaintenanceWorkspace
      entityLabel="movie"
      entityLabelPlural="Movies"
      loadRecords={listMovies}
      createBackfillJob={createMovieMetadataBackfill}
    />
  )
}
