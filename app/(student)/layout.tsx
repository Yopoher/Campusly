import { StudentNav } from "./student-nav";

export default function StudentLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 pt-6 pb-8">{children}</div>
      <StudentNav />
    </div>
  );
}
