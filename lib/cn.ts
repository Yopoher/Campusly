/** Assemble des classes CSS en ignorant les valeurs vides. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
