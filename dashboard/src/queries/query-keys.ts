export const dashboardQueryKeys = {
  todos: {
    overview: (apiKey: string) => ['todos', 'overview', apiKey] as const,
    project: (apiKey: string, projectId: string) => ['todos', 'project', apiKey, projectId] as const,
    completed: (apiKey: string, projectId: string) =>
      ['todos', 'project-completed', apiKey, projectId] as const,
  },
}
