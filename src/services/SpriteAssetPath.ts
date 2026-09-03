export function getSpriteImagePath(relativePath: string): string {
  if (relativePath.startsWith('data:')) return relativePath

  const cleanPath = relativePath.replace(/^\/+/, '').replace('/./', '/')
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`

  return `${baseUrl}${cleanPath}`
}
