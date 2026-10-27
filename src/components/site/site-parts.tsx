/** Text and glass on the photo follow the theme, like the auth panel: dark -> Tinta (logo-preta), light -> Papel (logo-branca). */
export const ON_PHOTO = "text-palette-papel dark:text-palette-tinta"

/** Staggered entrance index (see .site-* in globals.css). */
export const reveal = (index: number) => ({ "--reveal": index }) as React.CSSProperties
