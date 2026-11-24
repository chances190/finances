const normalize = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path)

let path = $state(normalize(window.location.pathname))
let search = $state(window.location.search)

function sync() {
  path = normalize(window.location.pathname)
  search = window.location.search
}

export const router = {
  get path() {
    return path
  },
  get search() {
    return search
  },
  query() {
    return new URLSearchParams(search)
  },
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  const target = to.startsWith('/') ? to : `/${to}`
  if (target === path + search) return
  if (options.replace) {
    window.history.replaceState(null, '', target)
  } else {
    window.history.pushState(null, '', target)
  }
  sync()
}

export function initRouter() {
  const listener = () => sync()
  window.addEventListener('popstate', listener)
  return () => window.removeEventListener('popstate', listener)
}
