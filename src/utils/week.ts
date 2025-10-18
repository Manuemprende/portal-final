export const WEEK_ES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'] as const;

/** Índice del día “hoy” en esquema Lunes=0..Domingo=6 */
export function mondayFirstTodayIndex(d = new Date()): number {
  const js = d.getDay();            // 0=Dom..6=Sáb
  return [6,0,1,2,3,4,5][js];       // Lunes=0..Dom=6
}

/** Rota un array de 7 elementos para que empiece en hoy */
export function rotateWeek<T>(arr: T[], d = new Date()): T[] {
  if (arr.length !== 7) return arr;
  const i = mondayFirstTodayIndex(d);
  return arr.slice(i).concat(arr.slice(0, i));
}

