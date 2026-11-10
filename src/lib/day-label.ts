import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]

/** The short weekday of a "yyyy-MM-dd" day: "segunda". */
export const weekdayName = (day: string): string => WEEKDAYS[parseISO(day).getDay()]

/** The title of a day navigator: "segunda, 9 de novembro". */
export const dayNavLabel = (day: string): string => `${weekdayName(day)}, ${format(parseISO(day), "d 'de' MMMM", { locale: ptBR })}`
