const KEY = 'jobsapi_dashboard_apikey'

export const getApiKey = (): string => {
  const value = (localStorage.getItem(KEY) ?? '').trim()
  if (!value) {
    return ''
  }

  return value
}

export const setApiKey = (value: string): void => {
  localStorage.setItem(KEY, value.trim())
}
